/**
 * Central error handler for air quality monitoring system
 */
const fs = require('fs');
const path = require('path');

class ErrorHandler {
  constructor(options = {}) {
    this.logErrors = options.logErrors !== false;
    this.logFile = options.logFile || path.join(__dirname, 'logs', 'error.log');
    this.consoleOutput = options.consoleOutput !== false;
    
    // Ensure log directory exists
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  
  /**
   * Handle an error
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {object} req - Express request object (optional)
   * @returns {Promise<object>} Result with error details
   */
  async handleError(error, context, req = null) {
    const timestamp = new Date().toISOString();
    const errorId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Build detailed error info
    const errorInfo = {
      id: errorId,
      timestamp,
      context,
      message: error.message || 'Unknown error',
      stack: error.stack,
      url: req ? req.originalUrl : undefined,
      method: req ? req.method : undefined,
      ip: req ? req.ip : undefined,
      userAgent: req ? req.get('User-Agent') : undefined
    };
    
    // Log to console
    if (this.consoleOutput) {
      console.error(`[${timestamp}] [${errorId}] Error in ${context}:`, error);
    }
    
    // Log to file
    if (this.logErrors) {
      try {
        const logEntry = `[${timestamp}] [${errorId}] ${context}: ${error.message}\n${error.stack || ''}\n\n`;
        fs.appendFileSync(this.logFile, logEntry);
      } catch (logError) {
        console.error('Failed to write to error log:', logError);
      }
    }
    
    // Use default error presentation
    return {
      error: true,
      errorId,
      message: error.message,
      timestamp
    };
  }
}

module.exports = ErrorHandler;
