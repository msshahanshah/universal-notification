// ./notification-api/src/logger.js
const winston = require('winston');
const config = require('./config');

const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
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

module.exports = logger;