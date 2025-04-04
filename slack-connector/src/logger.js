// ./slack-connector/src/logger.js
const winston = require('winston');
const config = require('./config'); // Assuming config is set up

const logFormat = winston.format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new winston.transports.Console()
    // Add other transports if needed
  ],
   exitOnError: false, // Do not exit on handled exceptions
});

module.exports = logger;