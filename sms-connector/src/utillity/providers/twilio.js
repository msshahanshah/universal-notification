const twilio = require('twilio');

class TwilioProvider {
    constructor(config) {
        this.from = config.FROM;
        this.client = twilio(config.ACCOUNT_SID, config.AUTH_TOKEN);
    }

    async send({ to, message }) {
        return this.client.messages.create({
            body: message,
            from: this.from,
            to
        });
    }
}

module.exports = TwilioProvider;
