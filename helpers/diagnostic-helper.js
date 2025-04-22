/**
 * Diagnostic helper for troubleshooting API connections
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dns = require('dns');

// Configuration
const LOG_FILE = path.join(__dirname, '..', 'logs', 'diagnostic.log');
const THINGSPEAK_BASE_URL = 'https://api.thingspeak.com';

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
 */
function log(message) {
  ensureLogDirectory();
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logEntry, { encoding: 'utf8' });
}

/**
 * Test ThingSpeak connectivity
 * @param {string} channelId - ThingSpeak channel ID
 * @param {string} readApiKey - ThingSpeak read API key
 * @returns {Promise<Object>} Test results
 */
async function testThingSpeakConnectivity(channelId, readApiKey) {
  log(`Testing ThingSpeak connectivity to channel ${channelId}`);
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    success: false,
    overallStatus: 'unknown'
  };
  
  try {
    // Test 1: Get channel status
    let start = Date.now();
    try {
      const statusRes = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${channelId}/status.json`, {
        params: { api_key: readApiKey },
        timeout: 5000
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
      results.tests.push({
        name: 'Channel Status',
        endpoint: '/status.json',
        error: err.message,
        time: Date.now() - start,
        success: false
      });
      
      log(`Status test failed: ${err.message}`);
    }
    
    // Test 2: Get single feed
    start = Date.now();
    try {
      const feedRes = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${channelId}/feeds.json`, {
        params: { api_key: readApiKey, results: 1 },
        timeout: 5000
      });
      
      results.tests.push({
        name: 'Single Feed',
        endpoint: '/feeds.json',
        status: feedRes.status,
        time: Date.now() - start,
        hasData: feedRes.data?.feeds?.length > 0,
        success: true
      });
      
      log(`Feed test passed: ${feedRes.data?.feeds?.length || 0} records`);
    } catch (err) {
      results.tests.push({
        name: 'Single Feed',
        endpoint: '/feeds.json',
        error: err.message,
        time: Date.now() - start,
        success: false
      });
      
      log(`Feed test failed: ${err.message}`);
    }
    
    // Test 3: Get channel info
    start = Date.now();
    try {
      const infoRes = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${channelId}.json`, {
        params: { api_key: readApiKey },
        timeout: 5000
      });
      
      results.tests.push({
        name: 'Channel Info',
        endpoint: '/channels.json',
        status: infoRes.status,
        time: Date.now() - start,
        channelName: infoRes.data?.channel?.name,
        success: true
      });
      
      log(`Info test passed: Channel name: ${infoRes.data?.channel?.name || 'unknown'}`);
    } catch (err) {
      results.tests.push({
        name: 'Channel Info',
        endpoint: '/channels.json',
        error: err.message,
        time: Date.now() - start,
        success: false
      });
      
      log(`Info test failed: ${err.message}`);
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
      results.tests.push({
        name: 'DNS Resolution',
        host: 'api.thingspeak.com',
        error: err.message,
        time: Date.now() - start,
        success: false
      });
      
      log(`DNS test failed: ${err.message}`);
    }
    
    // Check network interfaces
    results.networkInfo = {
      interfaces: getNetworkInterfaces(),
      hostname: os.hostname()
    };
    
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
    return results;
    
  } catch (error) {
    log(`Test failed with error: ${error.message}`);
    results.error = error.message;
    results.overallStatus = 'error';
    results.success = false;
    return results;
  }
}

/**
 * Get network interfaces information
 * @returns {Object} Network interfaces
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

module.exports = {
  log,
  testThingSpeakConnectivity
};
