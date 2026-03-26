const twilio = require("twilio");

class TwilioProvider {
  constructor(config) {
    this.from = config.FROM_NUMBER;
    this.client = twilio(config.ACCOUNT_SID, config.AUTH_TOKEN);
    this.accountSID = config.ACCOUNT_SID
  }

  async send({ to, message, templateId }) {
    const data = {
      body: message,
      from: this.from,
      to,
    }

    const webHookCallbackUrl = process.env.BACKEND_API_URL;
    console.log(webHookCallbackUrl);

    if (webHookCallbackUrl) {
      data["statusCallback"] =
        `${process.env.BACKEND_API_URL}/webhook/sms?id=GKMIT&provider=TWILIO`;
    }

    let res = await this.client.messages.create(data);
    res = { ...res.toJSON(), referenceId: res.sid };
    // console.log(res)
    return res;
  }

  async dummySend({ to, message }) {
    return {
      message: "This is a dummy message"
    }
  }

  async getBalance() {
    try {
      const balance = await this.client.api.v2010
        .accounts(this.accountSID)
        .balance.fetch();
      return balance;
    } catch (error) {
      console.error("Error fetching balance:", error.message);
    }
  }
}

module.exports = TwilioProvider;
