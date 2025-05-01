/**
 * ThingSpeak Service
 * Handles server-side communication with ThingSpeak API
 */
const axios = require('axios');
const NodeCache = require('node-cache');
const path = require('path');
const fs = require('fs');

// Try to import debug helper, use simple console logging if not available
let debugHelper;
try {
  debugHelper = require('../helpers/debug-helper');
} catch (e) {
  debugHelper = {
    log: (msg, context = 'thingspeak-service', level = 'info') => console.log(`[${context}] ${msg}`),
    error: (msg, context = 'thingspeak-service') => console.error(`[${context}] ${msg}`)
  };
}

class ThingSpeakService {
  constructor() {
    // Initialize configuration from environment variables
    this.config = {
      channelId: process.env.THINGSPEAK_CHANNEL_ID || '2863798',
      readApiKey: process.env.THINGSPEAK_READ_API_KEY || 'RIXYDDDMXDBX9ALI',
      writeApiKey: process.env.THINGSPEAK_WRITE_API_KEY || '',
      updateInterval: 30000,
      fields: {
        humidity: 'field1',
        temperature: 'field2',
        pm25: 'field3',
        pm10: 'field4'
      }
    };

    // Create cache for 5 minutes
    this.cache = new NodeCache({ stdTTL: 300 });
    
    // Stats for monitoring
    this.stats = {
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      lastRequest: null,
      lastSuccess: null,
      lastFailure: null,
      lastError: null,
      errors: [],
      connectionStatus: false
    };

    // Rate limiting tracker
    this.rateLimitInfo = {
      requestsRemaining: 1000,
      dailyLimit: 1000
    };
    
    // Check if API keys are available
    if (!this.config.readApiKey) {
      debugHelper.error('No ThingSpeak read API key found in environment variables.');
    }
    
    // Test connection at startup
    this.checkConnection()
      .then(status => {
        if (status.success) {
          debugHelper.log('ThingSpeak connection successful');
          this.stats.connectionStatus = true;
        } else {
          debugHelper.error(`ThingSpeak connection failed: ${status.message}`);
          this.stats.connectionStatus = false;
        }
      })
      .catch(err => {
        debugHelper.error(`ThingSpeak connection error: ${err.message}`);
        this.stats.connectionStatus = false;
      });

    // Try to load config from app-config.json if available
    this.loadConfigFromFile();
  }

  /**
   * Load configuration from app-config.json if available
   */
  loadConfigFromFile() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'app-config.json');
      if (fs.existsSync(configPath)) {
        const configFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (configFile.thingspeak) {
          // Update config from file but keep env variables as fallback
          this.config = {
            ...this.config,
            ...configFile.thingspeak,
            // Don't override API keys if they are already set from environment
            readApiKey: this.config.readApiKey || configFile.thingspeak.readApiKey,
            writeApiKey: this.config.writeApiKey || configFile.thingspeak.writeApiKey
          };
          debugHelper.log('Loaded ThingSpeak configuration from app-config.json');
        }
      }
    } catch (error) {
      debugHelper.error(`Error loading ThingSpeak configuration from file: ${error.message}`);
    }
  }

  /**
   * Update service configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    
    // Clear cache after configuration change
    this.cache.flushAll();
    
    debugHelper.log('ThingSpeak configuration updated');
  }

  /**
   * Check if ThingSpeak connection is working
   * @returns {Promise<Object>} Connection status
   */
  async checkConnection() {
    const cacheKey = 'connection-status';
    const cachedStatus = this.cache.get(cacheKey);
    
    if (cachedStatus) {
      return cachedStatus;
    }
    
    try {
      const channelId = this.config.channelId;
      const readApiKey = this.config.readApiKey;
      
      if (!channelId) {
        return { 
          success: false, 
          connected: false, 
          message: 'No ThingSpeak channel ID configured',
          online: false
        };
      }
      
      // Make a small request to check if ThingSpeak is responding
      const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json`;
      const params = {
        api_key: readApiKey,
        results: 1
      };
      
      this.stats.requestCount++;
      this.stats.lastRequest = new Date();
      
      const response = await axios.get(url, { params, timeout: 5000 });
      
      // Track rate limits
      if (response.headers['x-rate-limit-remaining']) {
        this.rateLimitInfo.requestsRemaining = parseInt(response.headers['x-rate-limit-remaining']);
      }
      
      if (response.headers['x-rate-limit-limit']) {
        this.rateLimitInfo.dailyLimit = parseInt(response.headers['x-rate-limit-limit']);
      }
      
      const status = {
        success: true,
        connected: true,
        channel_exists: true,
        data_available: response.data?.feeds?.length > 0,
        data_fresh: false,
        data_age_seconds: null,
        last_data_received: null,
        online: true,
        message: 'Connection successful'
      };
      
      // Check freshness of data
      if (response.data?.feeds?.length > 0) {
        const latestEntry = response.data.feeds[0];
        const entryDate = new Date(latestEntry.created_at);
        const now = new Date();
        const ageInSeconds = Math.floor((now - entryDate) / 1000);
        
        status.data_age_seconds = ageInSeconds;
        status.last_data_received = entryDate.toISOString();
        
        // Consider data fresh if less than 1 hour old
        status.data_fresh = ageInSeconds < 3600;
      }
      
      this.stats.successCount++;
      this.stats.lastSuccess = new Date();
      this.stats.connectionStatus = true;
      
      // Cache the result for 5 minutes
      this.cache.set(cacheKey, status, 300);
      
      return status;
    } catch (error) {
      this.stats.failureCount++;
      this.stats.lastFailure = new Date();
      this.stats.connectionStatus = false;
      this.stats.lastError = error.message;
      
      // Store error but limit array size
      if (this.stats.errors.length >= 10) {
        this.stats.errors.shift(); // Remove oldest error
      }
      this.stats.errors.push({
        timestamp: new Date(),
        message: error.message,
        code: error.code || 'UNKNOWN'
      });
      
      let errorMessage = 'Connection failed';
      let statusCode = 500;
      
      if (error.response) {
        statusCode = error.response.status;
        errorMessage = `HTTP error ${statusCode}`;
        
        // Handle specific error codes
        if (statusCode === 404) {
          errorMessage = 'Channel not found';
        } else if (statusCode === 401) {
          errorMessage = 'Invalid API key';
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout';
      } else if (error.code === 'ENOTFOUND') {
        errorMessage = 'ThingSpeak server not found';
      }
      
      const status = {
        success: false,
        connected: false,
        channel_exists: statusCode !== 404,
        online: statusCode < 500 && statusCode !== 0,
        message: errorMessage
      };
      
      // Only cache errors briefly to allow for quick recovery
      this.cache.set(cacheKey, status, 60);
      
      debugHelper.error(`ThingSpeak connection check failed: ${errorMessage}`);
      return status;
    }
  }

  /**
   * Get ThingSpeak channel data with caching
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Channel data response
   */
  async getChannelData(options = {}) {
    const { results = 100, days, start, end } = options;
    const cacheKey = `channel-data-${JSON.stringify(options)}`;
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      debugHelper.log(`Returning cached ThingSpeak data for ${cacheKey}`);
      return cached;
    }
    
    try {
      // Build URL and parameters
      const channelId = this.config.channelId;
      const readApiKey = this.config.readApiKey;
      
      if (!channelId) {
        throw new Error('ThingSpeak channel ID not configured');
      }
      
      const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json`;
      const params = {
        api_key: readApiKey,
        results
      };
      
      // Add optional parameters
      if (days) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        params.start = startDate.toISOString();
        params.end = endDate.toISOString();
      } else {
        if (start) params.start = start;
        if (end) params.end = end;
      }
      
      this.stats.requestCount++;
      this.stats.lastRequest = new Date();
      
      const response = await axios.get(url, { params, timeout: 10000 });
      
      // Process and normalize data
      const data = this.normalizeChannelData(response.data);
      
      // Update stats
      this.stats.successCount++;
      this.stats.lastSuccess = new Date();
      
      // Track rate limits
      if (response.headers['x-rate-limit-remaining']) {
        this.rateLimitInfo.requestsRemaining = parseInt(response.headers['x-rate-limit-remaining']);
      }
      
      if (response.headers['x-rate-limit-limit']) {
        this.rateLimitInfo.dailyLimit = parseInt(response.headers['x-rate-limit-limit']);
      }
      
      // Create response object
      const result = {
        success: true,
        data: data.feeds,
        channel: data.channel,
        timestamp: new Date().toISOString()
      };
      
      // Calculate time range
      if (data.feeds && data.feeds.length > 0) {
        result.timeRange = this.calculateTimeRange(data.feeds);
      }
      
      // Cache results (larger result sets get shorter cache time)
      const cacheTime = Math.max(60, 300 - Math.floor(results / 100));
      this.cache.set(cacheKey, result, cacheTime);
      
      return result;
    } catch (error) {
      // Track error
      this.stats.failureCount++;
      this.stats.lastFailure = new Date();
      this.stats.lastError = error.message;
      
      // Store error but limit array size
      if (this.stats.errors.length >= 10) {
        this.stats.errors.shift(); // Remove oldest error
      }
      this.stats.errors.push({
        timestamp: new Date(),
        message: error.message,
        code: error.code || 'UNKNOWN',
        options
      });
      
      debugHelper.error(`Failed to get ThingSpeak data: ${error.message}`);
      
      // Return fallback data from cache if available
      const fallbackData = this.findFallbackData(options);
      if (fallbackData) {
        debugHelper.log('Using fallback data from cache for similar query');
        return {
          ...fallbackData,
          success: true,
          fallback: true,
          message: 'Using fallback data due to API error'
        };
      }
      
      // No fallback available
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get the latest feed data (single entry)
   * @returns {Promise<Object>} Latest feed data
   */
  async getLatestFeed() {
    const cacheKey = 'latest-feed';
    const cached = this.cache.get(cacheKey);
    
    // Use shorter cache TTL for latest data
    if (cached) {
      debugHelper.log('Returning cached latest feed data');
      return cached;
    }
    
    try {
      const result = await this.getChannelData({ results: 1 });
      
      if (!result.success || !result.data || result.data.length === 0) {
        throw new Error('No data available');
      }
      
      const latestData = {
        success: true,
        data: result.data[0],
        timestamp: new Date().toISOString()
      };
      
      // Cache for a shorter time (1 minute)
      this.cache.set(cacheKey, latestData, 60);
      
      return latestData;
    } catch (error) {
      debugHelper.error(`Failed to get latest feed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get channel fields configuration
   * @returns {Promise<Object>} Channel fields info
   */
  async getChannelFields() {
    const cacheKey = 'channel-fields';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    try {
      const channelId = this.config.channelId;
      const readApiKey = this.config.readApiKey;
      
      if (!channelId) {
        throw new Error('ThingSpeak channel ID not configured');
      }
      
      const url = `https://api.thingspeak.com/channels/${channelId}.json`;
      const params = {
        api_key: readApiKey
      };
      
      this.stats.requestCount++;
      this.stats.lastRequest = new Date();
      
      const response = await axios.get(url, { params, timeout: 5000 });
      
      const channel = response.data;
      const fields = {};
      
      // Extract field names
      for (let i = 1; i <= 8; i++) {
        const fieldName = channel[`field${i}`];
        if (fieldName) {
          fields[`field${i}`] = fieldName;
        }
      }
      
      // Map standard field names to field numbers
      const mapping = {
        humidity: this.findFieldByName(fields, ['humidity', 'humid', 'rh']),
        temperature: this.findFieldByName(fields, ['temperature', 'temp']),
        pm25: this.findFieldByName(fields, ['pm2.5', 'pm25', 'finedust']),
        pm10: this.findFieldByName(fields, ['pm10', 'coarsedust'])
      };
      
      const result = {
        success: true,
        fields,
        mapping
      };
      
      this.cache.set(cacheKey, result, 3600); // Cache for 1 hour
      return result;
    } catch (error) {
      debugHelper.error(`Failed to get channel fields: ${error.message}`);
      return {
        success: false,
        error: error.message,
        fields: {}
      };
    }
  }

  /**
   * Get realtime updates since a specific entry
   * @param {number} lastEntryId - Last known entry ID
   * @returns {Promise<Object>} New entries since lastEntryId
   */
  async getRealtimeUpdates(lastEntryId = 0) {
    try {
      if (!lastEntryId) {
        // If no lastEntryId is provided, just return the latest entry
        return this.getLatestFeed();
      }
      
      // First get channel info to check last entry ID
      const channelId = this.config.channelId;
      const readApiKey = this.config.readApiKey;
      
      if (!channelId) {
        throw new Error('ThingSpeak channel ID not configured');
      }
      
      // Get channel info
      const infoUrl = `https://api.thingspeak.com/channels/${channelId}.json`;
      const infoResponse = await axios.get(infoUrl, { 
        params: { api_key: readApiKey },
        timeout: 5000
      });
      
      const currentLastEntryId = parseInt(infoResponse.data.last_entry_id);
      
      // No new entries
      if (currentLastEntryId <= lastEntryId) {
        return {
          success: true,
          message: 'No new entries',
          data: { feeds: [], channel: infoResponse.data },
          timestamp: new Date().toISOString()
        };
      }
      
      // Calculate how many entries to fetch (up to 100)
      const entriesToFetch = Math.min(currentLastEntryId - lastEntryId, 100);
      
      // Get new entries
      const feedsUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json`;
      const feedsResponse = await axios.get(feedsUrl, {
        params: { 
          api_key: readApiKey,
          results: entriesToFetch
        },
        timeout: 8000
      });
      
      // Filter entries that are newer than lastEntryId
      const newFeeds = feedsResponse.data.feeds.filter(feed => 
        parseInt(feed.entry_id) > lastEntryId
      );
      
      // Normalize data
      const normalizedFeeds = newFeeds.map(feed => this.normalizeFeedEntry(feed));
      
      return {
        success: true,
        data: {
          feeds: normalizedFeeds,
          channel: infoResponse.data
        },
        lastEntryId: currentLastEntryId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      debugHelper.error(`Failed to get realtime updates: ${error.message}`);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test the full connection to ThingSpeak with diagnostics
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Test results
   */
  async testConnection(options = {}) {
    const channelId = options.channelId || this.config.channelId;
    const readApiKey = options.readApiKey || this.config.readApiKey;
    
    const tests = [];
    let overallSuccess = true;
    
    // Test 1: Simple ping test
    try {
      const pingStart = Date.now();
      const pingResponse = await axios.get('https://api.thingspeak.com/ping.json', { timeout: 5000 });
      const pingTime = Date.now() - pingStart;
      
      tests.push({
        name: 'ThingSpeak API Ping',
        success: pingResponse.status === 200,
        time: pingTime,
        message: 'ThingSpeak API is reachable'
      });
    } catch (error) {
      overallSuccess = false;
      tests.push({
        name: 'ThingSpeak API Ping',
        success: false,
        message: `Ping failed: ${error.message}`,
        error: error.message
      });
    }
    
    // Test 2: Channel validation
    try {
      const channelStart = Date.now();
      const channelUrl = `https://api.thingspeak.com/channels/${channelId}.json`;
      const channelResponse = await axios.get(channelUrl, {
        params: { api_key: readApiKey },
        timeout: 5000
      });
      const channelTime = Date.now() - channelStart;
      
      tests.push({
        name: 'Channel Validation',
        success: true,
        time: channelTime,
        message: `Channel ${channelId} exists`,
        details: {
          channel_name: channelResponse.data.name,
          field_count: Object.keys(channelResponse.data).filter(k => k.startsWith('field')).length
        }
      });
    } catch (error) {
      overallSuccess = false;
      let errorMsg = 'Channel validation failed';
      
      if (error.response && error.response.status === 404) {
        errorMsg = `Channel ${channelId} not found`;
      } else if (error.response && error.response.status === 401) {
        errorMsg = 'Invalid API key';
      }
      
      tests.push({
        name: 'Channel Validation',
        success: false,
        message: errorMsg,
        error: error.message
      });
    }
    
    // Test 3: Data retrieval
    try {
      const dataStart = Date.now();
      const dataUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json`;
      const dataResponse = await axios.get(dataUrl, {
        params: { 
          api_key: readApiKey,
          results: 1
        },
        timeout: 5000
      });
      const dataTime = Date.now() - dataStart;
      
      const hasData = dataResponse.data.feeds && dataResponse.data.feeds.length > 0;
      
      tests.push({
        name: 'Data Retrieval',
        success: hasData,
        time: dataTime,
        message: hasData ? 'Successfully retrieved data' : 'Channel exists but has no data',
        details: {
          entries_found: dataResponse.data.feeds?.length || 0
        }
      });
      
      if (!hasData) {
        overallSuccess = false;
      }
    } catch (error) {
      overallSuccess = false;
      tests.push({
        name: 'Data Retrieval',
        success: false,
        message: `Data retrieval failed: ${error.message}`,
        error: error.message
      });
    }
    
    // Test 4: Rate limit check
    try {
      const rateStart = Date.now();
      const rateResponse = await axios.get(`https://api.thingspeak.com/channels/${channelId}/status.json`, {
        params: { api_key: readApiKey },
        timeout: 5000
      });
      const rateTime = Date.now() - rateStart;
      
      let remaining = 'Unknown';
      let limit = 'Unknown';
      
      if (rateResponse.headers['x-rate-limit-remaining']) {
        remaining = rateResponse.headers['x-rate-limit-remaining'];
      }
      
      if (rateResponse.headers['x-rate-limit-limit']) {
        limit = rateResponse.headers['x-rate-limit-limit'];
      }
      
      tests.push({
        name: 'API Rate Limits',
        success: true,
        time: rateTime,
        message: `${remaining} of ${limit} requests remaining`,
        details: {
          remaining,
          limit
        }
      });
    } catch (error) {
      // This test is non-critical, so we don't set overallSuccess to false
      tests.push({
        name: 'API Rate Limits',
        success: false,
        message: `Rate limit check failed: ${error.message}`,
        error: error.message,
        details: { critical: false }
      });
    }
    
    return {
      success: overallSuccess,
      tests,
      timestamp: new Date().toISOString(),
      channel_id: channelId
    };
  }

  /**
   * Get statistics about the ThingSpeak service
   * @returns {Object} Service statistics
   */
  getStats() {
    const successRate = this.stats.requestCount > 0 
      ? Math.round((this.stats.successCount / this.stats.requestCount) * 100)
      : 100;
      
    return {
      connectionStatus: this.stats.connectionStatus,
      requestCount: this.stats.requestCount,
      successCount: this.stats.successCount,
      failureCount: this.stats.failureCount,
      successRate,
      lastRequest: this.stats.lastRequest,
      lastSuccess: this.stats.lastSuccess,
      lastFailure: this.stats.lastFailure,
      lastError: this.stats.lastError,
      errors: this.stats.errors,
      rateLimits: this.rateLimitInfo,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear all or specific cache entries
   * @param {string} type - Type of cache to clear (all, data, connection)
   * @returns {number} Number of cleared items
   */
  clearCache(type = 'all') {
    if (type === 'all') {
      return this.cache.flushAll();
    }
    
    const keys = this.cache.keys();
    let count = 0;
    
    keys.forEach(key => {
      if (
        (type === 'data' && key.startsWith('channel-data')) ||
        (type === 'connection' && key === 'connection-status') ||
        (type === 'latest' && key === 'latest-feed')
      ) {
        this.cache.del(key);
        count++;
      }
    });
    
    return count;
  }

  /**
   * Find a cache entry that can serve as fallback data for a similar query
   * @param {Object} options - Original query options
   * @returns {Object|null} Fallback data or null
   */
  findFallbackData(options) {
    const keys = this.cache.keys();
    
    // Try to find data with exactly matching results count
    for (const key of keys) {
      if (key.startsWith('channel-data-') && key.includes(`"results":${options.results}`)) {
        return this.cache.get(key);
      }
    }
    
    // Try to find data with similar results count
    for (const key of keys) {
      if (key.startsWith('channel-data-')) {
        return this.cache.get(key);
      }
    }
    
    return null;
  }

  /**
   * Normalize ThingSpeak channel data
   * @param {Object} data - Raw API response
   * @returns {Object} Normalized data
   */
  normalizeChannelData(data) {
    if (!data || !data.channel || !Array.isArray(data.feeds)) {
      throw new Error('Invalid ThingSpeak data format');
    }
    
    // Normalize feeds
    const normalizedFeeds = data.feeds.map(feed => this.normalizeFeedEntry(feed));
    
    return {
      channel: data.channel,
      feeds: normalizedFeeds
    };
  }

  /**
   * Normalize a single feed entry
   * @param {Object} feed - Raw feed entry
   * @returns {Object} Normalized entry
   */
  normalizeFeedEntry(feed) {
    return {
      entry_id: feed.entry_id,
      created_at: feed.created_at,
      // Original fields
      field1: feed.field1,
      field2: feed.field2,
      field3: feed.field3,
      field4: feed.field4,
      field5: feed.field5,
      field6: feed.field6,
      field7: feed.field7,
      field8: feed.field8,
      // Semantic fields (based on config mapping)
      humidity: feed[this.config.fields.humidity] || feed.field1,
      temperature: feed[this.config.fields.temperature] || feed.field2,
      pm25: feed[this.config.fields.pm25] || feed.field3,
      pm10: feed[this.config.fields.pm10] || feed.field4
    };
  }

  /**
   * Calculate time range for a set of feeds
   * @param {Array} feeds - Array of feed entries
   * @returns {Object} Time range info
   */
  calculateTimeRange(feeds) {
    if (!feeds || feeds.length === 0) {
      return {
        start: null,
        end: null,
        duration_seconds: 0
      };
    }
    
    const startDate = new Date(feeds[feeds.length - 1].created_at);
    const endDate = new Date(feeds[0].created_at);
    const durationSeconds = Math.floor((endDate - startDate) / 1000);
    
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      duration_seconds: durationSeconds,
      count: feeds.length
    };
  }

  /**
   * Find field number based on field name
   * @param {Object} fields - Channel fields
   * @param {Array} possibleNames - Possible field names to match
   * @returns {string} Field key (e.g., 'field1')
   */
  findFieldByName(fields, possibleNames) {
    for (const [field, name] of Object.entries(fields)) {
      if (possibleNames.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
        return field;
      }
    }
    
    // Return default values if not found based on standard mapping
    if (possibleNames.includes('humidity')) return 'field1';
    if (possibleNames.includes('temperature')) return 'field2';
    if (possibleNames.includes('pm25')) return 'field3';
    if (possibleNames.includes('pm10')) return 'field4';
    
    return null;
  }
}

// Create and export a singleton instance
module.exports = new ThingSpeakService();
