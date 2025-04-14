// ./email-connector/config/database.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const config = require('../src/config');

const dbConfig = {
  development: {
    username: process.env.POSTGRES_USER || 'user',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'notifications_db',
    host: process.env.DB_HOST || 'postgres',
    dialect: 'postgres',
  },
  test: {
    username: process.env.POSTGRES_USER || 'user',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'notifications_db',
    host: process.env.DB_HOST || 'postgres',
    dialect: 'postgres',
  },
  production: {
    username: process.env.POSTGRES_USER || 'user',
    password: process.env.POSTGRES_PASSWORD || 'password',
    database: process.env.POSTGRES_DB || 'notifications_db',
    host: process.env.DB_HOST || 'postgres',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // Only for self-signed certificates
      },
    },
  },
};

module.exports = dbConfig;