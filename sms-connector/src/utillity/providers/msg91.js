const axios = require('axios');

class MSG91Provider {
    constructor(config) {
        this.authKey = config.AUTH_KEY;
        this.senderId = config.SENDER_ID;
        this.route = config.ROUTE || '4';
    }

    async send({ to, message }) {
        const payload = {
            sender: this.senderId,
            route: this.route,
            country: '91',
            sms: [{ message, to: [to] }]
        };

        return axios.post('https://api.msg91.com/api/v2/sendsms', payload, {
            headers: {
                authkey: this.authKey,
                'Content-Type': 'application/json'
            }
        });
    }
}

module.exports = MSG91Provider;
