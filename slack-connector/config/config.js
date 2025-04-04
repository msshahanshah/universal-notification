// ./notification-api/config/config.js
// *** This should be a .js file, not .json ***

// Load environment variables from the root .env file first,
// then potentially from a local .env if needed (local overrides root)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') }); // Path relative to config.js
// require('dotenv').config(); // Uncomment if you have a specific .env in notification-api

const dbHost = process.env.DB_HOST || (process.env.NODE_ENV === 'production' ? 'postgres' : 'localhost');
// ^ Smart default: 'postgres' when in production (likely Docker), 'localhost' otherwise. Adjust if needed.

module.exports = {
  development: {
    username: process.env.POSTGRES_USER || "user",
    password: process.env.POSTGRES_PASSWORD || "password",
    database: process.env.POSTGRES_DB || "notifications_db",
    host: dbHost, // Use calculated host
    dialect: "postgres",
    dialectOptions: {
      // ssl: { // Uncomment and configure if using SSL
      //   require: true,
      //   rejectUnauthorized: false // Adjust as needed for your cert setup
      // }
    },
    // Optional: Logging SQL queries (can be noisy)
    logging: process.env.SEQ_LOGGING === 'true' ? console.log : false, // Control logging via env var
    // Recommended: Configure connection pool settings
    pool: {
      max: 5, // Max number of connection in pool
      min: 0, // Min number of connection in pool
      acquire: 30000, // Max time (ms) that pool will try to get connection before throwing error
      idle: 10000 // Max time (ms) that a connection can be idle before being released
    }
  },
  test: {
    // Configure for tests (e.g., use sqlite or a test DB)
    username: process.env.POSTGRES_USER || "user",
    password: process.env.POSTGRES_PASSWORD || "password",
    database: process.env.POSTGRES_DB_TEST || "notifications_db_test",
    host: process.env.DB_HOST || "localhost", // Usually localhost for local tests
    dialect: "postgres",
    logging: false // Disable logging for tests unless debugging
  },
  production: {
    // Use environment variables exclusively in production
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    host: process.env.DB_HOST, // Should be set explicitly in prod env (e.g., 'postgres' service name or external host)
    dialect: "postgres",
    logging: false, // Usually disable logging in prod unless needed
    dialectOptions: {
      ssl: { // Highly recommended for production connections
        require: true,
        // Adjust based on your CA / SSL certificate setup
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' // Default to true unless explicitly set to 'false'
      }
    },
    pool: { // Tune pool settings for production load
      max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 10,
      min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 1,
      acquire: 30000,
      idle: 10000
    }
  }
};