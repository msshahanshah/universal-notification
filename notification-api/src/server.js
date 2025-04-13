// ./notification-api/src/server.js
const app = require('./app');
const config = require('./config');
const { connectRabbitMQ, closeConnection: closeRabbitMQConnection } = require('./rabbitMQClient');
const logger = require('./logger');
const db = require('../models'); // Import Sequelize instance for connection check/close

/**
 * @type {import('http').Server|null}
 */
let server;

/**
 * Starts the server by performing the following steps:
 * 1. Test the database connection.
 * 2. Connect to RabbitMQ.
 * 3. Start the HTTP server.
 *
 * @returns {Promise<void>} - Resolves when the server has started successfully or rejects on error.
 */
async function startServer() {
    try {
        // 1. Test Database Connection
        logger.info('Testing database connection...');
        await db.sequelize.authenticate(); // Check connection by trying to authenticate
        logger.info('Database connection successful.');

        // 2. Connect to RabbitMQ
        logger.info('Connecting to RabbitMQ...');
        await connectRabbitMQ();
        logger.info('RabbitMQ connection established successfully.');

        // 3. Start HTTP Server
        server = app.listen(config.port, () => {
            logger.info(`Notification API listening on port ${config.port} in ${config.env} mode`);
        });

    } catch (error) {
        logger.error('Failed to start server:', { error: error.message, stack: error.stack });
        // Attempt to close connections if they were partially opened
        await shutdown(1); // Exit with error code
    }
}

/**
 * Shuts down the server gracefully by closing the HTTP server, RabbitMQ connection, and the database connection.
 *
 * @param {number} [exitCode=0] - The exit code to use when exiting the process.
 * @returns {Promise<void>} - Resolves when all connections have been closed.
 */
async function shutdown(exitCode = 0) {
     logger.info('Shutting down server...');
     // Close HTTP server first to stop accepting new requests
     if (server) {
         await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err) {
                    logger.error('Error closing HTTP server:', err);
                    return reject(err);
                }
                logger.info('HTTP server closed.');
                resolve();
            });
            // Force close server after timeout
            setTimeout(() => reject(new Error('HTTP server close timeout')), 5000).unref();
         }).catch(err => logger.error(err.message)); // Log timeout error but continue shutdown
         server = null; // Ensure it's clear
     }

     // Close RabbitMQ connection
     await closeRabbitMQConnection().catch(err => logger.error('Error closing RabbitMQ connection:', err));

     // Close Database connection
     if (db && db.sequelize) {
         await db.sequelize.close().then(() => {
             logger.info('Database connection closed.');
         }).catch(err => logger.error('Error closing database connection:', err));
     }

     logger.info(`Shutdown complete. Exiting with code ${exitCode}.`);
     process.exit(exitCode);
}

// Handle graceful shutdown
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0)); // Catches Ctrl+C

/**  Event listener for unhandled promise rejections. */
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason: reason.message || reason });
    // Optionally shutdown on unhandled rejections
    // shutdown(1);
});
process.on('uncaughtException', (error) => {
    /** Event listener for uncaught exceptions. */
     logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
     // It's generally recommended to shutdown on uncaught exceptions
     shutdown(1);
});


startServer();