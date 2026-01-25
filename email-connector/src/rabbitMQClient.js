const logger = require('./logger');
const amqp = require('amqplib');
require('dotenv').config();
const path = require('path');

const MAX_PROCESSING_ATTEMPTS = parseInt(
  process.env.MAX_PROCESSING_ATTEMPTS || '3',
  10,
);

module.exports = (RABBITMQ_URL, rabbitConfig) => {
  let connection = null;
  let channel = null;
  let consumerTag = null;
  let isShuttingDown = false;

  function handleRabbitError(err) {
    logger.error('RabbitMQ connection error:', {
      errorMessage: err.message,
      stack: err.stack,
    });
  }

  function handleRabbitClose() {
    if (isShuttingDown) return;
    logger.warn('RabbitMQ connection closed.');

    consumerTag = null;
    channel = null;
    connection = null;
    logger.info('Attempting RabbitMQ reconnection in 10 seconds...');
    setTimeout(connectRabbitMQ, 10000);
  }

  async function connectRabbitMQ() {
    logger.info('Connecting to RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    logger.info('RabbitMQ connected.');

    connection.on('error', handleRabbitError);
    connection.on('close', handleRabbitClose);

    logger.debug('RabbitMQ config:', {
      exchange: rabbitConfig.EXCHANGE_NAME,
      queue: rabbitConfig.QUEUE_NAME,
    });
    await channel.assertExchange(
      rabbitConfig.EXCHANGE_NAME,
      rabbitConfig.EXCHANGE_TYPE,
      { durable: true },
    );

    logger.info(`Exchange '${rabbitConfig.EXCHANGE_NAME}' asserted.`);

    const queueArgs = { durable: true };
    const q = await channel.assertQueue(rabbitConfig.QUEUE_NAME, queueArgs);
    logger.info(`Queue '${q.queue}' asserted.`);

    await channel.bindQueue(
      q.queue,
      rabbitConfig.EXCHANGE_NAME,
      rabbitConfig.ROUTING_KEY,
    );
    logger.info(
      `Queue '${q.queue}' bound to exchange '${rabbitConfig.EXCHANGE_NAME}' with key '${rabbitConfig.ROUTING_KEY}'.`,
    );

    logger.info('Testing database connection...');

    channel.prefetch(1);
    logger.info(
      `[*] Waiting for messages in queue '${q.queue}'. To exit press CTRL+C`,
    );

    const consumeResult = await channel.consume(
      q.queue,
      (msg) => processMessage(msg, channel),
      { noAck: false },
    );
    consumerTag = consumeResult.consumerTag;
    logger.info(`Consumer started with tag: ${consumerTag}`);
  }

  async function closeConnection() {
    isShuttingDown = true;
    try {
      if (consumerTag && channel) {
        await channel.cancel(consumerTag);
      }
      if (channel) {
        await channel.close();
      }
      if (connection) {
        await connection.close();
      }
      logger.info('RabbitMQ connection closed gracefully.');
    } catch (error) {
      logger.error('Error closing RabbitMQ connection:', {
        error: error.message,
      });
    } finally {
      consumerTag = null;
      channel = null;
      connection = null;
    }
  }

  async function processMessage(msg, channel) {
    if (!global.connectionManager) {
      logger.warn('Connection manager not initialized, skipping message');
      return;
    }
    if (msg === null) {
      logger.warn('Consumer received null message, possibly cancelled.');
      return;
    }

    let notificationData;
    let notificationRecord;
    const messageContent = msg.content.toString();

    try {
      notificationData = JSON.parse(messageContent);
      const {
        clientId,
        messageId,
        templateId,
        content,
        destination,
        from,
        fileId,
      } = notificationData;

      if (
        !clientId ||
        !messageId ||
        !content ||
        !content.subject ||
        !content.body ||
        !content.fromEmail ||
        !destination
      ) {
        logger.error('Invalid message format received from queue', {
          messageId,
          clientId,
        });
        channel.nack(msg, false, false);
        return;
      }

      logger.info('Received message from RabbitMQ', { messageId, clientId });
      let dbConnect = await global.connectionManager.getModels(clientId);
      const transaction = await dbConnect.sequelize.transaction();

      try {
        notificationRecord = await dbConnect.Notification.findOne({
          where: { messageId: messageId },
          lock: transaction.LOCK.UPDATE,
          transaction: transaction,
        });

        if (!notificationRecord) {
          logger.error(
            `Notification record not found in DB for messageId: ${messageId}. Discarding message.`,
            { messageId },
          );
          await transaction.commit();
          channel.nack(msg, false, false);
          return;
        }
        if (notificationRecord.status === 'sent') {
          logger.warn(
            `Notification already marked as sent. Acknowledging message.`,
            { messageId, dbId: notificationRecord.id },
          );
          await transaction.commit();
          channel.ack(msg);
          return;
        }
        if (notificationRecord.status === 'processing') {
          logger.warn(
            `Notification is already being processed. Acknowledging message.`,
            { messageId, dbId: notificationRecord.id },
          );
          await transaction.commit();
          channel.ack(msg);
          return;
        }

        if (
          notificationRecord.attempts >= MAX_PROCESSING_ATTEMPTS &&
          notificationRecord.status === 'failed'
        ) {
          logger.error(
            `Notification has reached max processing attempts (${MAX_PROCESSING_ATTEMPTS}). Marking as permanent failure.`,
            { messageId, dbId: notificationRecord.id },
          );
          notificationRecord.status = 'failed';
          notificationRecord.connectorResponse =
            (notificationRecord.connectorResponse || '') +
            ` | Max attempts reached.`;
          await notificationRecord.save({ transaction: transaction });
          await transaction.commit();
          channel.ack(msg);
          return;
        }
        logger.info(`Updating notification status to 'processing'`, {
          messageId,
          dbId: notificationRecord.id,
          attempt: notificationRecord.attempts + 1,
        });
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
        channel.nack(msg);
        return;
      }

      attachments = content.attachments;

      try {
        if (!fileId && attachments) {
          console.log(
            'Invalid file Id, error in picking donwloaded file...in rabbit mq',
          );
          channel.ack(msg, false, false);
          return;
        }

        const dir =
          content.attachments === true
            ? path.join(__dirname, 'uploads', `${fileId}.${content.extension}`)
            : undefined;
        logger.info(
          'Directory where rabbut mq picking media (if attachements === true)',
          {dir},
        );
        let emailConnect =
          await global.connectionManager.getEmailSender(clientId);
        let result = await emailConnect.sendEmail({
          to: destination,
          subject: content.subject,
          html: content.body,
          from: content.fromEmail,
          cc: content.cc,
          bcc: content.bcc,
          attachments:
            attachments === true
              ? [
                  {
                    path: dir,
                  },
                ]
              : undefined,
        });

        await dbConnect.Notification.update(
          { status: 'sent' },
          { where: { id: notificationRecord.id } },
        );
        logger.info(`Notification status updated to 'sent'`, {
          messageId,
          dbId: notificationRecord.id,
        });
        channel.ack(msg);
      } catch (processingError) {
        logger.error('Error processing email', {
          messageId,
          dbId: notificationRecord.id,
          error: processingError.message,
          stack: processingError.stack,
        });
        logger.error(`Email send failed. Updating status to 'failed'`, {
          messageId,
          dbId: notificationRecord.id,
          error: processingError.message,
        });
        await dbConnect.Notification.update(
          { status: 'failed', connectorResponse: processingError.message },
          { where: { id: notificationRecord.id } },
        );

        logger.warn(`Notification status updated to 'failed'`, {
          messageId,
          dbId: notificationRecord.id,
        });
        channel.ack(msg);
      }
    } catch (error) {
      logger.error('Critical error processing message', {
        error: error.message,
        stack: error.stack,
      });
      channel.nack(msg, false, false);
    }
  }

  return { connectRabbitMQ, closeConnection };
};
