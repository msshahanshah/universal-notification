// connectionManager.js
"use strict";
const rabbitManager = require("./rabbit.js");

class ConnectionManager {
  async getRabbitMQ(clientId) {
    let rabbit = await rabbitManager.getClient(clientId);
    return rabbit;
  }
}

module.exports = new ConnectionManager();
