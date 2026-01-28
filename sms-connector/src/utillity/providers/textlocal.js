const axios = require('axios');

class TextlocalProvider {
    constructor(config) {
        this.apiKey = config.API_KEY;
        this.senderId = config.SENDER;
    }

    async send({ to, message }) {
        const params = new URLSearchParams({
            apikey: this.apiKey,
            numbers: to,
            sender: this.senderId,
            message
        });

        return axios.post('https://api.textlocal.in/send/', params);
    }
}

module.exports = TextlocalProvider;
