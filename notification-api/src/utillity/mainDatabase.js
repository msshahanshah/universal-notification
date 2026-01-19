"use strict";

const { Sequelize } = require("sequelize");

class GlobalDatabaseManager {
  constructor() {}

  async initializeSequelize() {
    const sequelize = new Sequelize({
      dialect: "postgres",
      host: process.env.POSTGRES_HOST,
      port: process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      username: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      schema: "public",
      logging: (msg) => console.log(`Global Sequelize: ${msg}`),
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    });

    console.log(`Testing global database connection...`);
    await sequelize.authenticate();
    console.log(`Database global connection successful.`);

    const User = await require("../../models/user")(sequelize, Sequelize);
    return { User };
  }

  async getModels() {
    const db = await this.initializeSequelize();
    return db;
  }
}
module.exports = new GlobalDatabaseManager();
