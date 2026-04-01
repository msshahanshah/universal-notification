const axios = require('axios');
const logger = require('../../logger');
class Fast2Sms {
  constructor(config) {
    this.apiKey = config.API_KEY;
  }

  async send({ to, message, templateId }) {
    try {
      const res = await axios({
        method: 'POST',
        url: 'https://www.fast2sms.com/dev/bulkV2',
        headers: {
          authorization: this.apiKey,
          'Content-Type': 'application/json',
        },
        data: {
          route: 'q',
          message: message,
          language: 'english',
          numbers: to,
        },
      });

      console.log(res.data);
      return res.data;
    } catch (err) {
      console.log('Fast2SMS ERROR →', err.response?.data);
      throw err;
    }
  }

  async dummySend({ to, message }) {
    return {
      message: 'This is a dummy message',
    };
  }

  async getBalance() {
    try {
      const res = await axios.get('https://www.fast2sms.com/dev/wallet', {
        headers: {
          authorization: this.apiKey,
          accept: 'application/json',
        },
      });

      console.log(res.data);
      return res.data;
    } catch (err) {
      console.log(err.response?.data);
      throw err;
    }
  }
}

module.exports = Fast2Sms;
