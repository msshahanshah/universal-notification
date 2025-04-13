// ./slack-connector/src/connector.js
const amqp = require('amqplib');
const config = require('./config');
const logger = require('./logger');
const { sendSlackMessage } = require('./slackSender');
const db = require('../models'); // Import Sequelize models/connection
const Notification = db.Notification; // Get the Notification model
const { Op } = require("sequelize"); // Import Operators if needed for queries

let connection = null;
let channel = null;
let consumerTag = null; // Store consumer tag to allow cancellation


/**
 * Processes a message received from RabbitMQ.
 *
 * This function handles the entire message processing lifecycle:
 * - Parsing the message content
 * - Idempotency checks
 * - Updating the database status
 * - Sending the message to Slack
 * - Updating the database with the final status
 *
 * @param {Object} msg - The message object received from RabbitMQ.
 * @param {Object} channel - The RabbitMQ channel. */
async function processMessage(msg, channel) {
    if (msg === null) {
        logger.warn("Consumer received null message, possibly cancelled.");
        return; // Should not happen with basic consume usually
    }

    let notificationData;
    let notificationRecord;
    const messageContent = msg.content.toString();

    try {
        notificationData = JSON.parse(messageContent);
        const { dbId, messageId, channel: targetChannel, message } = notificationData || {};

        // Basic validation of incoming message structure
        if (!dbId || !messageId || !targetChannel || !message) {
            logger.error("Invalid message format received from queue", { content: messageContent });
            // Cannot update DB as we don't have IDs. Discard message.
            channel.nack(msg, false, false); // Negative ack, don't requeue (dead letter later?)
            return;
        }

        logger.info(`Received message from RabbitMQ`, { messageId, dbId, targetChannel });

        // --- Idempotency Check & Processing Start ---
        const transaction = await db.sequelize.transaction(); // Start transaction
        try {
            // Find the notification, lock the row for update (using FOR UPDATE)
            notificationRecord = await Notification.findOne({
                where: { messageId: messageId },
                lock: transaction.LOCK.UPDATE, // Lock the row to prevent concurrent processing
                transaction: transaction
            });

            if (!notificationRecord) {
                logger.error(`Notification record not found in DB for messageId: ${messageId}. Discarding message.`, { messageId, dbId });
                // This shouldn't happen if API worked correctly. Discard.
                await transaction.commit(); // Commit transaction (nothing was changed)
                channel.nack(msg, false, false); // Don't requeue
                return;
            }

            // Idempotency: Check current status
            if (notificationRecord.status === 'sent') {
                logger.warn(`Notification already marked as sent. Acknowledging message.`, { messageId, dbId: notificationRecord.id });
                await transaction.commit(); // Commit transaction (nothing was changed)
                channel.ack(msg); // Acknowledge message, already processed
                return;
            }

            // Optional: Check if already processing (less likely with row lock, but good defense)
            if (notificationRecord.status === 'processing') {
                 logger.warn(`Notification is already being processed (status='processing'). Potential concurrent delivery? Acknowledging.`, { messageId, dbId: notificationRecord.id });
                 await transaction.commit(); // Commit transaction (nothing was changed)
                 channel.ack(msg); // Acknowledge message, let the other process finish
                 return;
            }

            // Check max attempts (for retries - basic implementation here)
            if (notificationRecord.attempts >= config.maxProcessingAttempts && notificationRecord.status === 'failed') {
                 logger.error(`Notification has reached max processing attempts (${config.maxProcessingAttempts}). Marking as permanent failure (if not already).`, { messageId, dbId: notificationRecord.id });
                 // Ensure status is 'failed' (might already be)
                 notificationRecord.status = 'failed';
                 notificationRecord.connectorResponse = (notificationRecord.connectorResponse || '') + ` | Max attempts reached.`;
                 await notificationRecord.save({ transaction: transaction }); // Save within transaction
                 await transaction.commit(); // Commit the final failed state
                 channel.ack(msg); // ACK the message - stop processing it. DLQ should handle permanent failures.
                 return;
            }

            // Mark as 'processing' and increment attempts
            logger.info(`Updating notification status to 'processing'`, { messageId, dbId: notificationRecord.id, attempt: notificationRecord.attempts + 1 });
            notificationRecord.status = 'processing';
            notificationRecord.attempts += 1;
            await notificationRecord.save({ transaction: transaction });

            await transaction.commit(); // Commit the 'processing' status update

        } catch (dbError) {
            logger.error('Database error during pre-processing (find/update status)', {
                messageId,
                dbId: notificationData?.dbId,
                error: dbError.message,
                stack: dbError.stack
            });
            await transaction.rollback(); // Rollback any changes
            // Failed to update DB status - NACK and requeue? Or send to DLQ?
            // Requeuing might lead to loops if DB issue persists. Let's NACK without requeue for now.
            channel.nack(msg, false, false); // NACK, don't requeue. Needs DLQ strategy.
            return; // Stop processing this message
        }

        // --- Actual Processing (Send to Slack) ---
        let sendResult;
        try {
            logger.info(`Calling Slack sender`, { messageId, dbId: notificationRecord.id, targetChannel });
            sendResult = await sendSlackMessage(targetChannel, message, messageId); // Pass messageId for logging

            // --- Update DB based on outcome ---
            if (sendResult.success) {
                logger.info(`Slack send successful. Updating status to 'sent'`, { messageId, dbId: notificationRecord.id });
                await Notification.update(
                    { status: 'sent', connectorResponse: JSON.stringify(sendResult.response) }, // Store Slack response ts etc.
                    { where: { id: notificationRecord.id } }
                 );
                logger.info(`Notification status updated to 'sent'`, { messageId, dbId: notificationRecord.id });
                channel.ack(msg); // ACKNOWLEDGE the message - successfully processed
            } else {
                // Slack sending failed (API error, config error, etc.)
                logger.error(`Slack send failed. Updating status to 'failed'`, { messageId, dbId: notificationRecord.id, error: sendResult.error });
                await Notification.update(
                    { status: 'failed', connectorResponse: sendResult.error }, // Store error message
                    { where: { id: notificationRecord.id } }
                );
                 logger.warn(`Notification status updated to 'failed'`, { messageId, dbId: notificationRecord.id });

                 // DECISION: Requeue or not?
                 // If it's a permanent error (e.g., bad token, channel_not_found), don't requeue.
                 // If it's temporary (e.g., network issue, rate limit), maybe requeue (or use DLQ with delay).
                 // For now, let's NOT requeue on failure, assuming DLQ will handle retries later.
                 channel.ack(msg); // ACK the message - processing *attempt* finished (even if failed). Prevents immediate loops.
            }

        } catch (processingError) {
            // Catch unexpected errors during sendSlackMessage call itself or DB update after sending
            logger.error(`Unexpected error during processing or final DB update`, {
                messageId,
                dbId: notificationRecord?.id, // Record might be null if error happened early
                error: processingError.message,
                stack: processingError.stack
            });

            // Try to update DB to 'failed' state if possible
            if (notificationRecord) {
                 try {
                     await Notification.update(
                         { status: 'failed', connectorResponse: `Unexpected processing error: ${processingError.message}` },
                         { where: { id: notificationRecord.id } }
                     );
                      logger.warn(`Notification status updated to 'failed' due to unexpected error`, { messageId, dbId: notificationRecord.id });
                 } catch (finalDbError) {
                      logger.error(`Failed to update status to 'failed' after unexpected processing error`, {
                          messageId, dbId: notificationRecord.id, dbError: finalDbError.message
                     });
                     // Very bad state - message might be lost or requeued indefinitely depending on ack/nack below
                 }
            }

            // NACK without requeue - let DLQ handle it or investigate manually
            channel.nack(msg, false, false);
        }

    } catch (error) {
        // Catch errors during initial JSON parsing or other unexpected issues before processing starts
        logger.error('Critical error processing message (e.g., JSON parse)', {
            messageContent: messageContent, // Log raw content on parse failure
            error: error.message,
            stack: error.stack
        });
        // Discard malformed message - cannot process
        channel.nack(msg, false, false); // NACK, don't requeue
    }
}


/**
 * Establishes a connection to RabbitMQ, asserts the necessary exchange and queue,
 * binds the queue to the exchange, tests the database connection, and starts consuming messages.
 *
 * Also handles connection errors and implements a basic retry mechanism. */
async function connectAndConsume() {
    try {
        logger.info('Connecting to RabbitMQ...');
        // TODO: Add retry logic with backoff for RabbitMQ connection
        connection = await amqp.connect(config.rabbitMQ.url);
        channel = await connection.createChannel();
        logger.info('RabbitMQ connected.');

        connection.on('error', handleRabbitError);
        connection.on('close', handleRabbitClose);

        // Assert exchange
        await channel.assertExchange(
            config.rabbitMQ.exchangeName,
            config.rabbitMQ.exchangeType,
            { durable: true }
        );
        logger.info(`Exchange '${config.rabbitMQ.exchangeName}' asserted.`);

        // --- Assert Queue (with DLQ setup - basic example) ---
        // This setup will send messages to 'notifications_dlx' after failing processing
        // You'll need another consumer for the retry queue or manual inspection.
        const queueArgs = {
            durable: true,
            // deadLetterExchange: config.rabbitMQ.deadLetterExchange, // Name of the DLX
            // deadLetterRoutingKey: `${config.rabbitMQ.bindingKey}.dead`, // Routing key for DLQ messages (e.g., 'slack.dead')
            // messageTtl: config.rabbitMQ.retryDelay // Optional: Set TTL for automatic requeue after delay (requires DLX->Queue binding)
        };
        const q = await channel.assertQueue(config.rabbitMQ.queueName, queueArgs);
        logger.info(`Queue '${q.queue}' asserted.`); // Add DLQ args logging later

        // Bind queue
        await channel.bindQueue(q.queue, config.rabbitMQ.exchangeName, config.rabbitMQ.bindingKey);
        logger.info(`Queue '${q.queue}' bound to exchange '${config.rabbitMQ.exchangeName}' with key '${config.rabbitMQ.bindingKey}'.`);

        // --- Optional: Assert Dead Letter Exchange and Queue ---
        // await channel.assertExchange(config.rabbitMQ.deadLetterExchange, 'direct', { durable: true });
        // const dlq = await channel.assertQueue(`${config.rabbitMQ.queueName}_dlq`, { durable: true });
        // await channel.bindQueue(dlq.queue, config.rabbitMQ.deadLetterExchange, `${config.rabbitMQ.bindingKey}.dead`);
        // logger.info(`DLQ setup: Exchange '${config.rabbitMQ.deadLetterExchange}', Queue '${dlq.queue}', Binding Key '${config.rabbitMQ.bindingKey}.dead'`);
        // --- End DLQ Setup ---


        // --- Test Database Connection on Startup ---
        logger.info('Testing database connection...');
        await db.sequelize.authenticate(); // Check connection by trying to authenticate
        logger.info('Database connection successful.');


        // --- Start Consuming ---
        channel.prefetch(1); // Process one message at a time per consumer instance
        logger.info(`[*] Waiting for messages in queue '${q.queue}'. To exit press CTRL+C`);

        const consumeResult = await channel.consume(q.queue, (msg) => processMessage(msg, channel), { noAck: false }); // Manual ACKs
        consumerTag = consumeResult.consumerTag; // Store the tag
        logger.info(`Consumer started with tag: ${consumerTag}`);


    } catch (error) {
        logger.error('Failed to connect or consume from RabbitMQ / DB check failed:', { error: error.message, stack: error.stack });
        // Implement proper shutdown or retry logic
        await closeConnections(true); // Attempt cleanup
        logger.info('Retrying connection in 10 seconds...');
        setTimeout(connectAndConsume, 10000); // Simple retry delay
    }
}

// --- Connection Handling, Error Handling, & Shutdown ---

let isShuttingDown = false; // Prevent duplicate shutdown attempts

/**
 * Handles RabbitMQ connection errors.
 *
 * Logs the error and relies on the 'close' event handler for reconnection.
 * @param {Error} err - The error object. */
function handleRabbitError(err) {
    logger.error('RabbitMQ connection error:', { errorMessage: err.message, stack: err.stack });
    // Connection is likely closed already or will be soon. The 'close' handler will attempt reconnection.
    // No need to call closeConnections here, may interfere with close handler.
}

/**
 * Handles the RabbitMQ connection close event. */
function handleRabbitClose() {
    if (isShuttingDown) return; // Already handling shutdown
    logger.warn('RabbitMQ connection closed.');
    consumerTag = null; // Invalidate consumer tag
    channel = null; // Clear channel and connection
    connection = null;
    // Implement robust reconnection strategy (e.g., exponential backoff)
    logger.info('Attempting RabbitMQ reconnection in 10 seconds...');
    setTimeout(connectAndConsume, 10000); // Simple retry delay
}

/**
 * Closes all open connections (RabbitMQ channel, connection, and database) and performs cleanup.
 *
 * This function is used during shutdown and also during error recovery.
 * It handles cases where connections might already be closed or not yet established.
 *
 * @param {boolean} [attemptReconnect=false] - Whether this is part of a reconnect attempt (true) or final shutdown (false). */
async function closeConnections(attemptReconnect = false) {
    if (isShuttingDown && !attemptReconnect) return; // Prevent multiple shutdowns unless it's for a retry
    isShuttingDown = !attemptReconnect; // Set flag if it's a final shutdown

    logger.info('Closing connections...');

    // 1. Stop consuming new messages
    if (channel && consumerTag) {
        try {
            logger.info(`Cancelling consumer: ${consumerTag}`);
            await channel.cancel(consumerTag);
            logger.info('Consumer cancelled.');
        } catch (err) {
             logger.error('Error cancelling consumer:', { errorMessage: err.message });
        }
        consumerTag = null;
    } else {
        logger.info('No active consumer to cancel.');
    }

    // 2. Close RabbitMQ channel
    if (channel) {
        try {
            await channel.close();
            logger.info('RabbitMQ channel closed.');
        } catch (err) {
            logger.error('Error closing RabbitMQ channel:', { errorMessage: err.message });
        }
        channel = null;
    }

    // 3. Close RabbitMQ connection
    if (connection) {
        try {
            // Remove listeners before closing to prevent handleRabbitClose triggering reconnect during shutdown
            connection.off('error', handleRabbitError);
            connection.off('close', handleRabbitClose);
            await connection.close();
            logger.info('RabbitMQ connection closed.');
        } catch (err) {
            logger.error('Error closing RabbitMQ connection:', { errorMessage: err.message });
        }
        connection = null;
    }

     // 4. Close Database connection
     if (db && db.sequelize) {
         try {
             await db.sequelize.close();
             logger.info('Database connection closed.');
         } catch (err) {
             logger.error('Error closing database connection:', { errorMessage: err.message });
         }
     }

    logger.info('Connections closed.');
    if (isShuttingDown) {
        process.exit(0); // Exit if it was a final shutdown
    }
}

/**
 * Gracefully handle signals and exceptions to ensure cleanup and orderly shutdown.
 * SIGTERM, SIGINT, unhandledRejection, uncaughtException
 */
// Graceful shutdown handlers
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM signal.');
    closeConnections();
});
process.on('SIGINT', () => {
    logger.info('Received SIGINT signal (Ctrl+C).');
    closeConnections();
});

// Handle unhandled promise rejections / uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason: reason?.message || reason });
});
process.on('uncaughtException', (error) => {
     logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
     // Consider shutting down gracefully on uncaught exceptions
     // closeConnections().then(() => process.exit(1));
     // For now, just log it. Needs careful consideration if shutdown is desired.
});


// Start the connector
logger.info('Starting Slack Connector...');
connectAndConsume();

module.exports = {
    processMessage, // Export the function for testing
    // Export other functions ONLY IF needed by other modules/tests
};
// ----------------------------------------------------


// --- Conditional start block ---
// This check ensures the following code only runs when you execute
// 'node src/connector.js', not when you 'require' this file.
if (require.main === module) {
     logger.info('Starting Slack Connector...');
     connectAndConsume(); // <--- This call is now protected
}