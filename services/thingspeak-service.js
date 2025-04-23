const axios = require('axios');
const NodeCache = require('node-cache');
const fs = require('fs').promises;
const path = require('path');
const debugHelper = require('../helpers/debug-helper');
require('dotenv').config();

// Cache for API responses
if (!global.apiCache) {
  global.apiCache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
}

// ThingSpeak API configuration
const THINGSPEAK_CHANNEL_ID = process.env.THINGSPEAK_CHANNEL_ID;
const THINGSPEAK_READ_API_KEY = process.env.THINGSPEAK_READ_API_KEY;
const THINGSPEAK_WRITE_API_KEY = process.env.THINGSPEAK_WRITE_API_KEY;
const THINGSPEAK_BASE_URL = 'https://api.thingspeak.com';

/**
 * Get channel data from ThingSpeak
 * @param {Object} options - Options for data retrieval
 * @returns {Promise<Object>} - Promise resolving to data response
 */
async function getChannelData(options = {}) {
  const results = options.results || 100;
  const start = options.start || null;
  const end = options.end || null;
  const page = options.page || null;

  // Create cache key based on options
  const cacheKey = `channel_data_${THINGSPEAK_CHANNEL_ID}_${results}_${start}_${end}_${page}`;

  // Check cache first
  const cachedData = global.apiCache.get(cacheKey);
  if (cachedData && !options.noCache) {
    debugHelper.log(`Retrieved data from cache: ${cacheKey}`, 'thingspeak');
    return { success: true, data: cachedData, fromCache: true };
  }

  try {
    // Build query parameters
    const params = {
      results,
      api_key: THINGSPEAK_READ_API_KEY
    };

    if (start) params.start = start;
    if (end) params.end = end;
    if (page) params.page = page;

    // Make API request
    debugHelper.log(`Fetching data from ThingSpeak: results=${results}`, 'thingspeak');
    const response = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json`, { params });

    // Process channel data
    const channelData = response.data;

    // Post-process data for easier client use
    const processedData = processData(channelData);

    // Store in cache
    global.apiCache.set(cacheKey, processedData);

    return { success: true, data: processedData };
  } catch (error) {
    debugHelper.log(`Error fetching ThingSpeak data: ${error.message}`, 'thingspeak', 'error');
    return {
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null
    };
  }
}

/**
 * Get direct data from ThingSpeak API
 * @param {Object} options - Options for data retrieval
 * @returns {Promise<Object>} - Promise resolving to data
 */
async function getDirectThingspeakData(options = {}) {
  try {
    const days = options.days || 7;
    const results = options.results || 500;

    // Calculate start date based on days parameter
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // ThingSpeak date format: YYYY-MM-DD HH:MM:SS
    const formattedStartDate = startDate.toISOString().slice(0, 19).replace('T', ' ');

    // Build the API URL
    const url = `${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json`;

    // Cache key based on parameters
    const cacheKey = `direct_${days}_${results}`;
    const cachedData = global.apiCache.get(cacheKey);

    if (cachedData) {
      debugHelper.log(`Using cached ThingSpeak direct data for ${days} days`, 'api');
      return cachedData;
    }

    debugHelper.log(`Fetching direct data from ThingSpeak for the last ${days} days`, 'api');

    // Make API request
    const response = await axios.get(url, {
      params: {
        api_key: THINGSPEAK_READ_API_KEY,
        results,
        start: formattedStartDate,
        timezone: 'UTC'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.data || !response.data.feeds) {
      throw new Error('Invalid response from ThingSpeak API');
    }

    const result = {
      channel: response.data.channel,
      data: response.data.feeds,
      count: response.data.feeds.length,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    global.apiCache.set(cacheKey, result);

    return result;
  } catch (error) {
    debugHelper.log(`Error fetching direct ThingSpeak data: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get realtime updates from ThingSpeak
 * @param {Number} lastEntryId - The last known entry ID
 * @returns {Promise<Object>} - Promise resolving to new entries
 */
async function getRealtimeUpdates(lastEntryId) {
  try {
    // If no last entry ID, just return latest entry
    if (!lastEntryId || lastEntryId === 0) {
      const params = {
        results: 1,
        api_key: THINGSPEAK_READ_API_KEY
      };

      const response = await axios.get(`${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json`, { params });
      const processedData = processData(response.data);

      return { success: true, data: processedData };
    }

    // If we have a last entry ID, get entries greater than that ID
    const params = {
      api_key: THINGSPEAK_READ_API_KEY
    };

    const response = await axios.get(
      `${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?results=50`,
      { params }
    );

    // Filter entries newer than the last entry ID
    const allFeeds = response.data.feeds || [];
    const newFeeds = allFeeds.filter(feed => parseInt(feed.entry_id) > lastEntryId);

    if (newFeeds.length > 0) {
      const updatedData = {
        channel: response.data.channel,
        feeds: newFeeds
      };

      const processedData = processData(updatedData);
      return { success: true, data: processedData };
    } else {
      return {
        success: true,
        data: {
          channel: response.data.channel,
          data: []
        }
      };
    }
  } catch (error) {
    debugHelper.log(`Error fetching realtime updates: ${error.message}`, 'thingspeak', 'error');
    return {
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null
    };
  }
}

/**
 * Process raw data from ThingSpeak API to make it more usable
 * @param {Object} rawData - Raw ThingSpeak API response
 * @returns {Object} Processed data
 */
function processData(rawData) {
  if (!rawData.channel || !rawData.feeds) {
    return null;
  }

  const processedFeeds = rawData.feeds.map(feed => {
    // Convert field names to more user-friendly names
    const processedFeed = {
      entry_id: feed.entry_id,
      created_at: feed.created_at
    };

    // Map fields to friendly names
    if (feed.field1) processedFeed.humidity = parseFloat(feed.field1);
    if (feed.field2) processedFeed.temperature = parseFloat(feed.field2);
    if (feed.field3) processedFeed.pm25 = parseFloat(feed.field3);
    if (feed.field4) processedFeed.pm10 = parseFloat(feed.field4);

    // Keep the original fields for compatibility
    processedFeed.field1 = feed.field1;
    processedFeed.field2 = feed.field2;
    processedFeed.field3 = feed.field3;
    processedFeed.field4 = feed.field4;
    processedFeed.field5 = feed.field5;
    processedFeed.field6 = feed.field6;
    processedFeed.field7 = feed.field7;
    processedFeed.field8 = feed.field8;

    return processedFeed;
  });

  return {
    channel: rawData.channel,
    data: processedFeeds
  };
}

/**
 * Check connection to ThingSpeak API
 * @returns {Promise<Object>} Connection status
 */
async function checkConnection() {
  try {
    // Try to fetch a single record to check connection
    const response = await axios.get(
      `${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}/feeds.json?results=1`,
      {
        params: { api_key: THINGSPEAK_READ_API_KEY },
        timeout: 5000
      }
    );

    const lastDataUpdate = response.data.feeds && response.data.feeds.length > 0 ?
      new Date(response.data.feeds[0].created_at) : null;

    const now = new Date();
    const dataAge = lastDataUpdate ? (now - lastDataUpdate) / 1000 : null;

    return {
      success: true,
      connected: true,
      channel_exists: true,
      last_data_received: lastDataUpdate,
      data_age_seconds: dataAge,
      data_fresh: dataAge !== null ? dataAge < 3600 : false  // Data less than 1 hour old
    };
  } catch (error) {
    debugHelper.log(`Error checking ThingSpeak connection: ${error.message}`, 'thingspeak', 'error');

    // Check if API is responding at all
    try {
      await axios.get(`${THINGSPEAK_BASE_URL}/status`, { timeout: 3000 });

      // API is up, but our channel might have issues
      return {
        success: false,
        connected: true,
        channel_exists: false,
        error: error.message
      };
    } catch (statusError) {
      // API itself is down
      return {
        success: false,
        connected: false,
        error: 'ThingSpeak API is unreachable'
      };
    }
  }
}

/**
 * Get detailed information about the data source
 * @returns {Promise<Object>} Channel details
 */
async function getDataSourceInfo() {
  // Check cache first
  const cacheKey = `channel_info_${THINGSPEAK_CHANNEL_ID}`;
  const cachedInfo = global.apiCache.get(cacheKey);

  if (cachedInfo) {
    return cachedInfo;
  }

  try {
    const response = await axios.get(
      `${THINGSPEAK_BASE_URL}/channels/${THINGSPEAK_CHANNEL_ID}.json`,
      { params: { api_key: THINGSPEAK_READ_API_KEY } }
    );

    // Store in cache (longer TTL for channel info - 1 hour)
    global.apiCache.set(cacheKey, response.data, 3600);

    return response.data;
  } catch (error) {
    debugHelper.log(`Error fetching data source info: ${error.message}`, 'thingspeak', 'error');
    throw error;
  }
}

/**
 * Get status information about the ThingSpeak channel
 * @returns {Promise<Object>} Channel status
 */
async function getChannelStatus() {
  try {
    const connectionStatus = await checkConnection();

    // Basic status info
    const status = {
      online: connectionStatus.connected,
      maintenance: false,
      last_checked: new Date().toISOString(),
      last_data_received: connectionStatus.last_data_received,
      uptime_percentage: 99.5  // Default placeholder value
    };

    // Try to get API usage info if the connection is good
    if (connectionStatus.connected) {
      try {
        const response = await axios.get(
          `${THINGSPEAK_BASE_URL}/account/rate_limits.json`,
          {
            params: { api_key: THINGSPEAK_READ_API_KEY },
            timeout: 3000
          }
        );

        // Add usage info if available
        if (response.data && response.data.rate_limits) {
          status.usage = {
            rate_limit: response.data.rate_limits.channel_feed_read_minute_limit,
            daily_limit: response.data.rate_limits.channel_feed_read_day_limit,
            remaining: response.data.rate_limits.channel_feed_read_day_remaining,
            reset_time: response.data.rate_limits.channel_feed_read_reset_time
          };
        }
      } catch (usageError) {
        // Usage info is not critical, so just log the error
        debugHelper.log(`Error fetching API usage info: ${usageError.message}`, 'thingspeak');
      }
    }

    return status;
  } catch (error) {
    debugHelper.log(`Error getting channel status: ${error.message}`, 'thingspeak', 'error');

    // Return a default offline status
    return {
      online: false,
      maintenance: false,
      last_checked: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Clear cached data
 * @returns {number} Number of cleared items
 */
function clearCache() {
  return global.apiCache.flushAll();
}

module.exports = {
  getChannelData,
  getRealtimeUpdates,
  getDirectThingspeakData,
  getDataSourceInfo,
  checkConnection,
  getChannelStatus,
  clearCache
};
