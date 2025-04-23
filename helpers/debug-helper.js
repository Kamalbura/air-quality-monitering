/**
 * Debug Helper
 * Simple logging utility with context support
 */
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create logs directory: ${err.message}`);
  }
}

const logFilePath = path.join(logsDir, 'app.log');

// Log level hierarchy: debug < info < warn < error
const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Get configured log level from environment or default to 'info'
const configuredLevel = process.env.LOG_LEVEL && process.env.LOG_LEVEL.toLowerCase();
const currentLogLevel = logLevels[configuredLevel] !== undefined ? logLevels[configuredLevel] : logLevels.info;

/**
 * Write a log message to file
 * @param {string} message - The message to log
 * @param {string} level - Log level
 * @param {string} context - Context information
 */
function writeToFile(message, level, context) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${context || 'app'}] ${message}\n`;
    
    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    console.error(`Failed to write to log file: ${err.message}`);
  }
}

/**
 * Log a debug message
 * @param {string} message - Message to log
 * @param {string} context - Context identifier
 */
function log(message, context = 'app') {
  if (currentLogLevel <= logLevels.debug) {
    console.log(`[DEBUG] [${context}] ${message}`);
    writeToFile(message, 'debug', context);
  }
}

/**
 * Log an info message
 * @param {string} message - Message to log
 * @param {string} context - Context identifier
 */
function info(message, context = 'app') {
  if (currentLogLevel <= logLevels.info) {
    console.info(`[INFO] [${context}] ${message}`);
    writeToFile(message, 'info', context);
  }
}

/**
 * Log a warning message
 * @param {string} message - Message to log
 * @param {string} context - Context identifier
 */
function warn(message, context = 'app') {
  if (currentLogLevel <= logLevels.warn) {
    console.warn(`[WARN] [${context}] ${message}`);
    writeToFile(message, 'warn', context);
  }
}

/**
 * Log an error message
 * @param {string} message - Message to log
 * @param {string} context - Context identifier
 */
function error(message, context = 'app') {
  if (currentLogLevel <= logLevels.error) {
    console.error(`[ERROR] [${context}] ${message}`);
    writeToFile(message, 'error', context);
  }
}

module.exports = {
  log,
  info,
  warn,
  error
};
