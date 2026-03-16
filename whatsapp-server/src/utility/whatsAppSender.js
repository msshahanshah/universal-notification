const twilio = require('twilio');
const logger = require('../logger');

class WhatsAppSender {
  constructor(clientId, clientConfig) {
    this.clientConfig = clientConfig;
    this.provider = null;
    this.sender = null;
    this.providerInitializer = {
      TWILIO: this.setupWhatsAppTwilio,
    };
    this.defaultProvider = Object.entries(this.clientConfig).find(
      ([service, config]) => {
        return config.default === true;
      },
    )[0];

    if (!this.defaultProvider) {
      throw new Error(`no default config for whatsapp for client ${clientId}`);
    }
  }

  async initialize(provider = 'default') {
    let providerKey = provider;

    if (provider === 'default') {
      providerKey = this.defaultProvider;
    }

    const initializer = this.providerInitializer[providerKey];

    if (typeof initializer === 'function') {
      await initializer.call(this);
      return;
    }

    console.error(
      'Invalid whatsapp configuration:',
      JSON.stringify(this.clientConfig, null, 2),
    );
    throw new Error(`Unsupported whatsapp provider: ${provider}`);
  }

  async setupWhatsAppTwilio() {
    const { ACCOUNT_SID, AUTH_TOKEN, FROM_NUMBER } = this.clientConfig.TWILIO;
    const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

    this.sender = async (
      {
        fromNumber,
        templateId,
        attachment,
        message,
        destination,
        contentVariables
      },
      messageId,
    ) => {
      logger.info('Sending WhatsApp via Twilio...');

      if (typeof attachment === 'object') {
        attachment = attachment.url;
      }

      if (!fromNumber) {
        fromNumber = FROM_NUMBER;
      }

      const clientId = process.env.clientList;
      const data = {
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${destination}`,
        statusCallback: `${process.env.WEBHOOK_CALLBACK_URL}/webhook/whatsapp?id=${clientId}`,
      };

      if (message) {
        data.body = message;
      }

      if (attachment) {
        data.mediaUrl = [attachment];
      }

      if (templateId) {
        data.contentSid = templateId;
      }

      if (contentVariables) {
        data.contentVariables = JSON.stringify(contentVariables);
      }

      let res = await client.messages.create(data);
      const newObj = {...res.toJSON(),referenceId: res.sid};
      return newObj;
    };

    this.provider = 'TWILIO';
  }

  async sendWhatsAppMessage(
    { fromNumber, templateId, attachment, message, destination, contentVariables },
    messageId,
  ) {
    if (!this.sender)
      throw new Error('WhatsApp message sender not initialized');
    try {
      const result = await this.sender(
        { fromNumber, templateId, attachment, message, destination, contentVariables },
        messageId,
      );
      logger.info(`SMS sent via whatsapp, provider: ${this.provider}`);
      return result;
    } catch (err) {
      logger.error(`Error in sending whatsapp message via ${this.provider}`, {error: err.message});
      throw err;
    }
  }
}

module.exports = {
  WhatsAppSender,
};
