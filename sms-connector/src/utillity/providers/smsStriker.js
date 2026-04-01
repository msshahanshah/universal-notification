const axios = require('axios');
const logger = require('../../logger');
class SmsStrikerProvider {
  constructor(config) {
    this.username = config.USERNAME;
    this.password = config.PASSWORD;
    this.from = config.FROM;
    this.template_id = config.TEMPLATE_ID;
    this.type = config.TYPE;
  }

  async send({ to, message, templateId }) {
    try {
      // const msg = `Your OTP is ${message}. Please do not share Powered by: LINQLT`;

      const response = await axios.post(
        `https://www.smsstriker.com/API/sms.php?username=${this.username}&password=${this.password}&from=${this.from}&to=${to}&msg=${message}&type=${this.type}&template_id=${templateId}`
      );

      return response.data;
    } catch (error) {
      logger.error({
        message: error.message,
        stack: error?.stack,
      });
    }
  }

  async dummySend({ to, message }) {
    return {
      message: 'This is a dummy message',
    };
  }

  async getBalance() {
    try {
      const response = await axios.get(`https://www.smsstriker.com/API/get_balance.php?username=${this.username}&password=${this.password}`);

      return {
        provider: 'SmsStriker',
        balance: response.data,
      };
    } catch (error) {
      console.error('Error fetching balance:', error.message);
    }
  }
}

module.exports = SmsStrikerProvider;
