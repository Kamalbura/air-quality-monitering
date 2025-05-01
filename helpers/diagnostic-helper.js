/**
 * Enhanced Diagnostic Helper for Air Quality Monitoring System
 * Provides comprehensive system diagnostics, connectivity tests, and health monitoring
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');

// Import services and helpers
let configService, errorHandler;
try {
  configService = require('../services/config-service');
} catch (err) {
  console.error('Failed to load config service:', err.message);
}

try {
  const ErrorHandler = require('../error-handler');
  errorHandler = new ErrorHandler();
} catch (err) {
  console.error('Failed to load error handler:', err.message);
}

// Constants
const LOG_FILE = path.join(__dirname, '..', 'logs', 'diagnostic.log');
const THINGSPEAK_BASE_URL = 'https://api.thingspeak.com';
const DIAGNOSTIC_FILE = path.join(__dirname, '..', 'logs', 'system-diagnostics.json');

/**
 * Ensure the log directory exists
 */
function ensureLogDirectory() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Append to log file
 * @param {string} message - Log message
 * @param {string} level - Log level (info, warn, error)
 */
function log(message, level = 'info') {
  ensureLogDirectory();
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry, { encoding: 'utf8' });
}

/**
 * Test ThingSpeak connectivity
 * @param {string} channelId - ThingSpeak channel ID
 * @param {string} readApiKey - ThingSpeak read API key
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Test results
 */
async function testThingSpeakConnectivity(channelId, readApiKey, options = {}) {
  log(`Testing ThingSpeak connectivity to channel ${channelId}`);
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    success: false,
    overallStatus: 'unknown'
  };
  
  try {
    // Use config values if not provided
    if (!channelId && configService) {
      channelId = configService.getConfigValue('thingspeak.channelId');
      log(`Using configured channel ID: ${channelId}`);
    }
    
    if (!readApiKey && configService) {
      readApiKey = configService.getConfigValue('thingspeak.readApiKey');
      log(`Using configured API key`);
    }
    
    if (!channelId || !readApiKey) {
      throw new Error('Missing required ThingSpeak credentials');
    }
    
    // Test 1: Get channel status
    let start = Date.now();
    try {
      const statusRes = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${channelId}/status.json`, {
        params: { api_key: readApiKey },
        timeout: options.timeout || 5000
      });
      
      results.tests.push({
        name: 'Channel Status',
        endpoint: '/status.json',
        status: statusRes.status,
        time: Date.now() - start,
        success: true
      });
      
      log(`Status test passed: ${statusRes.status}`);
    } catch (err) {
      const errorInfo = handleNetworkError(err, 'ThingSpeak Status Test');
      
      results.tests.push({
        name: 'Channel Status',
        endpoint: '/status.json',
        error: err.message,
        errorType: errorInfo.errorType,
        errorId: errorInfo.errorId,
        time: Date.now() - start,
        success: false
      });
      
      log(`Status test failed: ${err.message}`, 'error');
    }
    
    // Test 2: Get single feed
    start = Date.now();
    try {
      const feedRes = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${channelId}/feeds.json`, {
        params: { api_key: readApiKey, results: 1 },
        timeout: options.timeout || 5000
      });
      
      results.tests.push({
        name: 'Single Feed',
        endpoint: '/feeds.json',
        status: feedRes.status,
        time: Date.now() - start,
        hasData: feedRes.data?.feeds?.length > 0,
        dataAge: feedRes.data?.feeds?.[0]?.created_at ? 
          calculateDataAge(feedRes.data.feeds[0].created_at) : null,
        success: true
      });
      
      log(`Feed test passed: ${feedRes.data?.feeds?.length || 0} records`);
    } catch (err) {
      const errorInfo = handleNetworkError(err, 'ThingSpeak Feed Test');
      
      results.tests.push({
        name: 'Single Feed',
        endpoint: '/feeds.json',
        error: err.message,
        errorType: errorInfo.errorType,
        errorId: errorInfo.errorId,
        time: Date.now() - start,
        success: false
      });
      
      log(`Feed test failed: ${err.message}`, 'error');
    }
    
    // Test 3: Get channel info
    start = Date.now();
    try {
      const infoRes = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${channelId}.json`, {
        params: { api_key: readApiKey },
        timeout: options.timeout || 5000
      });
      
      results.tests.push({
        name: 'Channel Info',
        endpoint: '/channels.json',
        status: infoRes.status,
        time: Date.now() - start,
        channelName: infoRes.data?.channel?.name,
        fields: infoRes.data?.channel?.field1 ? getChannelFields(infoRes.data.channel) : [],
        success: true
      });
      
      log(`Info test passed: Channel name: ${infoRes.data?.channel?.name || 'unknown'}`);
    } catch (err) {
      const errorInfo = handleNetworkError(err, 'ThingSpeak Channel Info Test');
      
      results.tests.push({
        name: 'Channel Info',
        endpoint: '/channels.json',
        error: err.message,
        errorType: errorInfo.errorType,
        errorId: errorInfo.errorId,
        time: Date.now() - start,
        success: false
      });
      
      log(`Info test failed: ${err.message}`, 'error');
    }
    
    // Check DNS resolution
    start = Date.now();
    try {
      const result = await new Promise((resolve, reject) => {
        dns.lookup('api.thingspeak.com', (err, address) => {
          if (err) reject(err);
          else resolve(address);
        });
      });
      
      results.tests.push({
        name: 'DNS Resolution',
        host: 'api.thingspeak.com',
        resolved: result,
        time: Date.now() - start,
        success: true
      });
      
      log(`DNS test passed: Resolved to ${result}`);
    } catch (err) {
      const errorInfo = handleNetworkError(err, 'DNS Resolution Test');
      
      results.tests.push({
        name: 'DNS Resolution',
        host: 'api.thingspeak.com',
        error: err.message,
        errorType: errorInfo.errorType,
        errorId: errorInfo.errorId,
        time: Date.now() - start,
        success: false
      });
      
      log(`DNS test failed: ${err.message}`, 'error');
    }
    
    // Network latency test
    if (options.latencyTest !== false) {
      await testNetworkLatency(results);
    }
    
    // Get system info
    results.systemInfo = await getSystemInfo();
    
    // Check network interfaces
    results.networkInfo = {
      interfaces: getNetworkInterfaces(),
      hostname: os.hostname(),
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true
    };
    
    // Get configuration summary if available
    if (configService) {
      try {
        results.configInfo = configService.getConfigStats();
      } catch (err) {
        log(`Failed to get config stats: ${err.message}`, 'error');
      }
    }
    
    // Determine overall status
    const successfulTests = results.tests.filter(t => t.success).length;
    if (successfulTests === results.tests.length) {
      results.overallStatus = 'healthy';
      results.success = true;
    } else if (successfulTests > 0) {
      results.overallStatus = 'partial';
      results.success = false;
    } else {
      results.overallStatus = 'failed';
      results.success = false;
    }
    
    log(`Overall status: ${results.overallStatus}`);
    
    // Save diagnostic results to file for later analysis
    try {
      saveDiagnosticResults(results);
    } catch (err) {
      log(`Failed to save diagnostic results: ${err.message}`, 'error');
    }
    
    return results;
    
  } catch (error) {
    log(`Test failed with error: ${error.message}`, 'error');
    
    let errorInfo = { errorType: 'UNKNOWN', message: error.message };
    if (errorHandler) {
      errorInfo = errorHandler.handleError(error, 'DiagnosticHelper');
    }
    
    results.error = error.message;
    results.errorId = errorInfo.errorId;
    results.errorType = errorInfo.errorType;
    results.overallStatus = 'error';
    results.success = false;
    
    // Still try to get system info even if tests failed
    try {
      results.systemInfo = await getSystemInfo();
      results.networkInfo = {
        interfaces: getNetworkInterfaces(),
        hostname: os.hostname()
      };
    } catch (err) {
      log(`Failed to get system info: ${err.message}`, 'error');
    }
    
    // Save diagnostic results even in case of error
    try {
      saveDiagnosticResults(results);
    } catch (err) {
      log(`Failed to save diagnostic results: ${err.message}`, 'error');
    }
    
    return results;
  }
}

/**
 * Extract field definitions from a ThingSpeak channel
 * @param {Object} channel - ThingSpeak channel object
 * @returns {Array} Array of field objects
 */
function getChannelFields(channel) {
  if (!channel) return [];
  
  const fields = [];
  for (let i = 1; i <= 8; i++) {
    const fieldName = `field${i}`;
    if (channel[fieldName]) {
      fields.push({
        id: fieldName,
        name: channel[fieldName]
      });
    }
  }
  
  return fields;
}

/**
 * Calculate age of data in minutes
 * @param {string} timestamp - ISO timestamp or ThingSpeak timestamp
 * @returns {number} Age in minutes
 */
function calculateDataAge(timestamp) {
  try {
    const createdDate = new Date(timestamp);
    const now = new Date();
    const ageMs = now - createdDate;
    return Math.round(ageMs / 60000); // Convert to minutes
  } catch (err) {
    return null;
  }
}

/**
 * Test network latency to various endpoints
 * @param {Object} results - Results object to append to
 */
async function testNetworkLatency(results) {
  const endpoints = [
    { url: 'https://api.thingspeak.com', name: 'ThingSpeak API' },
    { url: 'https://www.google.com', name: 'Google' },
    { url: 'https://www.cloudflare.com', name: 'Cloudflare' }
  ];
  
  results.latencyTests = [];
  
  for (const endpoint of endpoints) {
    const start = Date.now();
    try {
      await axios.get(endpoint.url, { 
        timeout: 5000,
        headers: { 'Cache-Control': 'no-cache' }
      });
      const latency = Date.now() - start;
      
      results.latencyTests.push({
        endpoint: endpoint.name,
        url: endpoint.url,
        latency,
        success: true
      });
      
      log(`Latency test for ${endpoint.name}: ${latency}ms`);
    } catch (err) {
      results.latencyTests.push({
        endpoint: endpoint.name,
        url: endpoint.url,
        error: err.message,
        success: false
      });
      
      log(`Latency test failed for ${endpoint.name}: ${err.message}`, 'error');
    }
  }
}

/**
 * Handle network errors and categorize them
 * @param {Error} err - The error object
 * @param {string} context - Error context
 * @returns {Object} Categorized error info
 */
function handleNetworkError(err, context) {
  if (errorHandler) {
    return errorHandler.handleError(err, context);
  }
  
  // Simple fallback if error handler is not available
  let errorType = 'UNKNOWN';
  
  if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
    errorType = 'NETWORK';
  } else if (err.code === 'ETIMEDOUT' || err.response?.status === 408) {
    errorType = 'NETWORK';
  } else if (err.response?.status === 401 || err.response?.status === 403) {
    errorType = 'API';
  } else if (err.response) {
    errorType = 'API';
  }
  
  return {
    errorType,
    message: err.message
  };
}

/**
 * Get system information
 * @returns {Promise<Object>} System info
 */
async function getSystemInfo() {
  const info = {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    uptime: os.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem(),
      usagePercent: Math.round((1 - os.freemem() / os.totalmem()) * 100)
    },
    cpu: {
      count: os.cpus().length,
      model: os.cpus()[0].model,
      load: os.loadavg()
    },
    diskSpace: await checkDiskSpace(),
    nodeVersion: process.version,
    processUptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };
  
  // Try to get memory usage from process
  try {
    const memoryUsage = process.memoryUsage();
    info.processMemory = {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external
    };
  } catch (err) {
    log(`Failed to get process memory usage: ${err.message}`, 'warn');
  }
  
  return info;
}

/**
 * Check disk space
 * @returns {Promise<Object>} Disk space info
 */
async function checkDiskSpace() {
  // Simplified disk space check
  try {
    const appDir = path.resolve(__dirname, '..');
    
    // Simple disk space check for Unix systems
    if (process.platform !== 'win32') {
      return new Promise((resolve) => {
        const child = require('child_process').exec(`df -k "${appDir}"`, (error, stdout) => {
          if (error) {
            resolve({ error: error.message });
            return;
          }
          
          try {
            const lines = stdout.trim().split('\n');
            const data = lines[1].split(/\s+/);
            
            resolve({
              filesystem: data[0],
              total: parseInt(data[1]) * 1024,
              used: parseInt(data[2]) * 1024,
              available: parseInt(data[3]) * 1024,
              usagePercent: parseInt(data[4].replace('%', '')),
              mountPoint: data[5]
            });
          } catch (err) {
            resolve({ error: 'Failed to parse disk space info' });
          }
        });
      });
    }
    
    // For Windows systems, return empty object (need disk-space package for better support)
    return { platform: 'windows', note: 'Detailed disk info unavailable' };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Get network interfaces information
 * @returns {Array} Network interfaces
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = [];
  
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      if (!iface.internal) {
        result.push({
          name,
          address: iface.address,
          family: iface.family,
          mac: iface.mac
        });
      }
    });
  });
  
  return result;
}

/**
 * Save diagnostic results to file
 * @param {Object} results - Diagnostic results
 */
function saveDiagnosticResults(results) {
  ensureLogDirectory();
  
  const sanitizedResults = {
    ...results,
    timestamp: new Date().toISOString(),
    savedAt: new Date().toISOString()
  };
  
  // Remove sensitive information
  if (sanitizedResults.configInfo && sanitizedResults.configInfo.apiKeys) {
    delete sanitizedResults.configInfo.apiKeys;
  }
  
  fs.writeFileSync(
    DIAGNOSTIC_FILE,
    JSON.stringify(sanitizedResults, null, 2),
    { encoding: 'utf8' }
  );
  
  log(`Diagnostic results saved to ${DIAGNOSTIC_FILE}`);
}

/**
 * Run full system diagnostic
 * @returns {Promise<Object>} Diagnostic results
 */
async function runSystemDiagnostic() {
  log('Starting full system diagnostic', 'info');
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    components: []
  };
  
  // System info
  results.systemInfo = await getSystemInfo();
  
  // Network info
  results.networkInfo = {
    interfaces: getNetworkInterfaces(),
    hostname: os.hostname()
  };
  
  // Check critical directories
  results.directoryChecks = await checkCriticalDirectories();
  
  // ThingSpeak connectivity
  try {
    if (configService) {
      const channelId = configService.getConfigValue('thingspeak.channelId');
      const readApiKey = configService.getConfigValue('thingspeak.readApiKey');
      
      if (channelId && readApiKey) {
        const thingspeakResults = await testThingSpeakConnectivity(channelId, readApiKey);
        results.thingspeak = thingspeakResults;
      } else {
        log('Skipping ThingSpeak test - missing credentials', 'warn');
        results.thingspeak = { skipped: true, reason: 'Missing credentials' };
      }
    } else {
      log('Skipping ThingSpeak test - config service not available', 'warn');
      results.thingspeak = { skipped: true, reason: 'Config service not available' };
    }
  } catch (err) {
    log(`ThingSpeak test failed: ${err.message}`, 'error');
    results.thingspeak = { error: err.message, success: false };
  }
  
  // Check log files
  results.logFiles = await checkLogFiles();
  
  // Check error statistics if available
  if (errorHandler && typeof errorHandler.getErrorStats === 'function') {
    results.errorStats = errorHandler.getErrorStats();
  }
  
  // Check configuration if available
  if (configService) {
    results.configInfo = configService.getConfigStats();
  }
  
  // Save results
  saveDiagnosticResults(results);
  
  log('Full system diagnostic completed', 'info');
  return results;
}

/**
 * Check critical directories
 * @returns {Promise<Array>} Directory check results
 */
async function checkCriticalDirectories() {
  const criticalDirs = [
    { path: path.join(__dirname, '..', 'logs'), name: 'Logs Directory' },
    { path: path.join(__dirname, '..', 'data'), name: 'Data Directory' },
    { path: path.join(__dirname, '..', 'data', 'exports'), name: 'Data Exports Directory' },
    { path: path.join(__dirname, '..', 'config'), name: 'Config Directory' }
  ];
  
  // Add configService directories if available
  if (configService) {
    const csvUploadDir = configService.getConfigValue('dataSources.csvUploadDir');
    const dataExportDir = configService.getConfigValue('dataSources.dataExportDir');
    
    if (csvUploadDir) {
      criticalDirs.push({ path: csvUploadDir, name: 'CSV Upload Directory' });
    }
    
    if (dataExportDir) {
      criticalDirs.push({ path: dataExportDir, name: 'Data Export Directory' });
    }
  }
  
  const results = [];
  
  for (const dir of criticalDirs) {
    try {
      let stats = null;
      let exists = false;
      let writable = false;
      
      try {
        stats = fs.statSync(dir.path);
        exists = true;
      } catch (err) {
        exists = false;
      }
      
      if (exists) {
        try {
          const testFile = path.join(dir.path, `.test-${Date.now()}`);
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          writable = true;
        } catch (err) {
          writable = false;
        }
      }
      
      results.push({
        directory: dir.name,
        path: dir.path,
        exists,
        writable,
        isDirectory: stats ? stats.isDirectory() : false,
        size: stats ? stats.size : null,
        mtime: stats ? stats.mtime : null,
        success: exists && writable
      });
    } catch (err) {
      results.push({
        directory: dir.name,
        path: dir.path,
        exists: false,
        error: err.message,
        success: false
      });
    }
  }
  
  return results;
}

/**
 * Check log files
 * @returns {Promise<Array>} Log file check results
 */
async function checkLogFiles() {
  const logDir = path.join(__dirname, '..', 'logs');
  const results = [];
  
  try {
    if (!fs.existsSync(logDir)) {
      return [{ error: 'Log directory does not exist', success: false }];
    }
    
    const files = fs.readdirSync(logDir);
    const logFiles = files.filter(f => f.endsWith('.log'));
    
    for (const file of logFiles) {
      try {
        const filePath = path.join(logDir, file);
        const stats = fs.statSync(filePath);
        
        results.push({
          file,
          path: filePath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          mtime: stats.mtime,
          ageHours: Math.round((Date.now() - stats.mtime) / (1000 * 60 * 60)),
          success: true
        });
      } catch (err) {
        results.push({
          file,
          error: err.message,
          success: false
        });
      }
    }
    
    return results;
  } catch (err) {
    return [{ error: err.message, success: false }];
  }
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if a service is available
 * @param {string} url - Service URL
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Service status
 */
async function checkServiceAvailability(url, options = {}) {
  const startTime = Date.now();
  try {
    const response = await axios.get(url, { 
      timeout: options.timeout || 5000,
      validateStatus: null // Accept any status code
    });
    
    const elapsed = Date.now() - startTime;
    
    return {
      url,
      available: response.status < 500, // Consider 4xx as "available" but with an error
      status: response.status,
      statusText: response.statusText,
      responseTime: elapsed,
      success: response.status >= 200 && response.status < 300
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    let errorInfo = { errorType: 'NETWORK', message: err.message };
    
    if (errorHandler) {
      errorInfo = errorHandler.handleError(err, 'ServiceAvailabilityCheck');
    }
    
    return {
      url,
      available: false,
      error: err.message,
      errorType: errorInfo.errorType,
      errorId: errorInfo.errorId,
      responseTime: elapsed,
      success: false
    };
  }
}

module.exports = {
  log,
  testThingSpeakConnectivity,
  runSystemDiagnostic,
  checkServiceAvailability,
  getSystemInfo,
  checkLogFiles,
  checkCriticalDirectories
};
