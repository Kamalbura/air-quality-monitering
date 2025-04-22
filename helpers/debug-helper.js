/**
 * Debug Helper - Provides consistent logging functionality throughout the application
 */
const fs = require('fs');
const path = require('path');
const { EOL } = require('os');

// Default configuration
let config = {
  enableConsole: process.env.NODE_ENV !== 'production',
  enableFileLog: true,
  logLevel: process.env.DEBUG_LEVEL || 'info', // debug, info, warn, error
  logPath: path.join(__dirname, '..', 'logs'),
  logFilename: 'app-debug.log',
  maxLogSize: 5 * 1024 * 1024, // 5MB
  timestamp: true
};

// Create logs directory if it doesn't exist
if (!fs.existsSync(config.logPath)) {
  try {
    fs.mkdirSync(config.logPath, { recursive: true });
  } catch (err) {
    console.error('Failed to create log directory:', err);
  }
}

// Log levels with their numeric values for comparison
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

/**
 * Formats a log message with timestamp and module name
 * @param {string} message - The message to log
 * @param {string} module - The module/component name
 * @param {string} level - Log level (debug, info, warn, error)
 * @returns {string} Formatted log message
 */
function formatLogMessage(message, module, level) {
  const timestamp = config.timestamp ? new Date().toISOString() : '';
  const moduleInfo = module ? `[${module}]` : '';
  const levelInfo = level ? `[${level.toUpperCase()}]` : '';
  return `${timestamp} ${levelInfo} ${moduleInfo} ${message}`;
}

/**
 * Should the message be logged based on configured log level?
 * @param {string} level - Log level of the message
 * @returns {boolean} True if message should be logged
 */
function shouldLog(level) {
  const configuredLevelValue = LOG_LEVELS[config.logLevel] || 1; // Default to info
  const messageLevelValue = LOG_LEVELS[level] || 1;
  return messageLevelValue >= configuredLevelValue;
}

/**
 * Writes a message to the log file
 * @param {string} message - Formatted log message
 */
function writeToLogFile(message) {
  if (!config.enableFileLog) return;
  
  const logFilePath = path.join(config.logPath, config.logFilename);
  
  // Check log file size and rotate if necessary
  try {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size > config.maxLogSize) {
        const backupPath = `${logFilePath}.${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.renameSync(logFilePath, backupPath);
      }
    }
    
    // Append to log file
    fs.appendFileSync(logFilePath, message + EOL);
  } catch (err) {
    console.error('Error writing to log file:', err);
  }
}

/**
 * Log a message
 * @param {string} message - The message to log
 * @param {string} module - The module/component name (optional)
 * @param {string} level - Log level (debug, info, warn, error)
 */
function log(message, module = '', level = 'info') {
  if (!shouldLog(level)) return;
  
  const formattedMessage = formatLogMessage(message, module, level);
  
  if (config.enableConsole) {
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'debug':
        console.debug(formattedMessage);
        break;
      default:
        console.log(formattedMessage);
    }
  }
  
  writeToLogFile(formattedMessage);
}

/**
 * Updates the debug configuration
 * @param {Object} newConfig - New configuration to apply
 */
function configure(newConfig) {
  config = { ...config, ...newConfig };
  
  // Create logs directory if it was changed and doesn't exist
  if (newConfig.logPath && !fs.existsSync(config.logPath)) {
    try {
      fs.mkdirSync(config.logPath, { recursive: true });
    } catch (err) {
      console.error('Failed to create log directory:', err);
    }
  }
  
  log(`Debug configuration updated`, 'debug-helper', 'debug');
}

// Create convenience methods for different log levels
const debug = (message, module) => log(message, module, 'debug');
const info = (message, module) => log(message, module, 'info');
const warn = (message, module) => log(message, module, 'warn');
const error = (message, module) => log(message, module, 'error');

module.exports = {
  log,
  debug,
  info,
  warn,
  error,
  configure
};
