/**
 * ThingSpeak API Service
 * Handles communication with ThingSpeak data channels
 */
require('dotenv').config();
const axios = require('axios');
const NodeCache = require('node-cache');
const debugHelper = require('../helpers/debug-helper');

// Cache configuration
const apiCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// ThingSpeak API configuration
const config = {
    baseUrl: 'https://api.thingspeak.com',
    channelId: process.env.THINGSPEAK_CHANNEL_ID || '12397',
    readApiKey: process.env.THINGSPEAK_READ_API_KEY || '',
    fieldMapping: {
        humidity: 'field1',
        temperature: 'field2',
        pm25: 'field3',
        pm10: 'field4'
    }
};

/**
 * Get data from ThingSpeak channel
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Channel data
 */
async function getChannelData(options = {}) {
    const results = options.results || 100;
    const start = options.start || null;
    const end = options.end || null;
    const page = options.page || null;
    
    // Create cache key based on options
    const cacheKey = `channel_data_${config.channelId}_${results}_${start}_${end}_${page}`;
    
    // Check cache first
    const cachedData = apiCache.get(cacheKey);
    if (cachedData && !options.noCache) {
        debugHelper.log(`Retrieved data from cache: ${cacheKey}`, 'thingspeak');
        return { success: true, data: cachedData, fromCache: true };
    }
    
    try {
        // Build query parameters
        const params = {
            results,
            api_key: config.readApiKey
        };
        
        if (start) params.start = start;
        if (end) params.end = end;
        if (page) params.page = page;
        
        // Make API request
        debugHelper.log(`Fetching data from ThingSpeak: results=${results}`, 'thingspeak');
        const response = await axios.get(`${config.baseUrl}/channels/${config.channelId}/feeds.json`, { params });
        
        // Process channel data
        const channelData = response.data;
        
        // Post-process data for easier client use
        const processedData = processData(channelData);
        
        // Store in cache
        apiCache.set(cacheKey, processedData);
        
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
 * Get realtime updates since a specific entry ID
 * @param {number} lastEntryId - Last received entry ID
 * @returns {Promise<Object>} New data since last entry
 */
async function getRealtimeUpdates(lastEntryId) {
    try {
        // If no last entry ID, just return latest entry
        if (!lastEntryId || lastEntryId === 0) {
            const params = {
                results: 1,
                api_key: config.readApiKey
            };
            
            const response = await axios.get(`${config.baseUrl}/channels/${config.channelId}/feeds.json`, { params });
            const processedData = processData(response.data);
            
            return { success: true, data: processedData };
        }
        
        // If we have a last entry ID, get entries greater than that ID
        const params = {
            api_key: config.readApiKey
        };
        
        const response = await axios.get(
            `${config.baseUrl}/channels/${config.channelId}/feeds.json?results=50`, 
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
            `${config.baseUrl}/channels/${config.channelId}/feeds.json?results=1`, 
            { 
                params: { api_key: config.readApiKey },
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
            await axios.get(`${config.baseUrl}/status`, { timeout: 3000 });
            
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
    const cacheKey = `channel_info_${config.channelId}`;
    const cachedInfo = apiCache.get(cacheKey);
    
    if (cachedInfo) {
        return cachedInfo;
    }
    
    try {
        const response = await axios.get(
            `${config.baseUrl}/channels/${config.channelId}.json`,
            { params: { api_key: config.readApiKey } }
        );
        
        // Store in cache (longer TTL for channel info - 1 hour)
        apiCache.set(cacheKey, response.data, 3600);
        
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
                    `${config.baseUrl}/account/rate_limits.json`,
                    { 
                        params: { api_key: config.readApiKey },
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
    return apiCache.flushAll();
}

/**
 * Test basic ThingSpeak connection
 * @returns {Promise<Object>} Connection test result
 */
async function testConnection() {
  try {
    const response = await axios.get('https://api.thingspeak.com/channels.json', {
      timeout: 5000
    });
    return { success: true, status: response.status };
  } catch (error) {
    console.error('ThingSpeak connection test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test access to the configured ThingSpeak channel
 * @returns {Promise<Object>} Channel access test result
 */
async function testChannelAccess() {
  try {
    const config = getThingspeakConfig();
    const url = `https://api.thingspeak.com/channels/${config.channelId}/feeds.json?api_key=${config.readApiKey}&results=1`;
    
    const response = await axios.get(url, { timeout: 5000 });
    
    if (response.data && response.data.feeds && response.data.feeds.length > 0) {
      return { success: true, channelId: config.channelId };
    } else {
      return { success: false, message: 'No data found in channel' };
    }
  } catch (error) {
    console.error('ThingSpeak channel access test failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test data retrieval from ThingSpeak
 * @returns {Promise<Object>} Data retrieval test result
 */
async function testDataRetrieval() {
  try {
    const config = getThingspeakConfig();
    const startTime = Date.now();
    
    const data = await fetchLatestData();
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      responseTime: duration,
      recordCount: data.length,
      sample: data.slice(0, 1)
    };
  } catch (error) {
    console.error('ThingSpeak data retrieval test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Function to get ThingSpeak configuration
function getThingspeakConfig() {
  try {
    // Try to import the config service
    const configService = require('./config-service');
    const config = configService.getConfig();
    return config.thingspeak;
  } catch (error) {
    // Fallback to default config
    return {
      channelId: process.env.THINGSPEAK_CHANNEL_ID || '12397',
      readApiKey: process.env.THINGSPEAK_READ_API_KEY || '',
      updateInterval: parseInt(process.env.THINGSPEAK_UPDATE_INTERVAL || 30000)
    };
  }
}

module.exports = {
    getChannelData,
    getRealtimeUpdates,
    checkConnection,
    getDataSourceInfo,
    getChannelStatus,
    clearCache,
    testConnection,
    testChannelAccess,
    testDataRetrieval
};
