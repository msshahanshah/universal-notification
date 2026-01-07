const config = require('./config');
const logger = require('./logger');
const { sendSlackMessage } = require('./slackSender');
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

module.exports = (db) => {
    async function processMessage(authToken, msg, channel) {
        if (msg === null) {
            logger.warn("Consumer received null message, possibly cancelled.");
            return; // Should not happen with basic consume usually
        }

        let notificationData;
        let notificationRecord;
        const messageContent = msg.content.toString();

        try {
            notificationData = JSON.parse(messageContent);
            const { clientId, content, destination, messageId, service } = notificationData || {};

            // Basic validation of incoming message structure
            if (!clientId || !content || !destination || !messageId || !service || !content.message) {
                logger.error("Invalid message format received from queue", { content: messageContent });
                // Cannot update DB as we don't have IDs. Discard message.
                channel.nack(msg, false, false); // Negative ack, don't requeue (dead letter later?)
                return;
            }

            logger.info(`Received message from ${clientId} RabbitMQ`, { messageId, destination });

            // --- Idempotency Check & Processing Start ---
            const transaction = await db.sequelize.transaction(); // Start transaction
            try {
                // Find the notification, lock the row for update (using FOR UPDATE)
                notificationRecord = await db.Notification.findOne({
                    where: { messageId: messageId },
                    lock: transaction.LOCK.UPDATE, // Lock the row to prevent concurrent processing
                    transaction: transaction
                });

                if (!notificationRecord) {
                    logger.error(`Notification record not found in DB for messageId: ${messageId}. Discarding message.`, { messageId });
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
                logger.info(`Calling Slack sender`, { clientId, content, destination, messageId, service });
                sendResult = await sendSlackMessage(authToken, destination, content.message, messageId); // Pass messageId for logging

                // --- Update DB based on outcome ---
                if (sendResult.success) {
                    logger.info(`Slack send successful. Updating status to 'sent'`, { messageId, dbId: notificationRecord.id });
                    await db.Notification.update(
                        { status: 'sent', connectorResponse: JSON.stringify(sendResult.response) }, // Store Slack response ts etc.
                        { where: { id: notificationRecord.id } }
                    );
                    logger.info(`Notification status updated to 'sent'`, { messageId, dbId: notificationRecord.id });
                    channel.ack(msg); // ACKNOWLEDGE the message - successfully processed
                } else {
                    // Slack sending failed (API error, config error, etc.)
                    logger.error(`Slack send failed. Updating status to 'failed'`, { messageId, dbId: notificationRecord.id, error: sendResult.error });
                    await db.Notification.update(
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
                    error: processingError.message,
                    stack: processingError.stack
                });

                // Try to update DB to 'failed' state if possible
                if (notificationRecord) {
                    try {
                        await db.Notification.update(
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
    return processMessage;
}
