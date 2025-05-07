const logger = require("./logger");
const amqp = require('amqplib');
require('dotenv').config(); 
module.exports = (RABBITMQ_URL,rabbitConfig) => {
    let connection = null;
    let channel = null;
    function handleRabbitError(err) {
        logger.error('RabbitMQ connection error:', { errorMessage: err.message, stack: err.stack });
    }
    function handleRabbitClose() {
        if (isShuttingDown) return;
        logger.warn('RabbitMQ connection closed.');
    
        consumerTag = null;
        channel = null;
        connection = null;
        logger.info('Attempting RabbitMQ reconnection in 10 seconds...');
        setTimeout(connectAndConsume, 10000);
    }
    async function connectRabbitMQ() {
        logger.info('Connecting to RabbitMQ...');
        connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        logger.info('RabbitMQ connected.');

        connection.on('error', handleRabbitError);
        connection.on('close', handleRabbitClose);
        console.log(rabbitConfig);
        await channel.assertExchange(rabbitConfig.EXCHANGE_NAME,rabbitConfig.EXCHANGE_TYPE, { durable: true });

        logger.info(`Exchange '${rabbitConfig.EXCHANGE_NAME}' asserted.`);

        const queueArgs = { durable: true };
        const q = await channel.assertQueue(rabbitConfig.QUEUE_NAME, queueArgs);
        logger.info(`Queue '${q.queue}' asserted.`);

        await channel.bindQueue(q.queue,rabbitConfig.EXCHANGE_NAME,rabbitConfig.ROUTING_KEY);
        logger.info(`Queue '${q.queue}' bound to exchange '${rabbitConfig.EXCHANGE_NAME}' with key '${rabbitConfig.ROUTING_KEY}'.`);

        logger.info('Testing database connection...');


        channel.prefetch(1);
        logger.info(`[*] Waiting for messages in queue '${q.queue}'. To exit press CTRL+C`);

        const consumeResult = await channel.consume(q.queue, (msg) => processMessage(msg, channel), { noAck: false });
        consumerTag = consumeResult.consumerTag;
        logger.info(`Consumer started with tag: ${consumerTag}`);
    }
    async function processMessage(msg, channel) {
        if(!global.connectionManager){
            return;
        }
        if (msg === null) {
            logger.warn("Consumer received null message, possibly cancelled.");
            return;
        }
        
        let notificationData;
        let notificationRecord;
        const messageContent = msg.content.toString();
    
        try {
            notificationData = JSON.parse(messageContent);
            const { clientId, messageId , templateId, content, destination } = notificationData;
    
            if (!clientId||!messageId ||!content||!content.subject||!content.body ||!destination ) {
                logger.error("Invalid message format received from queue", { content: messageContent });
                channel.nack(msg, false, false);
                return;
            }
    
            logger.info('Received message from RabbitMQ', { messageId, clientId, content });
            let dbConnect=await global.connectionManager.getModels(clientId);
            const transaction = await dbConnect.sequelize.transaction();
            try {
                notificationRecord = await dbConnect.Notification.findOne({  // access Notification model dynamically
                    where: { messageId: messageId },
                    lock: transaction.LOCK.UPDATE, // Lock the row to prevent concurrent processing
                    transaction: transaction,
                });
    
                if (!notificationRecord) {
                    logger.error(`Notification record not found in DB for messageId: ${messageId}. Discarding message.`, { messageId });
                    await transaction.commit();
                    channel.nack(msg, false, false);
                    return;
                }
    
                if (notificationRecord.status === "sent") {
                    logger.warn(`Notification already marked as sent. Acknowledging message.`, { messageId, dbId: notificationRecord.id });
                    await transaction.commit();
                    channel.ack(msg);
                    return;
                }
    
                if (notificationRecord.status === "processing") {
                    logger.warn(`Notification is already being processed. Acknowledging message.`, { messageId, dbId: notificationRecord.id });
                    await transaction.commit();
                    channel.ack(msg);
                    return;
                }
    
                if (notificationRecord.attempts >= process.env.maxProcessingAttempts && notificationRecord.status === 'failed') {
                    logger.error(`Notification has reached max processing attempts (${process.env.maxProcessingAttempts}). Marking as permanent failure.`, { messageId, dbId: notificationRecord.id });
                    notificationRecord.status = "failed";
                    notificationRecord.connectorResponse = (notificationRecord.connectorResponse || '') + ` | Max attempts reached.`;
                    await notificationRecord.save({ transaction: transaction });
                    await transaction.commit();
                    channel.ack(msg);
                    return;
                }
    
                logger.info(`Updating notification status to 'processing'`, { messageId, dbId: notificationRecord.id, attempt: notificationRecord.attempts + 1 });
                notificationRecord.status = 'processing';
                notificationRecord.attempts += 1;
                await notificationRecord.save({ transaction: transaction });
                await transaction.commit();
            } catch (dbError) {
                logger.error('Database error during pre-processing', {
                    messageId,
                    dbId: notificationData?.dbId,
                    error: dbError.message,
                    stack: dbError.stack,
                });
                await transaction.rollback();
                channel.nack(msg, false, false);
                return;
            }
    
            try {
                let emailConnect=await global.connectionManager.getEmailSender(clientId);   
                await emailConnect.sendEmail({to:destination,subject: content.subject,body: content.body,undefined,from:"test@gkmit.co"}); 
                const template = await getEmailTemplate(templateId);
                const compiledTemplate = Handlebars.compile(template);
                const emailBody = compiledTemplate(message);
                const subject = 'Notification Email'; // You might want to get the subject from the template or the message object
                // --- Actual Processing (Send Email) ---\
                await sendEmail(to, subject, emailBody, messageId);
                await db.Notification.update(   // access Notification model dynamically
                    { status: "sent" },
                    { where: { id: notificationRecord.id } }
                );
                logger.info(`Notification status updated to 'sent'`, { messageId, dbId: notificationRecord.id });
                channel.ack(msg);
            } catch (processingError) {
                logger.error('Error processing email', { messageId, dbId: notificationRecord.id, error: processingError.message, stack: processingError.stack });
                // Update DB with 'failed' state and error info
                logger.error(`Slack send failed. Updating status to 'failed'`, { messageId, dbId: notificationRecord.id, error: processingError.message });
                await db.Notification.update(  // access Notification model dynamically
                    { status: 'failed', connectorResponse: processingError.message }, // Store error message
                    { where: { id: notificationRecord.id } }
                );
    
                logger.warn(`Notification status updated to 'failed'`, { messageId, dbId: notificationRecord.id });
    
                await db.Notification.update({ status: 'failed', connectorResponse: processingError.message }, { where: { id: notificationRecord.id } });
                channel.ack(msg);
            }
        } catch (error) {
            logger.error('Critical error processing message', { messageContent, error: error.message, stack: error.stack });
            channel.nack(msg, false, false);
        }
    }
    return {connectRabbitMQ}
}