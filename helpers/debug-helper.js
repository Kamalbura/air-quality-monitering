/**
 * Debug helper for Air Quality Monitoring system
 */
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const debugLogFile = path.join(logDir, 'debug.log');
const dataLogFile = path.join(logDir, 'data.log');

/**
 * Write debug message to log file
 * @param {string} message - Debug message
 * @param {string} source - Source of the message
 */
function log(message, source = 'general') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${source}] ${message}\n`;
  
  fs.appendFile(debugLogFile, logEntry, (err) => {
    if (err) {
      console.error('Failed to write debug log:', err);
    }
  });
  
  // Also log to console for immediate feedback
  console.log(`[DEBUG] [${source}] ${message}`);
}

/**
 * Log data sample to inspect data structure
 * @param {Object|Array} data - Data to log
 * @param {string} source - Source of the data
 */
function logDataSample(data, source = 'data-sample') {
  const timestamp = new Date().toISOString();
  const sample = typeof data === 'object' ? 
    JSON.stringify(data instanceof Array ? data.slice(0, 3) : data, null, 2) : 
    String(data);
  
  const logEntry = `[${timestamp}] [${source}] DATA SAMPLE:\n${sample}\n\n`;
  
  fs.appendFile(dataLogFile, logEntry, (err) => {
    if (err) {
      console.error('Failed to write data log:', err);
    }
  });
  
  log(`Logged data sample from ${source} to ${dataLogFile}`, 'data-logger');
}

/**
 * Reset log files
 */
function resetLogs() {
  fs.writeFileSync(debugLogFile, '');
  fs.writeFileSync(dataLogFile, '');
  log('Log files reset', 'system');
}

/**
 * Track polling operations for monitoring
 * @param {string} operationName - Name of polling operation
 * @param {number} interval - Polling interval in ms
 * @returns {function} Function to stop polling
 */
function trackPolling(operationName, interval) {
  const startTime = Date.now();
  let counter = 0;
  
  const intervalId = setInterval(() => {
    counter++;
    const elapsedSec = (Date.now() - startTime) / 1000;
    const formattedTime = elapsedSec.toFixed(1);
    
    log(`Polling ${operationName}: ${counter} iterations over ${formattedTime}s`, 'polling');
  }, interval);
  
  return () => clearInterval(intervalId);
}

module.exports = {
  log,
  logDataSample,
  resetLogs,
  trackPolling
};
