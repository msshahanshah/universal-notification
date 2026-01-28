// ./notification-api/src/logger.js
/**
 * @module logger
 * @description Configures and exports a Winston logger instance for application logging.
 */
const winston = require('winston');
const config = require('./config');

/**
 * @function logFormat
 * @description Custom log format that includes timestamp, log level, and the log message (or stack trace).
 * @param {object} info - The log information object.
 * @param {string} info.level - The log level (e.g., 'error', 'info', 'debug').
 * @param {string} info.message - The log message.
 * @param {string} info.timestamp - The timestamp of the log event.
 * @param {string} [info.stack] - The stack trace (if available).
 * @returns {string} The formatted log message.
 */
const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
  /** @type {string} */
  level: config.env === 'development' ? 'debug' : 'info', // Log level based on environment
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // Log stack traces
    logFormat
  ),
  transports: [
    new winston.transports.Console()
    // Add other transports like file or centralized logging service if needed
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

/**
 * @type {winston.Logger}
 * @description The configured Winston logger instance.
 * @exports logger
 */
module.exports = logger;
