// ./notification-api/config/config.js
/**
 * @fileoverview Configuration file for database connections in different environments.
 * This file manages the settings for connecting to PostgreSQL databases,
 * handling environment variables, and configuring database pools.
 */

/**
 * Load environment variables from the root .env file.
 * It prioritizes the root .env file, allowing a local .env file
 * (if present) to override the settings defined in the root.
 */
require("dotenv").config({
  path: require("path").resolve(__dirname, "../../.env"),
}); // Path relative to config.js
// require('dotenv').config(); // Uncomment if you have a specific .env in notification-api

/**
 * Determine the database host based on the environment.
 * In production, it defaults to 'postgres' (likely a Docker service name).
 * In other environments, it defaults to 'localhost'.
 */
const dbHost =
  process.env.DB_HOST ||
  (process.env.NODE_ENV === "production" ? "postgres" : "localhost");
// ^ Smart default: 'postgres' when in production (likely Docker), 'localhost' otherwise. Adjust if needed.

/** @type {import('sequelize').Options} */

module.exports = {
  development: {
    username: process.env.POSTGRES_USER || "intern",
    password: process.env.POSTGRES_PASSWORD || "intern123",
    database: process.env.POSTGRES_DB || "notifications_db",
    port: process.env.POSTGRES_PORT || 5432,
    host: dbHost, // Use calculated host
    dialect: "postgres",
    dialectOptions: {
      // ssl: { // Uncomment and configure if using SSL
      //   require: true,
      //   rejectUnauthorized: false // Adjust as needed for your cert setup
      // }
    },
    /**
     * Logging SQL queries.
     * Controlled by the SEQ_LOGGING environment variable.
     * Logs to console.log if enabled, otherwise no logging.
     */
    logging: process.env.SEQ_LOGGING === "true" ? console.log : false, // Control logging via env var
    /**
     * Connection pool settings.
     * Defines the pool's maximum and minimum connections,
     * along with connection timeout settings.
     */
    pool: {
      max: 5, // Max number of connections in the pool
      min: 0, // Min number of connections in the pool
      acquire: 30000, // Max time (ms) that pool will try to get connection before throwing error
      idle: 10000, // Max time (ms) that a connection can be idle before being released
    },
  },
  test: {
    // Configure for tests (e.g., use sqlite or a test DB)
    username: process.env.POSTGRES_USER || "user",
    password: process.env.POSTGRES_PASSWORD || "password",
    database: process.env.POSTGRES_DB_TEST || "notifications_db_test",
    host: process.env.DB_HOST || "localhost", // Usually localhost for local tests
    port: process.env.POSTGRES_PORT || 5432,
    dialect: "postgres",
    /**
     * Disable logging for tests unless debugging.
     */
    logging: false,
  },
  production: {
    /**
     * Configuration for production environment.
     */
    // Use environment variables exclusively in production
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.DB_HOST, // Should be set explicitly in prod env (e.g., 'postgres' service name or external host)
    port: process.env.POSTGRES_PORT || 5432,
    dialect: "postgres",
    logging: false, // Usually disable logging in prod unless needed
    /**
     * Highly recommended for production connections.
     * Requires SSL configuration.
     */
    dialectOptions: {
      ssl: {
        require: true,
        /**
         * Default to true unless explicitly set to 'false'.
         */
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
      },
    },
    /**
     * Tune pool settings for production load.
     */
    pool: {
      // Tune pool settings for production load
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
      min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 1,
      acquire: 30000,
      idle: 10000,
    },
  },
};
