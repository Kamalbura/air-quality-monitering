const axios = require('axios');
const NodeCache = require('node-cache');
require('dotenv').config();

// Update endpoint constants for clarity and flexibility
const THINGSPEAK_API_BASE_URL = 'https://api.thingspeak.com';
const THINGSPEAK_UPDATE_URL = `${THINGSPEAK_API_BASE_URL}/update.json`;
const THINGSPEAK_CHANNEL_URL = `${THINGSPEAK_API_BASE_URL}/channels`;

// Environment variables with secure handling (no hardcoded fallbacks in production)
const CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID;
const READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY;
const WRITE_API_KEY = process.env.THINGSPEAK_WRITE_API_KEY;

// Use development fallbacks only in non-production
const devFallbacks = process.env.NODE_ENV !== 'production';
const getChannelId = () => CHANNEL_ID || (devFallbacks ? '2863798' : null);
const getReadKey = () => READ_API_KEY || (devFallbacks ? 'RIXYDDDMXDBX9ALI' : null);
const getWriteKey = () => WRITE_API_KEY || (devFallbacks ? 'PV514C353A367A3J' : null);

// Improved cache with memory limits
const cache = new NodeCache({ 
  stdTTL: 300,           // Standard items (5 minutes)
  checkperiod: 60,       // Check for expired items every 60 seconds
  maxKeys: 1000          // Limit total cache entries
});

// Enhanced field mapping with clear documentation
const fieldMapping = {
  timestamp: 'created_at',
  humidity: 'field1',
  temperature: 'field2',
  pm25: 'field3',
  pm10: 'field4'
};

// Record API call timestamps to comply with rate limits
let lastApiCall = 0;
const MIN_API_CALL_INTERVAL = 15000; // 15 seconds between API calls (ThingSpeak limit)

/**
 * Helper to create consistent response structure
 */
const createResponse = (success, data, error = null) => ({
  success,
  data,
  error: error ? { message: error.message || String(error) } : null
});

/**
 * Wait if needed to respect ThingSpeak rate limits
 * @returns {Promise<void>}
 */
async function respectRateLimits() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  
  if (lastApiCall > 0 && timeSinceLastCall < MIN_API_CALL_INTERVAL) {
    const waitTime = MIN_API_CALL_INTERVAL - timeSinceLastCall;
    console.log(`Rate limiting: Waiting ${waitTime}ms before next ThingSpeak API call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastApiCall = Date.now();
}

/**
 * Verify ThingSpeak channel and API keys on startup
 * @returns {Promise<boolean>} True if verification succeeds
 */
async function verifyChannel() {
  if (!getChannelId() || !getReadKey() || !getWriteKey()) {
    console.error('ThingSpeak configuration error: Missing Channel ID or API keys');
    return false;
  }

  try {
    // First verify read access
    const readUrl = `${THINGSPEAK_CHANNEL_URL}/${getChannelId()}/status.json`;
    const readResponse = await axios.get(readUrl, { 
      params: { api_key: getReadKey() },
      timeout: 5000
    });
    
    if (readResponse.status !== 200 || !readResponse.data) {
      console.error('ThingSpeak read verification failed: Invalid response');
      return false;
    }
    
    console.log(`ThingSpeak channel verified: ${readResponse.data.channel?.name || getChannelId()}`);
    
    // Then verify write access with a small test update
    // Only do this in development to avoid wasting an API call
    if (process.env.NODE_ENV === 'development') {
      try {
        const testData = {
          api_key: getWriteKey(),
          status: 'API_VERIFICATION_TEST'
        };
        
        // Add a 15-second delay to respect rate limits
        await respectRateLimits();
        
        const writeResponse = await axios.post(THINGSPEAK_UPDATE_URL, null, {
          params: testData,
          timeout: 5000
        });
        
        if (writeResponse.data && parseInt(writeResponse.data) > 0) {
          console.log(`ThingSpeak write access verified (entry ${writeResponse.data})`);
        } else {
          console.warn('ThingSpeak write verification failed: Invalid response');
          // Continue anyway since read access works - return true for partial success
          return true;
        }
      } catch (writeErr) {
        console.warn('ThingSpeak write verification failed:', writeErr.message);
        // Continue anyway since read access works - return true for partial success
        return true;
      }
    }
    
    return true;
  } catch (error) {
    console.error('ThingSpeak API verification failed:', error.message);
    
    if (error.response) {
      console.error(`Status: ${error.response.status}, Data:`, error.response.data);
      
      switch(error.response.status) {
        case 401:
          console.error('ThingSpeak API key is invalid or unauthorized');
          break;
        case 404:
          console.error('ThingSpeak channel not found. Check CHANNEL_ID');
          break;
        case 429:
          console.error('ThingSpeak rate limit exceeded during verification');
          break;
      }
    }
    
    return false;
  }
}

/**
 * Send data to ThingSpeak channel
 * @param {object} data - Object containing sensor readings
 * @param {object} options - Options for the request
 * @returns {Promise<number|string>} - Entry ID if successful, error code otherwise
 */
async function sendToThingSpeak(data, options = {}) {
  if (!getWriteKey()) {
    console.error('ThingSpeak Write API Key is missing. Cannot send data.');
    return -1;
  }

  // Map data to ThingSpeak fields
  const params = {
    api_key: getWriteKey(),
    field1: parseFloat(data.humidity),
    field2: parseFloat(data.temperature),
    field3: parseFloat(data.pm25),
    field4: parseFloat(data.pm10),
    // Add status field for errors/warnings if present
    status: data.status || ''
  };

  // Add timestamp if provided (ThingSpeak allows historical data with created_at parameter)
  if (data.timestamp && options.allowHistorical) {
    const timestamp = new Date(data.timestamp);
    if (!isNaN(timestamp.getTime())) {
      params.created_at = timestamp.toISOString();
    }
  }

  // Filter out undefined or null values
  const filteredParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null) {
      acc[key] = value;
    }
    return acc;
  }, {});

  // Retry logic
  const maxRetries = options.retries || 3;
  let retryCount = 0;
  let backoffDelay = 2000; // Start with 2s delay between retries

  while (retryCount <= maxRetries) {
    try {
      // Respect rate limits
      await respectRateLimits();
      
      // ThingSpeak best practice is to use POST for updates
      const response = await axios.post(THINGSPEAK_UPDATE_URL, null, { 
        params: filteredParams,
        timeout: options.timeout || 10000  // Default 10 second timeout
      });

      // ThingSpeak returns 0 if the update fails, positive integer (entry_id) if successful
      if (response.data && response.data !== 0) {
        if (retryCount > 0) {
          console.log(`ThingSpeak update succeeded after ${retryCount} retries. Entry ID: ${response.data}`);
        } else {
          console.log(`ThingSpeak update successful. Entry ID: ${response.data}`);
        }
        return response.data;
      } else {
        console.error('ThingSpeak update failed. Response:', response.data);
        
        // Don't retry if it's a validation error (0 response)
        if (response.data === 0) {
          return 0;
        }
      }
    } catch (error) {
      console.error(`Error sending data to ThingSpeak (attempt ${retryCount + 1}/${maxRetries + 1}):`, error.message);
      
      // Enhanced error logging for debugging
      if (error.response) {
        console.error(`ThingSpeak API returned status: ${error.response.status}`);
        console.error('Response data:', error.response.data);
        
        // Don't retry client errors except rate limits
        if (error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
          return -1;
        }
      }
    }
    
    // Retry with exponential backoff
    retryCount++;
    if (retryCount <= maxRetries) {
      console.log(`Retrying in ${backoffDelay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      backoffDelay *= 1.5; // Increase backoff delay for next attempt
    }
  }
  
  return -1; // Failed after all retries
}

/**
 * Send multiple data points to ThingSpeak in bulk
 * @param {Array<object>} dataPoints - Array of data objects
 * @returns {Promise<object>} - Result with success count and failures
 */
async function sendBulkData(dataPoints) {
  if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
    return { success: false, message: 'No data points provided', successCount: 0 };
  }

  console.log(`Attempting to send ${dataPoints.length} data points to ThingSpeak`);
  
  const results = {
    success: false,
    successCount: 0,
    failureCount: 0,
    failures: []
  };

  // ThingSpeak has strict rate limits, so we must process sequentially
  for (let i = 0; i < dataPoints.length; i++) {
    const data = dataPoints[i];
    
    // Allow 15 seconds between API calls - ThingSpeak requirement
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, MIN_API_CALL_INTERVAL));
    }
    
    try {
      const entryId = await sendToThingSpeak(data);
      
      if (entryId > 0) {
        results.successCount++;
      } else {
        results.failureCount++;
        results.failures.push({
          index: i,
          data: data,
          error: 'API returned error code: ' + entryId
        });
      }
    } catch (error) {
      results.failureCount++;
      results.failures.push({
        index: i,
        data: data,
        error: error.message
      });
    }
    
    // Log progress for large batches
    if (dataPoints.length > 10 && (i + 1) % 5 === 0) {
      console.log(`Bulk upload progress: ${i + 1}/${dataPoints.length}`);
    }
  }
  
  results.success = results.successCount > 0;
  
  console.log(`Bulk upload completed: ${results.successCount} successes, ${results.failureCount} failures`);
  return results;
}

/**
 * Get ThingSpeak channel feed data with enhanced error handling and rate limiting
 * @param {object} options - Options like results, start, end, page
 * @returns {Promise<object>} - Formatted response { success, data, error }
 */
async function getChannelData(options = {}) {
  const channelId = getChannelId();
  if (!channelId) {
    return createResponse(false, null, new Error('ThingSpeak Channel ID is not configured.'));
  }

  // Create unique cache key based on request parameters
  const cacheKey = `channelData_${JSON.stringify(options)}`;
  if (cache.has(cacheKey)) {
    return createResponse(true, cache.get(cacheKey));
  }

  // Format query parameters - only focus on raw data, no analysis parameters
  const params = {
    api_key: getReadKey(),
    results: options.results || 100,
  };

  // Add optional parameters if provided
  if (options.start) params.start = options.start;
  if (options.end) params.end = options.end;
  if (options.timezone) params.timezone = options.timezone;
  if (options.offset) params.offset = options.offset;
  if (options.status) params.status = options.status;
  
  // We don't use ThingSpeak's analysis features like average, sum, etc.
  // All analysis will be performed locally after fetching the raw data

  try {
    await respectRateLimits();
    
    const url = `${THINGSPEAK_CHANNEL_URL}/${channelId}/feeds.json`;
    console.log(`Fetching raw data from ThingSpeak: ${url}`);
    const response = await axios.get(url, { 
      params,
      timeout: 30000, // 30 second timeout for large requests
      headers: {
        'Accept': 'application/json'
      }
    });

    if (response.status !== 200 || !response.data || !response.data.feeds) {
      throw new Error(`ThingSpeak API returned status ${response.status} or invalid data.`);
    }

    // Map fields according to configuration
    const mappedData = response.data.feeds.map(feed => ({
      created_at: feed.created_at,
      entry_id: feed.entry_id,
      field1: feed.field1,
      field2: feed.field2,
      field3: feed.field3,
      field4: feed.field4,
      humidity: feed.field1,
      temperature: feed.field2,
      pm25: feed.field3,
      pm10: feed.field4
    }));

    // Format response with metadata
    const responseData = {
      channel: response.data.channel,
      data: mappedData,
      pagination: {
        total: response.data.channel?.last_entry_id || mappedData.length,
        limit: params.results,
        count: mappedData.length
      },
      timestamp: new Date().toISOString(),
      source: 'thingspeak'
    };

    // Cache results with appropriate TTL based on data size to optimize memory
    const dataSize = mappedData.length;
    let ttl = 300; // Default 5 minutes
    
    if (dataSize > 1000) {
      ttl = 1800; // 30 minutes for large datasets
    } else if (dataSize > 500) {
      ttl = 900; // 15 minutes for medium datasets
    } else if (dataSize < 20) {
      ttl = 120; // 2 minutes for small datasets (fresher data)
    }
    
    cache.set(cacheKey, responseData, ttl);
    return createResponse(true, responseData);
  } catch (error) {
    console.error('Error fetching ThingSpeak data:', error.message);
    
    // Enhanced error handling with specific error types
    if (error.response) {
      console.error('ThingSpeak API Error Response:', error.response.data);
      
      // Handle specific status codes
      if (error.response.status === 429) {
        // Implement exponential backoff for rate limiting
        console.warn('Rate limit exceeded. Implementing backoff strategy.');
        return createResponse(false, null, new Error('ThingSpeak rate limit exceeded. Try again later.'));
      }
      
      return createResponse(false, null, new Error(`ThingSpeak API Error: ${error.response.status} - ${error.response.data || error.message}`));
    } else if (error.request) {
      return createResponse(false, null, new Error('Error fetching ThingSpeak data: No response received. Check network connection.'));
    } else {
      return createResponse(false, null, error);
    }
  }
}

/**
 * Get ThingSpeak channel status information
 * @returns {Promise<object>} - Formatted response { success, data, error }
 */
async function getChannelStatus() {
  const channelId = getChannelId();
  if (!channelId) {
    return createResponse(false, null, new Error('ThingSpeak Channel ID is not configured.'));
  }
  const cacheKey = `channelStatus_${channelId}`;
  if (cache.has(cacheKey)) {
    return createResponse(true, cache.get(cacheKey));
  }

  try {
    const url = `${THINGSPEAK_CHANNEL_URL}/${channelId}/status.json`;
    const params = { api_key: getReadKey() };
    const response = await axios.get(url, { params });

    if (response.status !== 200 || !response.data) {
       throw new Error(`ThingSpeak API returned status ${response.status} or invalid data for status.`);
    }
    cache.set(cacheKey, response.data);
    return createResponse(true, response.data);
  } catch (error) {
     console.error('Error fetching ThingSpeak status:', error.message);
     return createResponse(false, null, error);
  }
}

/**
 * Get Data Source Information (ThingSpeak specific)
 * @returns {Promise<object>} - Information about the ThingSpeak channel
 */
async function getDataSourceInfo() {
   const channelId = getChannelId();
   if (!channelId) {
    return {
        isOffline: true, // Indicate offline if not configured
        error: 'ThingSpeak Channel ID not configured.',
        name: 'ThingSpeak (Not Configured)',
        channelId: 'N/A',
        recordCount: 0,
        lastEntryDate: null,
        fieldMapping: fieldMapping
    };
  }
  try {
    // Fetch basic channel info first
    const url = `${THINGSPEAK_CHANNEL_URL}/${channelId}.json`;
    const params = { api_key: getReadKey() };
    const response = await axios.get(url, { params });

    if (response.status !== 200 || !response.data) {
      throw new Error(`ThingSpeak API returned status ${response.status} or invalid channel data.`);
    }

    const channelInfo = response.data;
    return {
      isOffline: false,
      error: null,
      name: channelInfo.name || `ThingSpeak Channel ${channelId}`,
      channelId: channelId,
      recordCount: channelInfo.last_entry_id || 0,
      lastEntry: channelInfo.last_entry_id, // Add last entry ID
      lastEntryDate: channelInfo.updated_at || null,
      fieldMapping: fieldMapping, // Return the mapping used
      isLocal: false // Explicitly mark as not local
    };
  } catch (error) {
    console.error('Error fetching ThingSpeak data source info:', error.message);
    return {
      isOffline: true, // Indicate offline on error
      error: error.message,
      name: `ThingSpeak Channel ${channelId} (Error)`,
      channelId: channelId,
      recordCount: 'Unknown',
      lastEntryDate: 'Unknown',
      fieldMapping: fieldMapping,
      isLocal: false
    };
  }
}

/**
 * Get Realtime Updates (fetches latest entries since lastEntryId)
 * @param {string|number} lastEntryId - The last entry ID received by the client
 * @returns {Promise<object>} - Formatted response { success, data: { newEntries, channel }, error }
 */
async function getRealtimeUpdates(lastEntryId = 0) {
  const channelId = getChannelId();
  if (!channelId) {
    return createResponse(false, null, new Error('ThingSpeak Channel ID is not configured.'));
  }

  try {
    // Fetch the latest entry ID first to see if there's anything new
    const statusUrl = `${THINGSPEAK_CHANNEL_URL}/${channelId}/feeds/last.json`;
    const statusParams = { api_key: getReadKey() };
    const statusResponse = await axios.get(statusUrl, { params: statusParams });

    if (statusResponse.status !== 200 || !statusResponse.data) {
      throw new Error('Failed to fetch latest entry status from ThingSpeak.');
    }

    const currentLastEntryId = parseInt(statusResponse.data.entry_id);
    const clientLastEntryId = parseInt(lastEntryId);

    if (currentLastEntryId > clientLastEntryId) {
      const newEntriesCount = currentLastEntryId - clientLastEntryId;
      // Fetch the actual new entries (limit to a reasonable number, e.g., 100)
      const dataParams = {
        api_key: getReadKey(),
        results: Math.min(newEntriesCount, 100) // Fetch up to 100 new entries
      };
      const dataUrl = `${THINGSPEAK_CHANNEL_URL}/${channelId}/feeds.json`;
      const dataResponse = await axios.get(dataUrl, { params: dataParams });

      if (dataResponse.status !== 200 || !dataResponse.data || !dataResponse.data.feeds) {
         throw new Error('Failed to fetch new entries data from ThingSpeak.');
      }

      // Map fields for the new entries
      const mappedData = dataResponse.data.feeds
        .filter(feed => parseInt(feed.entry_id) > clientLastEntryId) // Ensure we only send newer entries
        .map(feed => ({
          created_at: feed.created_at,
          entry_id: feed.entry_id,
          [fieldMapping.humidity]: parseFloat(feed[fieldMapping.humidity]) || null,
          [fieldMapping.temperature]: parseFloat(feed[fieldMapping.temperature]) || null,
          [fieldMapping.pm25]: parseFloat(feed[fieldMapping.pm25]) || null,
          [fieldMapping.pm10]: parseFloat(feed[fieldMapping.pm10]) || null,
        }));

      return createResponse(true, {
        newEntries: mappedData.length, // Count of actual new entries returned
        channel: { last_entry_id: currentLastEntryId }, // Provide the latest ID
        feeds: mappedData // Include the new data points
      });
    } else {
      // No new entries
      return createResponse(true, { newEntries: 0, channel: { last_entry_id: currentLastEntryId } });
    }
  } catch (error) {
    console.error('Error fetching ThingSpeak realtime updates:', error.message);
    return createResponse(false, null, error);
  }
}

/**
 * Check ThingSpeak connection status
 * @returns {Promise<object>} Connection status result
 */
async function checkConnection() {
  try {
    await respectRateLimits();
    
    const url = `${THINGSPEAK_CHANNEL_URL}/${getChannelId()}/status.json`;
    const response = await axios.get(url, {
      params: { api_key: getReadKey() },
      timeout: 5000
    });
    
    return {
      success: true,
      status: response.status,
      message: 'ThingSpeak connection successful',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status,
      message: `ThingSpeak connection failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check if ThingSpeak API is available without using cache
 * @returns {Promise<boolean>} True if ThingSpeak is available
 */
async function checkThingspeakAvailability() {
  try {
    if (!getChannelId() || !getReadKey()) {
      console.error('Missing ThingSpeak configuration for availability check');
      return false;
    }
    
    const url = `${THINGSPEAK_CHANNEL_URL}/${getChannelId()}/status.json`;
    const response = await axios.get(url, {
      params: { api_key: getReadKey() },
      timeout: 5000
    });
    
    return response.status === 200;
  } catch (error) {
    console.error('ThingSpeak availability check failed:', error.message);
    return false;
  }
}

/**
 * Clear the ThingSpeak data cache
 * @returns {number} Number of items cleared
 */
function clearCache() {
  return cache.flushAll();
}

/**
 * Get Field Mapping
 * @returns {object} - The field mapping configuration
 */
function getFieldMapping() {
  return fieldMapping;
}

// Initialize the service with better checks
(async function initialize() {
  console.log('Initializing ThingSpeak service...');
  
  if (!getChannelId()) {
    console.warn('ThingSpeak Channel ID is not configured. Please set THINGSPEAK_CHANNEL_ID in your .env file.');
  }
  
  if (!getReadKey()) {
    console.warn('ThingSpeak Read API Key is not configured. Please set THINGSPEAK_READ_API_KEY in your .env file.');
  }
  
  if (!getWriteKey()) {
    console.warn('ThingSpeak Write API Key is not configured. Please set THINGSPEAK_WRITE_API_KEY in your .env file.');
  }
  
  if (getChannelId() && getReadKey()) {
    try {
      // Only verify if not in production to avoid unnecessary API calls
      if (process.env.NODE_ENV !== 'production') {
        console.log('Verifying ThingSpeak channel connection...');
        const verified = await verifyChannel();
        if (verified) {
          console.log('ThingSpeak service initialized successfully');
        } else {
          console.error('ThingSpeak service initialization failed - API verification failed');
        }
      }
    } catch (error) {
      console.error('Error during ThingSpeak service initialization:', error.message);
    }
  } else {
    console.warn('ThingSpeak service initialized with limited functionality due to missing configuration.');
  }
})();

module.exports = {
  getChannelData,
  getChannelStatus,
  getDataSourceInfo,
  getRealtimeUpdates,
  getFieldMapping,
  sendToThingSpeak,
  sendBulkData,
  checkConnection,
  checkThingspeakAvailability,
  verifyChannel,
  clearCache
};
