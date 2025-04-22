/**
 * Network diagnostics helper for ThingSpeak API
 */
const axios = require('axios');
const dns = require('dns');
const { execSync } = require('child_process');
const os = require('os');

/**
 * Run diagnostics tests for ThingSpeak connectivity
 * @param {string} channelId - ThingSpeak channel ID
 * @param {string} apiKey - ThingSpeak read API key
 * @returns {Promise<Object>} Diagnostic results
 */
async function runThingspeakDiagnostics(channelId, apiKey) {
  const results = {
    timestamp: new Date().toISOString(),
    diagnosticId: `diag-${Date.now()}`,
    tests: [],
    networkInfo: {},
    systemInfo: {},
    success: false,
    overallStatus: 'unknown',
    recommendations: []
  };

  console.log(`Running ThingSpeak diagnostics for channel ${channelId}`);
  
  try {
    // Test 1: Test DNS resolution
    try {
      const dnsResult = await dnsLookup('api.thingspeak.com');
      results.tests.push({
        name: 'DNS Resolution',
        success: true,
        resolved: dnsResult,
        time: Date.now()
      });
    } catch (err) {
      results.tests.push({
        name: 'DNS Resolution',
        success: false,
        error: err.message,
        time: Date.now()
      });
      results.recommendations.push('Check your DNS settings or internet connection');
    }
    
    // Test 2: Ping test
    try {
      const pingResult = pingHost('api.thingspeak.com');
      results.tests.push({
        name: 'Ping Test',
        success: pingResult.success,
        latency: pingResult.latency,
        details: pingResult.details,
        time: Date.now()
      });
      
      if (pingResult.latency > 300) {
        results.recommendations.push('Your network latency to ThingSpeak is high, which may cause timeouts');
      }
    } catch (err) {
      results.tests.push({
        name: 'Ping Test',
        success: false,
        error: err.message,
        time: Date.now()
      });
    }
    
    // Test 3: Basic HTTP request
    try {
      const response = await axios.get('https://api.thingspeak.com/channels/public.json', {
        timeout: 5000
      });
      results.tests.push({
        name: 'Basic HTTP Request',
        success: true,
        status: response.status,
        time: Date.now()
      });
    } catch (err) {
      results.tests.push({
        name: 'Basic HTTP Request',
        success: false,
        error: err.message,
        time: Date.now()
      });
      results.recommendations.push('Basic HTTP requests to ThingSpeak are failing. Check your firewall or proxy settings.');
    }
    
    // Test 4: Channel status request
    try {
      const response = await axios.get(`https://api.thingspeak.com/channels/${channelId}/status.json`, {
        params: { api_key: apiKey },
        timeout: 5000
      });
      results.tests.push({
        name: 'Channel Status',
        success: true,
        status: response.status,
        time: Date.now()
      });
    } catch (err) {
      results.tests.push({
        name: 'Channel Status',
        success: false,
        error: err.message,
        time: Date.now(),
        statusCode: err.response?.status
      });
      
      if (err.response?.status === 404) {
        results.recommendations.push('Channel ID may be incorrect. Verify your channel ID.');
      } else if (err.response?.status === 401) {
        results.recommendations.push('API key may be incorrect. Verify your API key.');
      } else {
        results.recommendations.push('Failed to access channel status. Check your channel ID and API key.');
      }
    }
    
    // Test 5: Get network information
    results.networkInfo = {
      interfaces: getNetworkInterfaces(),
      connected: checkInternetConnection(),
      internetGateway: getDefaultGateway()
    };
    
    // Test 6: System info
    results.systemInfo = {
      platform: os.platform(),
      release: os.release(),
      type: os.type(),
      arch: os.arch(),
      uptime: os.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem()
      }
    };
    
    // Determine overall status
    const successfulTests = results.tests.filter(t => t.success).length;
    if (successfulTests === results.tests.length) {
      results.overallStatus = 'healthy';
      results.success = true;
    } else if (successfulTests > 0) {
      results.overallStatus = 'partial';
      results.success = false;
      
      // Add general recommendations
      if (!results.recommendations.length) {
        results.recommendations.push('Some tests are failing. This may indicate network connectivity issues.');
      }
    } else {
      results.overallStatus = 'failed';
      results.success = false;
      results.recommendations.push('All tests failed. Check your internet connection and firewall settings.');
    }
    
    return results;
  } catch (error) {
    console.error('Diagnostics failed:', error);
    results.error = error.message;
    results.overallStatus = 'error';
    results.success = false;
    results.recommendations.push('Diagnostic tests encountered an unexpected error. Check your internet connection.');
    return results;
  }
}

/**
 * Lookup DNS for a hostname
 * @param {string} hostname - Hostname to lookup
 * @returns {Promise<string>} Resolved IP address
 */
function dnsLookup(hostname) {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

/**
 * Ping a host to check connectivity
 * @param {string} host - Hostname to ping
 * @returns {Object} Ping results
 */
function pingHost(host) {
  try {
    const isWindows = os.platform() === 'win32';
    const pingCmd = isWindows ? `ping -n 1 ${host}` : `ping -c 1 ${host}`;
    
    const output = execSync(pingCmd, { timeout: 5000 }).toString();
    
    // Extract latency from ping output
    const latencyMatch = isWindows
      ? output.match(/time=(\d+)ms/i) || output.match(/time[<|=](\d+)ms/i)
      : output.match(/time=(\d+\.\d+) ms/i);
    
    const latency = latencyMatch ? parseFloat(latencyMatch[1]) : null;
    
    return {
      success: true,
      latency,
      details: output.trim().split('\n').slice(-2).join(' ')
    };
  } catch (error) {
    return {
      success: false,
      latency: null,
      details: error.message,
      error: error.message
    };
  }
}

/**
 * Get network interface information
 * @returns {Array} Network interfaces
 */
function getNetworkInterfaces() {
  const interfaces = os.networkInterfaces();
  const result = [];
  
  Object.keys(interfaces).forEach(name => {
    interfaces[name].forEach(iface => {
      // Skip internal interfaces
      if (!iface.internal) {
        result.push({
          name,
          address: iface.address,
          netmask: iface.netmask,
          family: iface.family,
          mac: iface.mac
        });
      }
    });
  });
  
  return result;
}

/**
 * Check if there's an active internet connection
 * @returns {boolean} True if internet is available
 */
function checkInternetConnection() {
  try {
    // Try to ping a known reliable host
    const result = pingHost('8.8.8.8');
    return result.success;
  } catch (e) {
    return false;
  }
}

/**
 * Get the default internet gateway
 * @returns {string|null} Default gateway IP address
 */
function getDefaultGateway() {
  try {
    const isWindows = os.platform() === 'win32';
    if (isWindows) {
      const output = execSync('ipconfig').toString();
      const match = output.match(/Default Gateway[\s.:]+(\d+\.\d+\.\d+\.\d+)/i);
      return match ? match[1] : null;
    } else {
      // Linux/Unix/MacOS approach
      const output = execSync('ip route | grep default').toString();
      const match = output.match(/default via (\d+\.\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    }
  } catch (e) {
    return null;
  }
}

module.exports = {
  runThingspeakDiagnostics,
  dnsLookup,
  pingHost,
  getNetworkInterfaces,
  checkInternetConnection,
  getDefaultGateway
};
