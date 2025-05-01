/**
 * Enhanced Central Error Handler for Air Quality Monitoring System
 * Provides standardized error handling, logging, recovery options, and analytics
 * with support for error patterns, rate limiting, and self-healing mechanisms
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

// Try to load optional services and helpers
let configService;
try {
  configService = require('./services/config-service');
} catch (err) {
  console.warn('Config service not available for error handler');
}

/**
 * Error categories with standard error messages and recovery strategies
 */
const ERROR_TYPES = {
  NETWORK: {
    code: 'NETWORK',
    name: 'Network Error',
    defaultMessage: 'Unable to connect to remote service',
    severity: 'medium',
    recoveryOptions: ['retry', 'offline', 'backoff'],
    retryOptions: { maxRetries: 5, backoff: true }
  },
  DATA: {
    code: 'DATA',
    name: 'Data Error',
    defaultMessage: 'Error processing data',
    severity: 'medium',
    recoveryOptions: ['fallback', 'cache', 'partial'],
    onRecovery: 'logDataIssue'
  },
  API: {
    code: 'API',
    name: 'API Error',
    defaultMessage: 'Error communicating with external API',
    severity: 'medium',
    recoveryOptions: ['retry', 'fallback', 'cache'],
    retryOptions: { maxRetries: 3 }
  },
  CONFIG: {
    code: 'CONFIG',
    name: 'Configuration Error',
    defaultMessage: 'Invalid or missing configuration',
    severity: 'high',
    recoveryOptions: ['defaults', 'restore_backup', 'partial'],
    shouldNotify: true
  },
  THINGSPEAK: {
    code: 'THINGSPEAK',
    name: 'ThingSpeak Error',
    defaultMessage: 'Error communicating with ThingSpeak',
    severity: 'medium',
    recoveryOptions: ['retry', 'local_data', 'cache'],
    retryOptions: { maxRetries: 3, delay: 2000 }
  },
  VISUALIZATION: {
    code: 'VISUALIZATION',
    name: 'Visualization Error',
    defaultMessage: 'Error generating visualization',
    severity: 'low',
    recoveryOptions: ['fallback', 'client_viz', 'simple_view'],
    onRecovery: 'useSimpleViz'
  },
  ARDUINO: {
    code: 'ARDUINO',
    name: 'Arduino Communication Error',
    defaultMessage: 'Error communicating with Arduino device',
    severity: 'high',
    recoveryOptions: ['retry', 'reset_device', 'local_data'],
    retryOptions: { maxRetries: 5, immediate: true }
  },
  VALIDATION: {
    code: 'VALIDATION',
    name: 'Validation Error',
    defaultMessage: 'Invalid data or parameters',
    severity: 'medium',
    recoveryOptions: ['sanitize', 'defaults'],
    preventable: true
  },
  PERMISSION: {
    code: 'PERMISSION',
    name: 'Permission Error',
    defaultMessage: 'Insufficient permissions for operation',
    severity: 'high',
    recoveryOptions: ['auth_refresh'],
    shouldNotify: true
  },
  STORAGE: {
    code: 'STORAGE',
    name: 'Storage Error',
    defaultMessage: 'Failed to read or write data storage',
    severity: 'high',
    recoveryOptions: ['retry', 'alternative_storage'],
    shouldNotify: true
  },
  SYSTEM: {
    code: 'SYSTEM',
    name: 'System Error',
    defaultMessage: 'Internal system error',
    severity: 'high',
    recoveryOptions: ['restart', 'diagnostics'],
    shouldNotify: true
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    name: 'Unknown Error',
    defaultMessage: 'An unexpected error occurred',
    severity: 'medium',
    recoveryOptions: ['diagnostics'],
    shouldNotify: true
  }
};

// Error code to HTTP status mapping
const ERROR_HTTP_STATUS = {
  NETWORK: 503,
  DATA: 422,
  API: 502,
  CONFIG: 500,
  THINGSPEAK: 502,
  VISUALIZATION: 500,
  ARDUINO: 503,
  VALIDATION: 400,
  PERMISSION: 403,
  STORAGE: 500,
  SYSTEM: 500,
  UNKNOWN: 500
};

class ErrorHandler {
  constructor(options = {}) {
    this.logErrors = options.logErrors !== false;
    this.logDir = path.join(__dirname, 'logs');
    this.logFile = options.logFile || path.join(this.logDir, 'error.log');
    this.statsFile = options.statsFile || path.join(this.logDir, 'error_stats.json');
    this.consoleOutput = options.consoleOutput !== false;
    this.trackStats = options.trackStats !== false;
    this.enableRecovery = options.enableRecovery !== false;
    this.notificationHelper = options.notificationHelper || null;
    this.maxErrorLogSize = options.maxErrorLogSize || 10 * 1024 * 1024; // 10MB
    this.logRotation = options.logRotation !== false;
    this.errorTypes = ERROR_TYPES;
    this.errorPatterns = new Map();
    this.recoveryCount = new Map();
    this.errorCount = new Map(); // For rate limiting
    
    // Ensure log directory exists
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Initialize error statistics
    this.errorStats = this.loadErrorStats();
    
    // Set up automatic error stats saving
    if (this.trackStats) {
      this.statsSaveInterval = setInterval(() => {
        this.saveErrorStats();
      }, 5 * 60 * 1000); // Every 5 minutes
    }
    
    // Set up log rotation if enabled
    if (this.logRotation && this.logErrors) {
      this.checkLogRotation();
    }
    
    // Load error patterns for categorization
    this.initializeErrorPatterns();
  }
  
  /**
   * Initialize error patterns for better error categorization
   */
  initializeErrorPatterns() {
    // Network errors
    this.addErrorPattern('NETWORK', 'ECONNREFUSED');
    this.addErrorPattern('NETWORK', 'ENOTFOUND');
    this.addErrorPattern('NETWORK', 'ETIMEDOUT');
    this.addErrorPattern('NETWORK', 'network error');
    this.addErrorPattern('NETWORK', 'getaddrinfo');
    this.addErrorPattern('NETWORK', 'socket hang up');
    
    // ThingSpeak specific patterns
    this.addErrorPattern('THINGSPEAK', 'thingspeak.com');
    this.addErrorPattern('THINGSPEAK', 'thingspeak rate limit');
    this.addErrorPattern('THINGSPEAK', 'channel not found');
    this.addErrorPattern('THINGSPEAK', 'invalid api key');
    
    // Data processing errors
    this.addErrorPattern('DATA', 'unexpected token');
    this.addErrorPattern('DATA', 'not valid JSON');
    this.addErrorPattern('DATA', 'cannot read property');
    this.addErrorPattern('DATA', 'undefined is not an object');
    this.addErrorPattern('DATA', 'TypeError: ');
    this.addErrorPattern('DATA', 'csv parse');
    
    // Config errors
    this.addErrorPattern('CONFIG', 'ENOENT: no such file');
    this.addErrorPattern('CONFIG', 'configuration');
    this.addErrorPattern('CONFIG', 'invalid config');
    this.addErrorPattern('CONFIG', 'missing required');
    
    // Arduino errors
    this.addErrorPattern('ARDUINO', 'serialport');
    this.addErrorPattern('ARDUINO', 'port is closed');
    this.addErrorPattern('ARDUINO', 'could not open port');
    
    // Storage errors
    this.addErrorPattern('STORAGE', 'ENOSPC');
    this.addErrorPattern('STORAGE', 'disk full');
    this.addErrorPattern('STORAGE', 'permission denied');
    this.addErrorPattern('STORAGE', 'EACCES');
    
    // Permission errors 
    this.addErrorPattern('PERMISSION', 'not authorized');
    this.addErrorPattern('PERMISSION', 'permission denied');
    this.addErrorPattern('PERMISSION', 'unauthorized');
    this.addErrorPattern('PERMISSION', 'forbidden');
    
    // Validation errors
    this.addErrorPattern('VALIDATION', 'validation failed');
    this.addErrorPattern('VALIDATION', 'required field');
    this.addErrorPattern('VALIDATION', 'invalid format');
    this.addErrorPattern('VALIDATION', 'constraint failed');
  }
  
  /**
   * Add an error pattern for categorization
   * @param {string} category - Error category 
   * @param {string} pattern - Pattern to match in lowercase
   */
  addErrorPattern(category, pattern) {
    this.errorPatterns.set(pattern.toLowerCase(), category);
  }
  
  /**
   * Clean up resources when shutting down
   */
  shutdown() {
    if (this.statsSaveInterval) {
      clearInterval(this.statsSaveInterval);
    }
    this.saveErrorStats();
  }
  
  /**
   * Check if log rotation is needed
   */
  checkLogRotation() {
    try {
      if (fs.existsSync(this.logFile)) {
        const stats = fs.statSync(this.logFile);
        if (stats.size > this.maxErrorLogSize) {
          this.rotateLog();
        }
      }
    } catch (err) {
      console.error('Error checking log rotation:', err);
    }
  }
  
  /**
   * Rotate error log file
   */
  rotateLog() {
    try {
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const rotatedFileName = `error-${timestamp}.log`;
      const rotatedFilePath = path.join(this.logDir, rotatedFileName);
      
      fs.renameSync(this.logFile, rotatedFilePath);
      console.log(`Error log rotated to ${rotatedFilePath}`);
      
      // Clean up old log files (keep only last 10)
      this.cleanupOldLogs(10);
    } catch (err) {
      console.error('Error rotating log file:', err);
    }
  }
  
  /**
   * Clean up old log files
   * @param {number} keepCount - Number of logs to keep
   */
  cleanupOldLogs(keepCount) {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(f => f.startsWith('error-') && f.endsWith('.log'))
        .map(f => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      if (files.length > keepCount) {
        const toDelete = files.slice(keepCount);
        toDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            console.log(`Deleted old log file: ${file.name}`);
          } catch (e) {
            console.error(`Failed to delete old log file ${file.name}:`, e);
          }
        });
      }
    } catch (err) {
      console.error('Error cleaning up old logs:', err);
    }
  }
  
  /**
   * Load error statistics from file
   * @returns {Object} Error statistics
   */
  loadErrorStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (err) {
      console.error('Failed to load error statistics:', err);
    }
    
    return {
      total: 0,
      byType: {},
      byContext: {},
      byHour: Array(24).fill(0),
      byDay: Array(7).fill(0),
      recentErrors: [],
      recoveryAttempts: 0,
      recoverySuccess: 0,
      patternsDetected: {},
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Save error statistics to file
   */
  saveErrorStats() {
    try {
      this.errorStats.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.statsFile, JSON.stringify(this.errorStats, null, 2));
    } catch (err) {
      console.error('Failed to save error statistics:', err);
    }
  }
  
  /**
   * Categorize an error based on message, code, and context
   * @param {Error} error - The error object
   * @param {string} context - Error context
   * @returns {string} Error type code
   */
  categorizeError(error, context) {
    if (!error) return 'UNKNOWN';
    
    // Use status code from response if available (API errors)
    if (error.response && error.response.status) {
      if (error.response.status === 401 || error.response.status === 403) {
        return 'PERMISSION';
      }
      if (error.response.status === 404) {
        return context.includes('thingspeak') ? 'THINGSPEAK' : 'API';
      }
      if (error.response.status >= 400 && error.response.status < 500) {
        return 'VALIDATION';
      }
      if (error.response.status >= 500) {
        return context.includes('thingspeak') ? 'THINGSPEAK' : 'API';
      }
    }
    
    const message = (error.message || '').toLowerCase();
    const stack = (error.stack || '').toLowerCase();
    const errorCode = error.code;
    
    // Check for direct error codes
    if (errorCode) {
      if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH'].includes(errorCode)) {
        return 'NETWORK';
      }
      if (['ENOSPC', 'EACCES', 'EPERM'].includes(errorCode)) {
        return 'STORAGE';
      }
      if (['ENOENT'].includes(errorCode) && message.includes('config')) {
        return 'CONFIG';
      }
    }
    
    // Check against error patterns
    for (const [pattern, category] of this.errorPatterns.entries()) {
      if (message.includes(pattern) || stack.includes(pattern)) {
        return category;
      }
    }
    
    // Context-based categorization as fallback
    if (context) {
      const lowerContext = context.toLowerCase();
      
      if (lowerContext.includes('thingspeak')) {
        return 'THINGSPEAK';
      }
      if (lowerContext.includes('arduino') || lowerContext.includes('serial')) {
        return 'ARDUINO';
      }
      if (lowerContext.includes('visual') || lowerContext.includes('chart')) {
        return 'VISUALIZATION';
      }
      if (lowerContext.includes('config')) {
        return 'CONFIG';
      }
      if (lowerContext.includes('api')) {
        return 'API';
      }
      if (lowerContext.includes('data') || lowerContext.includes('csv')) {
        return 'DATA';
      }
    }
    
    return 'UNKNOWN';
  }
  
  /**
   * Handle an error
   * @param {Error} error - The error to handle
   * @param {string} context - Context where the error occurred
   * @param {object} req - Express request object (optional)
   * @param {object} options - Additional options
   * @returns {object} Result with error details
   */
  handleError(error, context, req = null, options = {}) {
    const timestamp = new Date().toISOString();
    const date = new Date();
    const errorId = `ERR-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Categorize the error
    const errorType = options.errorType || this.categorizeError(error, context);
    const errorTypeInfo = this.errorTypes[errorType] || this.errorTypes.UNKNOWN;
    
    // Determine if this is a repeated error (for rate limiting)
    const errorKey = `${errorType}:${context}:${error.message}`;
    const errorState = this.getErrorState(errorKey);
    const isRepeated = errorState.count > 0;
    const isSuppressed = this.shouldSuppressError(errorState);
    
    // Build detailed error info
    const errorInfo = {
      id: errorId,
      timestamp,
      context,
      type: errorType,
      typeName: errorTypeInfo.name,
      message: error.message || errorTypeInfo.defaultMessage,
      stack: error.stack,
      severity: errorTypeInfo.severity,
      url: req ? req.originalUrl : undefined,
      method: req ? req.method : undefined,
      ip: req ? req.ip : undefined,
      userAgent: req ? req.get('User-Agent') : undefined,
      recoveryOptions: errorTypeInfo.recoveryOptions,
      httpStatus: ERROR_HTTP_STATUS[errorType] || 500,
      count: errorState.count + 1,
      repeated: isRepeated,
      suppressed: isSuppressed,
      meta: options.meta || {}
    };
    
    // Add additional info if available
    if (error.code) errorInfo.code = error.code;
    if (error.response) {
      errorInfo.responseStatus = error.response.status;
      errorInfo.responseData = error.response.data;
    }
    
    // Track error state
    this.updateErrorState(errorKey, errorInfo);
    
    // Log to console if not suppressed
    if (this.consoleOutput && !isSuppressed) {
      if (isRepeated) {
        console.error(`[${timestamp}] [${errorId}] [${errorInfo.typeName}] Repeated error (${errorInfo.count}x) in ${context}: ${error.message}`);
      } else {
        console.error(`[${timestamp}] [${errorId}] [${errorInfo.typeName}] Error in ${context}:`, error);
      }
    }
    
    // Log to file if enabled and not suppressed
    if (this.logErrors && !isSuppressed) {
      try {
        let logEntry = `[${timestamp}] [${errorId}] [${errorInfo.typeName}] ${context}: ${error.message}`;
        if (isRepeated) {
          logEntry += ` (repeated ${errorInfo.count}x)`;
        }
        if (error.stack && !isRepeated) {
          logEntry += `\n${error.stack}\n`;
        }
        if (error.response && error.response.data) {
          logEntry += `\nResponse: ${JSON.stringify(error.response.data)}\n`;
        }
        logEntry += '\n';
        
        fs.appendFileSync(this.logFile, logEntry);
        
        // Check if log rotation is needed
        if (this.logRotation) {
          this.checkLogRotation();
        }
      } catch (logError) {
        console.error('Failed to write to error log:', logError);
      }
    }
    
    // Add system context information for critical errors
    if (errorTypeInfo.severity === 'high') {
      this.addSystemContext(errorInfo);
    }
    
    // Update error statistics
    if (this.trackStats) {
      this.updateErrorStats(errorInfo, date);
    }
    
    // Attempt recovery if enabled
    let recoveryResult = null;
    if (this.enableRecovery && errorTypeInfo.recoveryOptions?.length > 0) {
      recoveryResult = this.attemptRecovery(errorInfo, options);
    }
    
    // Send notification if critical and not suppressed
    if ((errorTypeInfo.shouldNotify || options.notify) && !isSuppressed) {
      this.sendErrorNotification(errorInfo);
    }
    
    // Return structured error response
    const response = {
      error: true,
      errorId,
      errorType,
      typeName: errorTypeInfo.name,
      message: error.message || errorTypeInfo.defaultMessage,
      timestamp,
      severity: errorTypeInfo.severity,
      httpStatus: errorInfo.httpStatus
    };
    
    // Include recovery information if available
    if (recoveryResult) {
      response.recovery = {
        attempted: true,
        success: recoveryResult.success,
        strategy: recoveryResult.strategy
      };
      
      if (recoveryResult.success) {
        response.alternativeData = recoveryResult.data;
      }
    }
    
    return response;
  }
  
  /**
   * Get the current state of an error
   * @param {string} errorKey - Unique error key
   * @returns {object} Error state
   */
  getErrorState(errorKey) {
    const currentState = this.errorCount.get(errorKey) || {
      count: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      suppressed: false,
      suppressUntil: 0
    };
    return currentState;
  }
  
  /**
   * Update the state of an error
   * @param {string} errorKey - Unique error key
   * @param {object} errorInfo - Error information
   */
  updateErrorState(errorKey, errorInfo) {
    const currentState = this.getErrorState(errorKey);
    
    const newState = {
      count: currentState.count + 1,
      firstSeen: currentState.firstSeen,
      lastSeen: Date.now(),
      suppressed: currentState.suppressed,
      suppressUntil: currentState.suppressUntil
    };
    
    // Apply suppression if error rate is too high
    if (newState.count >= 10 && (newState.lastSeen - newState.firstSeen) < 60000) {
      // More than 10 errors in 1 minute, suppress for 5 minutes
      newState.suppressed = true;
      newState.suppressUntil = Date.now() + 300000; // 5 minutes
    }
    
    this.errorCount.set(errorKey, newState);
    
    // Clean up old error states occasionally
    if (Math.random() < 0.1) { // 10% chance on each error
      this.cleanupErrorStates();
    }
  }
  
  /**
   * Clean up old error states
   */
  cleanupErrorStates() {
    const now = Date.now();
    for (const [key, state] of this.errorCount.entries()) {
      // Remove error states older than 30 minutes
      if (now - state.lastSeen > 1800000) {
        this.errorCount.delete(key);
      }
    }
  }
  
  /**
   * Check if an error should be suppressed based on rate
   * @param {object} errorState - Error state
   * @returns {boolean} True if error should be suppressed
   */
  shouldSuppressError(errorState) {
    if (!errorState.suppressed) return false;
    
    const now = Date.now();
    if (now > errorState.suppressUntil) {
      // Suppression period has ended
      errorState.suppressed = false;
      return false;
    }
    
    return true;
  }
  
  /**
   * Add system context information to error
   * @param {object} errorInfo - Error information object
   */
  addSystemContext(errorInfo) {
    try {
      errorInfo.systemContext = {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        uptime: os.uptime(),
        memory: {
          free: os.freemem(),
          total: os.totalmem(),
          usedPercent: Math.round((1 - os.freemem() / os.totalmem()) * 100)
        },
        cpuLoad: os.loadavg(),
        nodeVersion: process.version,
        processUptime: process.uptime()
      };
      
      // Add environment info if available and safe
      if (process.env.NODE_ENV) {
        errorInfo.systemContext.environment = process.env.NODE_ENV;
      }
      
      // Add config info if available
      if (configService && typeof configService.getConfigStats === 'function') {
        errorInfo.configContext = configService.getConfigStats();
      }
    } catch (err) {
      console.error('Failed to add system context to error:', err);
    }
  }
  
  /**
   * Update error statistics
   * @param {object} errorInfo - Error information
   * @param {Date} date - Date when error occurred
   */
  updateErrorStats(errorInfo, date) {
    const stats = this.errorStats;
    
    // Skip repeated errors in statistics to avoid skewing the data
    // but increment a separate counter for repeated occurrences
    if (errorInfo.repeated) {
      if (!stats.repeated) stats.repeated = 0;
      stats.repeated += 1;
      return;
    }
    
    // Increment total count
    stats.total += 1;
    
    // Update by type
    if (!stats.byType[errorInfo.type]) {
      stats.byType[errorInfo.type] = 0;
    }
    stats.byType[errorInfo.type] += 1;
    
    // Update by context
    if (!stats.byContext[errorInfo.context]) {
      stats.byContext[errorInfo.context] = 0;
    }
    stats.byContext[errorInfo.context] += 1;
    
    // Update by hour (0-23)
    const hour = date.getHours();
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
    
    // Update by day (0-6, where 0 is Sunday)
    const day = date.getDay();
    stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    
    // Track patterns
    if (errorInfo.message) {
      // Create simplified pattern by removing specific values
      const pattern = errorInfo.message
        .replace(/[0-9]+/g, '{number}')
        .replace(/(['"])[^'"]*\1/g, '{string}')
        .replace(/\b[0-9a-f]{8}\b/g, '{id}')
        .replace(/\b[0-9a-f]{24}\b/g, '{objectid}');
      
      if (!stats.patternsDetected[pattern]) {
        stats.patternsDetected[pattern] = {
          count: 0,
          type: errorInfo.type,
          examples: []
        };
      }
      
      stats.patternsDetected[pattern].count += 1;
      
      // Store up to 3 examples of this pattern
      if (stats.patternsDetected[pattern].examples.length < 3) {
        stats.patternsDetected[pattern].examples.push({
          message: errorInfo.message,
          timestamp: errorInfo.timestamp,
          context: errorInfo.context
        });
      }
    }
    
    // Add to recent errors (keep last 100)
    stats.recentErrors.unshift({
      id: errorInfo.id,
      type: errorInfo.type,
      typeName: errorInfo.typeName,
      context: errorInfo.context,
      message: errorInfo.message,
      timestamp: errorInfo.timestamp,
      severity: errorInfo.severity
    });
    
    if (stats.recentErrors.length > 100) {
      stats.recentErrors = stats.recentErrors.slice(0, 100);
    }
  }
  
  /**
   * Attempt to recover from an error
   * @param {object} errorInfo - Error information
   * @param {object} options - Recovery options
   * @returns {object|null} Recovery result
   */
  attemptRecovery(errorInfo, options = {}) {
    const recoveryOptions = errorInfo.recoveryOptions || [];
    
    if (recoveryOptions.length === 0) return null;
    
    // Increment recovery attempts counter
    this.errorStats.recoveryAttempts = (this.errorStats.recoveryAttempts || 0) + 1;
    
    // Track recovery attempts per error
    const errorKey = `${errorInfo.type}:${errorInfo.context}`;
    const attempts = this.recoveryCount.get(errorKey) || 0;
    this.recoveryCount.set(errorKey, attempts + 1);
    
    // Don't attempt recovery too many times for the same error
    if (attempts >= 5) {
      console.log(`Skipping recovery for ${errorKey}: too many attempts (${attempts})`);
      return null;
    }
    
    // Try recovery strategies in order
    for (const strategy of recoveryOptions) {
      try {
        const result = this.executeRecoveryStrategy(strategy, errorInfo, options);
        if (result && result.success) {
          // Recovery succeeded
          this.errorStats.recoverySuccess = (this.errorStats.recoverySuccess || 0) + 1;
          console.log(`Recovery succeeded for ${errorInfo.id} using ${strategy}`);
          return {
            success: true,
            strategy,
            data: result.data
          };
        }
      } catch (recoveryError) {
        console.error(`Recovery strategy ${strategy} failed:`, recoveryError);
      }
    }
    
    return { success: false };
  }
  
  /**
   * Execute a specific recovery strategy
   * @param {string} strategy - Recovery strategy name
   * @param {object} errorInfo - Error information
   * @param {object} options - Additional options
   * @returns {object} Recovery result
   */
  executeRecoveryStrategy(strategy, errorInfo, options) {
    switch (strategy) {
      case 'retry':
        return this.recoveryRetry(errorInfo, options);
      
      case 'fallback':
        return this.recoveryFallback(errorInfo, options);
      
      case 'cache':
        return this.recoverFromCache(errorInfo, options);
      
      case 'offline':
        return this.switchToOfflineMode(errorInfo, options);
      
      case 'defaults':
        return this.useDefaultValues(errorInfo, options);
      
      case 'local_data':
        return this.useLocalData(errorInfo, options);
      
      case 'client_viz':
        return this.switchToClientVisualization(errorInfo, options);
      
      case 'simple_view':
        return this.useSimpleVisualization(errorInfo, options);
      
      case 'restore_backup':
        return this.restoreFromBackup(errorInfo, options);
      
      case 'diagnostics':
        return this.runDiagnostics(errorInfo, options);
      
      case 'backoff':
        return this.implementBackoffStrategy(errorInfo, options);
      
      case 'partial':
        return this.usePartialData(errorInfo, options);
        
      default:
        return { success: false, message: `Unknown recovery strategy: ${strategy}` };
    }
  }
  
  /**
   * Recovery strategy: Retry the operation
   */
  recoveryRetry(errorInfo, options) {
    if (!options.retry) {
      return { success: false, message: 'No retry function provided' };
    }
    
    const retryOptions = this.errorTypes[errorInfo.type]?.retryOptions || { maxRetries: 3 };
    
    try {
      const result = options.retry(retryOptions);
      return {
        success: true,
        data: result,
        message: 'Operation retried successfully'
      };
    } catch (err) {
      return {
        success: false,
        message: `Retry failed: ${err.message}`
      };
    }
  }
  
  /**
   * Recovery strategy: Use fallback data or handler
   */
  recoveryFallback(errorInfo, options) {
    if (options.fallbackData) {
      return {
        success: true,
        data: options.fallbackData,
        message: 'Using fallback data'
      };
    }
    
    if (options.fallbackFn) {
      try {
        const result = options.fallbackFn();
        return {
          success: true,
          data: result,
          message: 'Fallback function executed successfully'
        };
      } catch (err) {
        return {
          success: false,
          message: `Fallback function failed: ${err.message}`
        };
      }
    }
    
    return {
      success: false,
      message: 'No fallback data or function provided'
    };
  }
  
  /**
   * Recovery strategy: Get data from cache
   */
  recoverFromCache(errorInfo, options) {
    if (!options.cache) {
      return { success: false, message: 'No cache provider available' };
    }
    
    try {
      const cacheKey = options.cacheKey || `${errorInfo.context}_data`;
      const cachedData = options.cache.get(cacheKey);
      
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          cached: true,
          message: 'Retrieved data from cache'
        };
      }
      
      return {
        success: false,
        message: 'No data found in cache'
      };
    } catch (err) {
      return {
        success: false,
        message: `Cache retrieval failed: ${err.message}`
      };
    }
  }
  
  /**
   * Recovery strategy: Switch to offline mode
   */
  switchToOfflineMode(errorInfo, options) {
    if (configService) {
      try {
        // Set system to offline mode in config
        configService.setConfigValue('system.offlineMode', true);
        
        return {
          success: true,
          message: 'Switched to offline mode',
          data: { offlineMode: true }
        };
      } catch (err) {
        return {
          success: false,
          message: `Failed to switch to offline mode: ${err.message}`
        };
      }
    }
    
    return {
      success: false,
      message: 'Config service not available for offline mode'
    };
  }
  
  /**
   * Recovery strategy: Use default values
   */
  useDefaultValues(errorInfo, options) {
    // For config errors, try to reset to defaults
    if (errorInfo.type === 'CONFIG' && configService) {
      try {
        configService.resetConfig();
        return {
          success: true,
          message: 'Reset to default configuration',
          data: configService.getConfig()
        };
      } catch (err) {
        return {
          success: false,
          message: `Failed to reset config: ${err.message}`
        };
      }
    }
    
    // For other errors, use provided defaults
    if (options.defaults) {
      return {
        success: true,
        message: 'Using default values',
        data: options.defaults
      };
    }
    
    return {
      success: false,
      message: 'No default values available'
    };
  }
  
  /**
   * Recovery strategy: Use local data
   */
  useLocalData(errorInfo, options) {
    // For data errors, load from local storage
    if (!options.localDataPath && !options.getLocalData) {
      return {
        success: false,
        message: 'No local data source specified'
      };
    }
    
    try {
      let localData;
      
      if (options.getLocalData) {
        localData = options.getLocalData();
      } else if (options.localDataPath) {
        if (fs.existsSync(options.localDataPath)) {
          const data = fs.readFileSync(options.localDataPath, 'utf8');
          localData = JSON.parse(data);
        }
      }
      
      if (localData) {
        return {
          success: true,
          message: 'Using local data',
          data: localData
        };
      }
      
      return {
        success: false,
        message: 'No local data available'
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to load local data: ${err.message}`
      };
    }
  }
  
  /**
   * Recovery strategy: Switch to client-side visualization
   */
  switchToClientVisualization(errorInfo, options) {
    if (configService) {
      try {
        // Set visualization to client-side
        configService.setConfigValue('visualization.defaultEngine', 'client');
        
        return {
          success: true,
          message: 'Switched to client-side visualization',
          data: { visualizationEngine: 'client' }
        };
      } catch (err) {
        return {
          success: false,
          message: `Failed to switch visualization engine: ${err.message}`
        };
      }
    }
    
    return {
      success: true, // Can still succeed without config service
      message: 'Recommend client-side visualization',
      data: { visualizationEngine: 'client' }
    };
  }
  
  /**
   * Recovery strategy: Use simple visualization
   */
  useSimpleVisualization(errorInfo, options) {
    return {
      success: true,
      message: 'Using simplified visualization',
      data: {
        useSimpleViz: true,
        simpleChartType: options.simpleChartType || 'line'
      }
    };
  }
  
  /**
   * Recovery strategy: Restore from configuration backup
   */
  restoreFromBackup(errorInfo, options) {
    if (!configService || typeof configService.recoverFromBackup !== 'function') {
      return {
        success: false,
        message: 'Config recovery service not available'
      };
    }
    
    try {
      const recoveredConfig = configService.recoverFromBackup();
      
      if (recoveredConfig) {
        return {
          success: true,
          message: 'Recovered configuration from backup',
          data: { configRestored: true }
        };
      }
      
      return {
        success: false,
        message: 'No usable config backup found'
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to restore from backup: ${err.message}`
      };
    }
  }
  
  /**
   * Recovery strategy: Run diagnostics
   */
  runDiagnostics(errorInfo, options) {
    try {
      // Try to load diagnostic helper
      let diagnosticHelper;
      try {
        diagnosticHelper = require('./helpers/diagnostic-helper');
      } catch (err) {
        return {
          success: false,
          message: 'Diagnostic helper not available'
        };
      }
      
      // Run diagnostics in background
      setTimeout(async () => {
        try {
          const results = await diagnosticHelper.runSystemDiagnostic();
          console.log('Diagnostic completed after error:', errorInfo.id);
        } catch (err) {
          console.error('Failed to run diagnostics:', err);
        }
      }, 100);
      
      return {
        success: true,
        message: 'Diagnostics triggered',
        data: { diagnosticScheduled: true }
      };
    } catch (err) {
      return {
        success: false,
        message: `Failed to trigger diagnostics: ${err.message}`
      };
    }
  }
  
  /**
   * Recovery strategy: Implement backoff strategy
   */
  implementBackoffStrategy(errorInfo, options) {
    const errorKey = `${errorInfo.type}:${errorInfo.context}`;
    const attempts = this.recoveryCount.get(errorKey) || 0;
    
    // Calculate exponential backoff
    const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000);
    
    return {
      success: true,
      message: `Implemented backoff strategy (${backoffMs}ms)`,
      data: {
        backoffMs,
        attempts,
        nextRetry: new Date(Date.now() + backoffMs).toISOString()
      }
    };
  }
  
  /**
   * Recovery strategy: Use partial data
   */
  usePartialData(errorInfo, options) {
    if (!options.partialData) {
      return {
        success: false,
        message: 'No partial data available'
      };
    }
    
    return {
      success: true,
      message: 'Using partial data',
      data: options.partialData,
      isPartial: true
    };
  }
  
  /**
   * Send notification for critical errors
   * @param {object} errorInfo - Error information
   */
  sendErrorNotification(errorInfo) {
    // Skip if notification helper not available
    if (!this.notificationHelper) return;
    
    try {
      if (typeof this.notificationHelper.sendErrorNotification === 'function') {
        this.notificationHelper.sendErrorNotification(errorInfo);
      }
    } catch (notifyError) {
      console.error('Failed to send error notification:', notifyError);
    }
  }
  
  /**
   * Get error statistics
   * @param {Object} options - Options for stats retrieval
   * @returns {Object} Error statistics
   */
  getErrorStats(options = {}) {
    const stats = { ...this.errorStats };
    stats.lastUpdated = new Date().toISOString();
    
    // Add active error suppression info
    stats.suppressedErrors = [];
    for (const [key, state] of this.errorCount.entries()) {
      if (state.suppressed && state.suppressUntil > Date.now()) {
        stats.suppressedErrors.push({
          key,
          count: state.count,
          firstSeen: new Date(state.firstSeen).toISOString(),
          lastSeen: new Date(state.lastSeen).toISOString(),
          suppressedUntil: new Date(state.suppressUntil).toISOString()
        });
      }
    }
    
    // If detailed option is false, remove detailed data
    if (options.detailed === false) {
      delete stats.recentErrors;
      delete stats.patternsDetected;
      delete stats.suppressedErrors;
    }
    
    return stats;
  }
  
  /**
   * Clear error statistics
   * @returns {Object} Empty error stats
   */
  clearErrorStats() {
    this.errorStats = {
      total: 0,
      byType: {},
      byContext: {},
      byHour: Array(24).fill(0),
      byDay: Array(7).fill(0),
      recentErrors: [],
      recoveryAttempts: 0,
      recoverySuccess: 0,
      patternsDetected: {},
      lastUpdated: new Date().toISOString()
    };
    this.saveErrorStats();
    return this.errorStats;
  }
  
  /**
   * Get error codes mapping
   * @returns {Object} Map of error types to HTTP status codes
   */
  getErrorCodes() {
    return ERROR_HTTP_STATUS;
  }
  
  /**
   * Get recovery options for an error type
   * @param {string} errorType - Error type code
   * @returns {Array|null} Recovery options or null if not found
   */
  getRecoveryOptions(errorType) {
    const errorTypeInfo = this.errorTypes[errorType];
    if (!errorTypeInfo) return null;
    return errorTypeInfo.recoveryOptions;
  }
  
  /**
   * Create an HTTP response from error result
   * @param {object} errorResult - Result from handleError
   * @param {object} res - Express response object
   */
  sendErrorResponse(errorResult, res) {
    const statusCode = errorResult.httpStatus || 500;
    res.status(statusCode).json({
      error: true,
      errorId: errorResult.errorId,
      message: errorResult.message,
      type: errorResult.errorType
    });
  }
}

module.exports = ErrorHandler;
