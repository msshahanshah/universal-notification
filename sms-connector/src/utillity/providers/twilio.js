const twilio = require('twilio');

class TwilioProvider {
    constructor(config) {
        this.from = config.FROM_NUMBER;
        this.client = twilio(config.ACCOUNT_SID, config.AUTH_TOKEN);
    }

    async send({ to, message }) {
        return this.client.messages.create({
            body: message,
            messagingServiceSid: this.from,
            to
        });
    }
}

module.exports = TwilioProvider;
