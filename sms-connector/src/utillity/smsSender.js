const TextlocalProvider = require("./providers/textlocal");
const MSG91Provider = require("./providers/msg91");
const TwilioProvider = require("./providers/twilio");

class SmsSender {
    constructor(clientConfig) {
        this.clientConfig = clientConfig;
        this.provider = null;
        this.sender = null;
        this.stat = null;
    }

    async initialize() {
        const providers = {
            TEXTLOCAL: TextlocalProvider,
            MSG91: MSG91Provider,
            TWILIO: TwilioProvider,
        };

        for (const [key, ProviderClass] of Object.entries(providers)) {
            console.log(ProviderClass);
            if (this.clientConfig?.[key]) {
                const instance = new ProviderClass(this.clientConfig[key]);
                this.sender = instance.send.bind(instance);
                this.stat = instance.getBalance.bind(instance);
                this.provider = key;
                return;
            }
        }

        // throw new Error('No valid SMS service configuration found');
    }

    async sendSms({ to, message }) {
        if (!this.sender) throw new Error("SMS sender not initialized");
        try {
            const result = await this.sender({ to, message });
            console.log(
                `SMS sent via ${this.provider}:`,
                result.data || result.sid || result
            );
            return result;
        } catch (error) {
            console.error(
                `Error sending SMS via ${this.provider}:`,
                error.response?.data || error.message
            );
            throw error;
        }
    }
}

module.exports = SmsSender;
