const twilio = require("twilio");

class TwilioProvider {
    constructor(config) {
        this.from = config.FROM_NUMBER;
        this.client = twilio(config.ACCOUNT_SID, config.AUTH_TOKEN);
        this.accountSID = config.ACCOUNT_SID
    }

    async send({ to, message }) {
        console.log("message from Twilio");
        return this.client.messages.create({
            body: message,
            from: this.from,
            to,
        });
    }

    async getBalance() {
        try {
            const balance = await this.client.api.v2010.accounts(this.accountSID).balance.fetch();
            return balance;
        } catch (error) {
            console.error("Error fetching balance:", error.message);
        }
    }
}

module.exports = TwilioProvider;
