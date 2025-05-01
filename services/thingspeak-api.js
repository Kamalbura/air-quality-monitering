/**
 * ThingSpeak API Service
 * Manages communication with ThingSpeak API
 */

const axios = require('axios');
const debugHelper = require('../helpers/debug-helper');

// ThingSpeak API configuration
let config = {
  baseUrl: 'https://api.thingspeak.com',
  channelId: process.env.THINGSPEAK_CHANNEL_ID || '2863798',
  readApiKey: process.env.THINGSPEAK_READ_API_KEY || 'RIXYDDDMXDBX9ALI',
  writeApiKey: process.env.THINGSPEAK_WRITE_API_KEY || 'PV514C353A367A3J'
};

// Rate limiting management
const rateLimit = {
  requestsPerMinute: 60, // ThingSpeak standard rate limit
  requestsPerDay: 8000,  // Free account daily limit
  minuteCounter: 0,
  dailyCounter: 0,
  minuteResetTime: Date.now() + 60000,
  dailyResetTime: Date.now() + 86400000,
  resetCounters() {
    const now = Date.now();
    if (now > this.minuteResetTime) {
      this.minuteCounter = 0;
      this.minuteResetTime = now + 60000;
    }
    if (now > this.dailyResetTime) {
      this.dailyCounter = 0;
      this.dailyResetTime = now + 86400000;
    }
  },
  incrementCounters() {
    this.resetCounters();
    this.minuteCounter++;
    this.dailyCounter++;
  },
  checkLimits() {
    this.resetCounters();
    return {
      minuteLimit: this.minuteCounter < this.requestsPerMinute,
      dailyLimit: this.dailyCounter < this.requestsPerDay,
      remainingMinute: Math.max(0, this.requestsPerMinute - this.minuteCounter),
      remainingDaily: Math.max(0, this.requestsPerDay - this.dailyCounter),
      minuteResetIn: Math.max(0, Math.ceil((this.minuteResetTime - Date.now()) / 1000)),
      dailyResetIn: Math.max(0, Math.ceil((this.dailyResetTime - Date.now()) / 1000))
    };
  }
};

// API metrics tracking
const apiMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  totalTime: 0,
  lastRequest: null,
  errors: [],
  maxErrors: 50, // Keep only the most recent errors

  addRequest(success, time, endpoint, error = null) {
    this.totalRequests++;
    if (success) {
      this.successfulRequests++;
      this.totalTime += time;
    } else {
      this.failedRequests++;
      if (error) {
        // Add to errors array but limit size
        this.errors.unshift({
          timestamp: new Date().toISOString(),
          endpoint,
          message: error.message || String(error),
          status: error.status || 0
        });
        
        if (this.errors.length > this.maxErrors) {
          this.errors.pop();
        }
      }
    }
    this.lastRequest = new Date();
  },

  getMetrics() {
    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate: this.totalRequests === 0 ? 
        100 : Math.round((this.successfulRequests / this.totalRequests) * 100),
      averageResponseTime: this.successfulRequests === 0 ? 
        0 : Math.round(this.totalTime / this.successfulRequests),
      lastRequest: this.lastRequest,
      errors: this.errors,
      rateLimit: rateLimit.checkLimits()
    };
  }
};

/**
 * Make a request to ThingSpeak API with retries and error handling
 * @param {Object} options - Request options
 * @returns {Promise<Object>} API response
 */
async function makeRequest(options) {
  const { endpoint, params = {}, method = 'GET', data = null, maxRetries = 2, timeoutMs = 8000 } = options;
  
  const rateLimitInfo = rateLimit.checkLimits();
  if (!rateLimitInfo.minuteLimit) {
    const error = new Error(`ThingSpeak rate limit exceeded. Reset in ${rateLimitInfo.minuteResetIn} seconds.`);
    error.status = 429;
    throw error;
  }

  if (!rateLimitInfo.dailyLimit) {
    const error = new Error(`ThingSpeak daily limit exceeded. Reset in ${rateLimitInfo.dailyResetIn} seconds.`);
    error.status = 429;
    throw error;
  }

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Add exponential backoff for retries
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }

    const startTime = Date.now();
    try {
      debugHelper.log(`ThingSpeak API request (attempt ${attempt + 1}/${maxRetries + 1}): ${endpoint}`, 'thingspeak-api');

      // Increment rate limiting counters
      rateLimit.incrementCounters();
      
      // Make the request
      const response = await axios({
        method,
        url: `${config.baseUrl}${endpoint}`,
        params,
        data,
        timeout: timeoutMs
      });

      const duration = Date.now() - startTime;
      apiMetrics.addRequest(true, duration, endpoint);
      
      debugHelper.log(`ThingSpeak API success (${duration}ms): ${endpoint}`, 'thingspeak-api');
      
      return {
        success: true,
        data: response.data,
        status: response.status,
        responseTime: duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const status = error.response?.status;
      const errorMsg = error.response?.data?.error || error.message;
      
      debugHelper.log(`ThingSpeak API error (${duration}ms): ${endpoint} - ${errorMsg}`, 'thingspeak-api', 'error');
      
      lastError = {
        message: errorMsg,
        status: status
      };
      
      // Check if we should retry based on the error
      if (status === 429 || status >= 500 || error.code === 'ECONNABORTED') {
        // Rate limit or server error - worth retrying
        continue;
      } else if (status === 404) {
        // Resource not found - no point retrying
        break;
      } else if (status === 401) {
        // Authentication error - no point retrying
        break;
      }
      
      // For other errors, continue retrying
    }
  }

  // Add to metrics after all retries have failed
  apiMetrics.addRequest(false, 0, endpoint, lastError);
  
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    status: lastError?.status || 500
  };
}

/**
 * Get channel information
 * @returns {Promise<Object>} Channel information
 */
async function getChannelInfo() {
  try {
    const params = {};
    if (config.readApiKey) {
      params.api_key = config.readApiKey;
    }
    
    return await makeRequest({
      endpoint: `/channels/${config.channelId}.json`,
      params
    });
  } catch (error) {
    debugHelper.log(`Error getting channel info: ${error.message}`, 'thingspeak-api', 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Get channel feed data
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Feed data
 */
async function getChannelFeed(options = {}) {
  try {
    const { results = 100, start = null, end = null, days = null } = options;
    
    const params = { results };
    if (config.readApiKey) {
      params.api_key = config.readApiKey;
    }
    
    if (start) params.start = start;
    if (end) params.end = end;
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      params.start = startDate.toISOString();
    }
    
    return await makeRequest({
      endpoint: `/channels/${config.channelId}/feeds.json`,
      params
    });
  } catch (error) {
    debugHelper.log(`Error getting channel feed: ${error.message}`, 'thingspeak-api', 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Get latest entry
 * @returns {Promise<Object>} Latest entry
 */
async function getLatestEntry() {
  try {
    const params = { results: 1 };
    if (config.readApiKey) {
      params.api_key = config.readApiKey;
    }
    
    const result = await makeRequest({
      endpoint: `/channels/${config.channelId}/feeds.json`,
      params
    });
    
    if (result.success && result.data && result.data.feeds && result.data.feeds.length > 0) {
      return { success: true, data: result.data.feeds[0] };
    } else {
      return { success: false, error: 'No entries found', data: null };
    }
  } catch (error) {
    debugHelper.log(`Error getting latest entry: ${error.message}`, 'thingspeak-api', 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Get field data
 * @param {number} fieldNumber - Field number (1-8)
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Field data
 */
async function getFieldData(fieldNumber, options = {}) {
  if (fieldNumber < 1 || fieldNumber > 8) {
    return { success: false, error: 'Field number must be between 1 and 8' };
  }
  
  try {
    const { results = 100, start = null, end = null } = options;
    
    const params = { results };
    if (config.readApiKey) {
      params.api_key = config.readApiKey;
    }
    
    if (start) params.start = start;
    if (end) params.end = end;
    
    return await makeRequest({
      endpoint: `/channels/${config.channelId}/fields/${fieldNumber}.json`,
      params
    });
  } catch (error) {
    debugHelper.log(`Error getting field data: ${error.message}`, 'thingspeak-api', 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Check API connection
 * @returns {Promise<Object>} Connection status
 */
async function checkConnection() {
  try {
    // First check the status endpoint
    const statusResult = await makeRequest({
      endpoint: `/channels/${config.channelId}/status.json`,
      params: config.readApiKey ? { api_key: config.readApiKey } : {},
      timeoutMs: 5000
    });
    
    if (!statusResult.success) {
      return {
        success: false,
        online: false,
        connected: false,
        error: statusResult.error,
        message: 'ThingSpeak status check failed'
      };
    }
    
    // Then check if we can get the latest data
    const latestResult = await getLatestEntry();
    
    if (!latestResult.success) {
      return {
        success: true,
        online: true,
        connected: false,
        channel_exists: true,
        data_available: false,
        message: 'ThingSpeak channel exists but no data available'
      };
    }
    
    const lastUpdate = new Date(latestResult.data.created_at);
    const now = new Date();
    const diffSeconds = Math.floor((now - lastUpdate) / 1000);
    
    return {
      success: true,
      online: true,
      connected: true,
      channel_exists: true,
      data_available: true,
      data_fresh: diffSeconds < 3600, // Data is fresh if less than 1 hour old
      last_data_received: latestResult.data.created_at,
      data_age_seconds: diffSeconds,
      message: 'ThingSpeak connection successful'
    };
  } catch (error) {
    debugHelper.log(`Error checking connection: ${error.message}`, 'thingspeak-api', 'error');
    
    return {
      success: false,
      online: false,
      connected: false,
      error: error.message,
      message: 'ThingSpeak connection check failed'
    };
  }
}

/**
 * Write data to ThingSpeak
 * @param {Object} data - Data to write (field1, field2, etc.)
 * @returns {Promise<Object>} Write result
 */
async function writeData(data) {
  try {
    if (!config.writeApiKey) {
      return { success: false, error: 'Write API key is not configured' };
    }
    
    const params = { api_key: config.writeApiKey, ...data };
    
    const result = await makeRequest({
      endpoint: `/update`,
      params,
      timeoutMs: 10000
    });
    
    if (result.success) {
      const entryId = parseInt(result.data);
      
      if (isNaN(entryId)) {
        return { success: false, error: 'Invalid response from ThingSpeak' };
      }
      
      return { success: true, entryId };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    debugHelper.log(`Error writing data: ${error.message}`, 'thingspeak-api', 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Get API metrics
 * @returns {Object} API metrics
 */
function getApiMetrics() {
  return apiMetrics.getMetrics();
}

/**
 * Get rate limit information
 * @returns {Object} Rate limit info
 */
function getRateLimitInfo() {
  return rateLimit.checkLimits();
}

/**
 * Update configuration
 * @param {Object} newConfig - New configuration
 */
function updateConfig(newConfig) {
  config = { ...config, ...newConfig };
  debugHelper.log('ThingSpeak API configuration updated', 'thingspeak-api');
}

module.exports = {
  getChannelInfo,
  getChannelFeed,
  getLatestEntry,
  getFieldData,
  checkConnection,
  writeData,
  getApiMetrics,
  getRateLimitInfo,
  updateConfig
};
