const TextlocalProvider = require("./providers/textlocal");
const MSG91Provider = require("./providers/msg91");
const TwilioProvider = require("./providers/twilio");

class SmsSender {
  constructor(clientConfig, provider = "DEFAULT") {
    this.clientConfig = clientConfig;
    this.provider = provider?.toUpperCase();
    this.sender = null;
    this.stat = null;
  }

  async initialize() {
    const providers = {
      TEXTLOCAL: TextlocalProvider,
      MSG91: MSG91Provider,
      TWILIO: TwilioProvider,
    };

    let selectedProvider = this.provider;
    if (selectedProvider === "DEFAULT") {
      const defaultProviderEntry = Object.entries(this.clientConfig).find(
        ([key, value]) => value?.default === true,
      );
      if (!defaultProviderEntry) {
        throw new Error("No default SMS provider found in clientConfig");
      }
      selectedProvider = defaultProviderEntry[0].toUpperCase();
    }
    const ProviderClass = providers[selectedProvider];

    if (!ProviderClass) {
      throw new Error(`Unknown SMS provider: ${this.provider}`);
    }

    const providerConfig = this.clientConfig?.[selectedProvider];
    if (!providerConfig) {
      throw new Error(`Configuration not found for provider ${this.provider}`);
    }
    const instance = new ProviderClass(providerConfig);

    this.sender = instance.send.bind(instance);
    this.stat = instance.getBalance.bind(instance);
  }

  async sendSms({ to, message }) {
    if (!this.sender) throw new Error("SMS sender not initialized");
    try {
      const result = await this.sender({ to, message });
      console.log(
        `SMS sent via ${this.provider}:`,
        result.data || result.sid || result,
      );
      return result;
    } catch (error) {
      console.error(
        `Error sending SMS via ${this.provider}:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }
}

module.exports = SmsSender;
