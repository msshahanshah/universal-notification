const axios = require("axios")

class SmsStrikerProvider { 
    constructor(config){
        this.username = config.username;
        this.password = config.password;
        this.from = config.from;
    }

    async send({ to, message }) {
        const response = await axios.post(`https://www.smsstriker.com/API/sms.php?username=${this.username}&password=${this.password}&from=${this.from}&to=${to}&msg=${message}&type=1&template_id=[xxxxxxxx]`);
    }

    async dummySend({ to, message }) {
        return {
            message: "This is a dummy message"
        }
    }
}

 module.exports = SmsStrikerProvider;