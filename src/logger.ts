/*
 * Logging configuration for the application (Node.js)
 */
import winston from 'winston';
import { LoggingWinston } from '@google-cloud/logging-winston';

const environment = process.env.NODE_ENV || 'development';

// --- Structured Logging for Google Cloud ---
const loggingWinston = new LoggingWinston({
    logName: `xtreamly-gmx-bot-${environment}`,
    // Cloud Run automatically associates logs with the correct resource
    // so we don't need to specify resource details here.
});

const logger = winston.createLogger({
  level: 'info',
  transports: [
    // In production, log to Google Cloud Logging
    // In development, log to the console
    environment === 'production' ? loggingWinston : new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    }),
  ],
});

export default logger;
