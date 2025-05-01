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
      },
      maxRetries: 3,
      timeoutMs: 10000,
      fallbackEnabled: true,
      fallbackDataMaxAge: 86400000 // 24 hours in milliseconds
    };

    // Create cache for 5 minutes by default
    this.cache = new NodeCache({ 
      stdTTL: 300,
      checkperiod: 60,
      useClones: false
    });
    
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
    
    // Try to load config from app-config.json if available
    this.loadConfigFromFile();
    
    // Test connection at startup with retry logic
    this.initializeConnection();
  }

  /**
   * Initialize connection with retry logic
   */
  async initializeConnection() {
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 5000;

    const attemptConnection = async () => {
      try {
        const status = await this.checkConnection();
        
        if (status.success) {
          debugHelper.log('ThingSpeak connection successful');
          this.stats.connectionStatus = true;
        } else {
          debugHelper.error(`ThingSpeak connection failed: ${status.message}`);
          this.stats.connectionStatus = false;
          
          // Retry connection if under retry limit
          if (retryCount < maxRetries) {
            retryCount++;
            debugHelper.log(`Retrying connection (${retryCount}/${maxRetries}) in ${retryDelay}ms...`);
            setTimeout(attemptConnection, retryDelay);
          }
        }
      } catch (err) {
        debugHelper.error(`ThingSpeak connection error: ${err.message}`);
        this.stats.connectionStatus = false;
        
        // Retry connection if under retry limit
        if (retryCount < maxRetries) {
          retryCount++;
          debugHelper.log(`Retrying connection (${retryCount}/${maxRetries}) in ${retryDelay}ms...`);
          setTimeout(attemptConnection, retryDelay);
        }
      }
    };

    // Start connection attempt
    attemptConnection();
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
            writeApiKey: this.config.writeApiKey || configFile.thingspeak.writeApiKey,
            // Ensure fields object exists
            fields: {
              ...this.config.fields,
              ...(configFile.thingspeak.fields || {})
            }
          };
          
          // Make sure fields are properly set even if partially missing in config
          const defaultFields = {
            humidity: 'field1',
            temperature: 'field2',
            pm25: 'field3',
            pm10: 'field4'
          };
          
          this.config.fields = {
            ...defaultFields,
            ...this.config.fields
          };
          
          debugHelper.log('Loaded ThingSpeak configuration from app-config.json');
        }
      }
    } catch (error) {
      debugHelper.error(`Error loading ThingSpeak configuration from file: ${error.message}`);
      // Don't fail - keep using default config
    }
  }
  
  /**
   * Update service configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') {
      debugHelper.error('Invalid configuration update');
      return false;
    }
    
    try {
      // Store old config in case we need to roll back
      const oldConfig = { ...this.config };
      
      // Update config
      this.config = {
        ...this.config,
        ...newConfig,
        // Handle fields separately to allow partial updates
        fields: newConfig.fields ? {
          ...this.config.fields,
          ...newConfig.fields
        } : this.config.fields
      };
      
      // Handle special case for updateInterval (convert string to number)
      if (typeof this.config.updateInterval === 'string') {
        this.config.updateInterval = parseInt(this.config.updateInterval, 10);
        if (isNaN(this.config.updateInterval)) {
          this.config.updateInterval = 30000; // Default to 30 seconds
        }
      }
      
      // If channel ID or API key changes, clear cache
      if (newConfig.channelId !== oldConfig.channelId || 
          newConfig.readApiKey !== oldConfig.readApiKey) {
        this.cache.flushAll();
        debugHelper.log('Configuration changed, cache cleared');
        
        // Re-test connection with new settings
        this.checkConnection().catch(err => {
          debugHelper.error(`Failed to verify new ThingSpeak connection: ${err.message}`);
        });
      }
      
      debugHelper.log('ThingSpeak configuration updated');
      return true;
    } catch (error) {
      debugHelper.error(`Failed to update ThingSpeak configuration: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check if ThingSpeak connection is working
   * @returns {Promise<Object>} Connection status
   */
  async checkConnection() {
    const cacheKey = 'thingspeak-connection-status';
    const cachedStatus = this.cache.get(cacheKey);
    
    // Return cached status if available (cached for 1 minute)
    if (cachedStatus) {
      return cachedStatus;
    }
    
    try {
      // Check if we have the required configuration
      if (!this.config.channelId || !this.config.readApiKey) {
        throw new Error('Missing ThingSpeak channel ID or read API key');
      }
      
      // Basic ping to ThingSpeak API
      const pingUrl = 'https://api.thingspeak.com/ping.json';
      const pingResponse = await axios.get(pingUrl, { timeout: this.config.timeoutMs || 5000 });
      
      if (pingResponse.status !== 200) {
        throw new Error(`ThingSpeak ping failed with status ${pingResponse.status}`);
      }
      
      // Check if channel exists
      const channelUrl = `https://api.thingspeak.com/channels/${this.config.channelId}/feeds.json`;
      const params = { api_key: this.config.readApiKey, results: 1 };
      
      const response = await axios.get(channelUrl, {
        params,
        timeout: this.config.timeoutMs || 5000
      });
      
      // Extract rate limit info if available
      if (response.headers['x-rate-limit-remaining']) {
        this.rateLimitInfo.requestsRemaining = parseInt(response.headers['x-rate-limit-remaining'], 10);
      }
      
      // Check if channel has data
      const hasData = response.data && 
                      response.data.feeds && 
                      Array.isArray(response.data.feeds) && 
                      response.data.feeds.length > 0;
      
      const status = {
        success: true,
        connected: true,
        channel_exists: true,
        channel_has_data: hasData,
        online: true,
        message: hasData ? 'ThingSpeak connection successful' : 'Channel exists but has no data'
      };
      
      // Update stats
      this.stats.lastSuccess = new Date();
      this.stats.connectionStatus = true;
      
      // Cache the status for 1 minute
      this.cache.set(cacheKey, status, 60);
      
      debugHelper.log('ThingSpeak connection check successful');
      return status;
    } catch (error) {
      // Update stats
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
   * Get channel information
   * @returns {Promise<Object>} Channel information
   */
  async getChannelInfo() {
    const cacheKey = 'channel-info';
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    try {
      const url = `https://api.thingspeak.com/channels/${this.config.channelId}/feeds.json`;
      const params = { api_key: this.config.readApiKey, results: 0 };
      
      const response = await axios.get(url, {
        params,
        timeout: this.config.timeoutMs || 5000
      });
      
      // Extract channel info
      if (response.data && response.data.channel) {
        const channelInfo = {
          success: true,
          data: response.data.channel,
          timestamp: new Date().toISOString()
        };
        
        // Cache for 2 hours (unlikely to change)
        this.cache.set(cacheKey, channelInfo, 7200);
        
        debugHelper.log('Retrieved ThingSpeak channel info');
        return channelInfo;
      } else {
        throw new Error('Channel info not available in response');
      }
    } catch (error) {
      const errorInfo = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      debugHelper.error(`Failed to get ThingSpeak channel info: ${error.message}`);
      
      // Cache error briefly
      this.cache.set(cacheKey, errorInfo, 60);
      
      return errorInfo;
    }
  }
  
  /**
   * Get channel feed data with pagination and filtering
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Feed data
   */
  async getChannelData(options = {}) {
    // Update stats
    this.stats.requestCount++;
    this.stats.lastRequest = new Date();
    
    const defaultOptions = {
      results: 100,
      start: null,  // Start date
      end: null,    // End date
      days: null,   // Days to include
      page: 1       // Page number
    };
    
    // Merge options with defaults
    const opts = { ...defaultOptions, ...options };
    
    // Generate cache key based on options
    const cacheKey = `channel-data-${JSON.stringify(opts)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      debugHelper.log('Returning cached channel data');
      return cached;
    }
    
    try {
      // Validate configuration
      if (!this.config.channelId || !this.config.readApiKey) {
        throw new Error('Missing ThingSpeak channel ID or API key');
      }
      
      // Prepare API URL
      const url = `https://api.thingspeak.com/channels/${this.config.channelId}/feeds.json`;
      
      // Build params from options
      const params = {
        api_key: this.config.readApiKey,
        results: opts.results || 100, // Handle null case
        offset: (opts.page - 1) * opts.results
      };
      
      // Add date filtering if provided
      if (opts.start) params.start = opts.start;
      if (opts.end) params.end = opts.end;
      if (opts.days && !opts.start && !opts.end) params.days = opts.days;
      
      // Make API request
      const response = await axios.get(url, {
        params,
        timeout: this.config.timeoutMs || 10000
      });
      
      // Extract rate limit information from headers
      if (response.headers['x-rate-limit-remaining']) {
        this.rateLimitInfo.requestsRemaining = parseInt(response.headers['x-rate-limit-remaining'], 10);
      }
      
      // Check if response has valid structure
      if (!response.data || !response.data.feeds) {
        throw new Error('Invalid response format from ThingSpeak');
      }
      
      const feeds = response.data.feeds;
      
      // Add mapped field names for easier access
      const mappedFeeds = feeds.map(feed => {
        const mapped = { ...feed };
        
        // Map field values to human-readable names based on config
        Object.keys(this.config.fields).forEach(name => {
          const field = this.config.fields[name];
          if (feed[field] !== undefined) {
            mapped[name] = feed[field];
          }
        });
        
        return mapped;
      });
      
      const result = {
        success: true,
        data: mappedFeeds,
        channel: response.data.channel,
        timestamp: new Date().toISOString(),
        pagination: {
          page: opts.page,
          results: opts.results,
          total: parseInt(response.data.channel.last_entry_id, 10) || feeds.length
        }
      };
      
      // Update stats
      this.stats.successCount++;
      this.stats.lastSuccess = new Date();
      
      // Cache the results (5 minutes default)
      this.cache.set(cacheKey, result, 300);
      
      debugHelper.log(`Retrieved ${mappedFeeds.length} ThingSpeak feeds`);
      return result;
    } catch (error) {
      // Update stats
      this.stats.failureCount++;
      this.stats.lastFailure = new Date();
      
      // Add to errors array with timestamp
      if (this.stats.errors.length >= 10) {
        this.stats.errors.shift(); // Remove oldest error
      }
      this.stats.errors.push({
        timestamp: new Date(),
        message: error.message,
        context: 'getChannelData'
      });
      
      const errorResponse = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      debugHelper.error(`Failed to get ThingSpeak data: ${error.message}`);
      
      // Try to find fallback data if enabled
      if (this.config.fallbackEnabled) {
        const fallbackData = this.findFallbackData(opts);
        if (fallbackData) {
          debugHelper.log('Using fallback data for ThingSpeak request');
          fallbackData.fallback = true;
          return fallbackData;
        }
      }
      
      // Cache error briefly to prevent hammering the API
      this.cache.set(cacheKey, errorResponse, 30);
      
      return errorResponse;
    }
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
        const data = this.cache.get(key);
        
        // Check if fallback data is valid and was retrieved recently
        if (data && data.success && data.data && data.timestamp) {
          const dataAge = new Date() - new Date(data.timestamp);
          if (dataAge < this.config.fallbackDataMaxAge) {
            return data;
          }
        }
      }
    }
    
    // If no exact match, try to find any data
    for (const key of keys) {
      if (key.startsWith('channel-data-')) {
        const data = this.cache.get(key);
        
        // Check if fallback data is valid and was retrieved recently
        if (data && data.success && data.data && data.timestamp) {
          const dataAge = new Date() - new Date(data.timestamp);
          if (dataAge < this.config.fallbackDataMaxAge) {
            return data;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Get the latest feed data (single entry)
   * @param {number} results - Number of results to return (default 1)
   * @returns {Promise<Object>} Latest feed data
   */
  async getLatestFeed(results = 1) {
    const cacheKey = `latest-feed-${results}`;
    const cached = this.cache.get(cacheKey);
    
    // Use shorter cache TTL for latest data (1 minute)
    if (cached) {
      debugHelper.log('Returning cached latest feed data');
      return cached;
    }
    
    try {
      const result = await this.getChannelData({ results });
      
      if (!result.success || !result.data || result.data.length === 0) {
        throw new Error('No data available');
      }
      
      // Return single item if results=1, otherwise return the array
      const latestData = {
        success: true,
        data: results === 1 ? result.data[0] : result.data,
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
   * Write data to ThingSpeak
   * @param {Object} data - Data to write (field1, field2, etc.)
   * @returns {Promise<Object>} Write result
   */
  async writeData(data) {
    try {
      if (!this.config.writeApiKey) {
        return { success: false, error: 'Write API key is not configured' };
      }
      
      const url = `https://api.thingspeak.com/update`;
      const params = { api_key: this.config.writeApiKey, ...data };
      
      // Make API request
      const response = await axios.post(url, null, {
        params,
        timeout: this.config.timeoutMs || 10000
      });
      
      // ThingSpeak returns entry ID as response
      const entryId = parseInt(response.data, 10);
      
      if (isNaN(entryId) || entryId <= 0) {
        return { 
          success: false, 
          error: 'Invalid response from ThingSpeak',
          response: response.data
        };
      }
      
      // Update stats
      this.stats.successCount++;
      this.stats.lastSuccess = new Date();
      
      // Invalidate cache for latest feed
      this.cache.del('latest-feed-1');
      
      debugHelper.log(`Successfully wrote data to ThingSpeak (Entry ID: ${entryId})`);
      
      return {
        success: true,
        entryId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      // Update stats
      this.stats.failureCount++;
      this.stats.lastFailure = new Date();
      this.stats.lastError = error.message;
      
      // Add to errors array
      if (this.stats.errors.length >= 10) {
        this.stats.errors.shift();
      }
      this.stats.errors.push({
        timestamp: new Date(),
        message: error.message,
        context: 'writeData'
      });
      
      debugHelper.error(`Failed to write data to ThingSpeak: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Get metrics about ThingSpeak service
   * @returns {Object} Service metrics
   */
  getMetrics() {
    // Calculate usage percentages
    const usagePercent = this.rateLimitInfo.requestsRemaining
      ? Math.round(((1000 - this.rateLimitInfo.requestsRemaining) / 1000) * 100) 
      : 0;
    
    // Calculate success rate
    const successRate = this.stats.requestCount > 0 
      ? Math.round((this.stats.successCount / this.stats.requestCount) * 100)
      : 100;
    
    // Format last request/success/failure times
    const formatTime = (date) => date ? date.toISOString() : null;
    
    return {
      connected: this.stats.connectionStatus,
      requestCount: this.stats.requestCount,
      successCount: this.stats.successCount,
      failureCount: this.stats.failureCount,
      successRate: successRate,
      lastRequest: formatTime(this.stats.lastRequest),
      lastSuccess: formatTime(this.stats.lastSuccess),
      lastFailure: formatTime(this.stats.lastFailure),
      lastError: this.stats.lastError,
      recentErrors: this.stats.errors.slice(0, 5),
      usage: {
        used: 1000 - (this.rateLimitInfo.requestsRemaining || 0),
        remaining: this.rateLimitInfo.requestsRemaining || 0,
        daily_limit: 1000,
        percent: usagePercent
      },
      config: {
        // Sanitized config - no API keys
        channelId: this.config.channelId,
        updateInterval: this.config.updateInterval,
        fields: this.config.fields,
        fallbackEnabled: this.config.fallbackEnabled
      }
    };
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
        error: error.message,
        message: 'Failed to reach ThingSpeak API'
      });
      
      // If ping fails, don't continue with other tests
      return {
        success: false,
        tests
      };
    }
    
    // Test 2: Channel validation
    try {
      const channelStart = Date.now();
      const channelUrl = `https://api.thingspeak.com/channels/${channelId}.json`;
      const params = { api_key: readApiKey };
      
      const channelResponse = await axios.get(channelUrl, { 
        params,
        timeout: 5000 
      });
      const channelTime = Date.now() - channelStart;
      
      // ThingSpeak returns channel details on success
      if (channelResponse.data && channelResponse.data.id) {
        tests.push({
          name: 'Channel Validation',
          success: true,
          time: channelTime,
          message: `Channel ${channelId} exists`,
          details: {
            name: channelResponse.data.name,
            description: channelResponse.data.description,
            created_at: channelResponse.data.created_at,
            id: channelResponse.data.id
          }
        });
      } else {
        overallSuccess = false;
        tests.push({
          name: 'Channel Validation',
          success: false,
          time: channelTime,
          message: 'Invalid channel response'
        });
      }
    } catch (error) {
      overallSuccess = false;
      tests.push({
        name: 'Channel Validation',
        success: false,
        error: error.message,
        message: error.response?.status === 404 
          ? `Channel ${channelId} not found` 
          : error.response?.status === 401
            ? 'Invalid API key'
            : `Channel validation failed: ${error.message}`
      });
    }
    
    // Test 3: Data retrieval
    try {
      const dataStart = Date.now();
      const dataUrl = `https://api.thingspeak.com/channels/${channelId}/feeds/last.json`;
      const params = { api_key: readApiKey };
      
      const dataResponse = await axios.get(dataUrl, { 
        params,
        timeout: 5000
      });
      const dataTime = Date.now() - dataStart;
      
      if (dataResponse.data && Object.keys(dataResponse.data).length > 0) {
        tests.push({
          name: 'Data Retrieval',
          success: true,
          time: dataTime,
          message: 'Successfully retrieved data',
          details: {
            entry_id: dataResponse.data.entry_id,
            created_at: dataResponse.data.created_at,
            fields: Object.keys(dataResponse.data).filter(k => k.startsWith('field')).length
          }
        });
      } else {
        overallSuccess = false;
        tests.push({
          name: 'Data Retrieval',
          success: false,
          time: dataTime,
          message: 'No data available in channel'
        });
      }
    } catch (error) {
      overallSuccess = false;
      tests.push({
        name: 'Data Retrieval',
        success: false,
        error: error.message,
        message: `Failed to retrieve data: ${error.message}`
      });
    }
    
    // Test 4: Check rate limits
    try {
      const rateStart = Date.now();
      const rateResponse = await axios.head('https://api.thingspeak.com/channels/public.json', { 
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
        error: error.message,
        message: 'Failed to check rate limits'
      });
    }
    
    // Test 5: Field mapping validation
    try {
      // Get channel field details
      const fieldsStart = Date.now();
      const fieldsUrl = `https://api.thingspeak.com/channels/${channelId}/feeds.json`;
      const params = { api_key: readApiKey, results: 1 };
      
      const fieldsResponse = await axios.get(fieldsUrl, { 
        params,
        timeout: 5000
      });
      const fieldsTime = Date.now() - fieldsStart;
      
      const channel = fieldsResponse.data?.channel;
      
      if (channel) {
        // Check field names against our mapping
        const fieldMappings = this.config.fields;
        const mappingCheck = [];
        
        // Verify field mappings against actual channel fields
        for (const [name, fieldId] of Object.entries(fieldMappings)) {
          const fieldName = channel[`${fieldId}_name`];
          const fieldDesc = channel[`${fieldId}_description`];
          
          mappingCheck.push({
            name,
            field: fieldId,
            channelName: fieldName || '',
            valid: !!fieldName
          });
        }
        
        tests.push({
          name: 'Field Mapping Validation',
          success: mappingCheck.every(f => f.valid),
          time: fieldsTime,
          message: mappingCheck.every(f => f.valid) 
            ? 'Field mappings are valid' 
            : 'Some field mappings are invalid',
          details: mappingCheck
        });
        
        if (!mappingCheck.every(f => f.valid)) {
          overallSuccess = false;
        }
      } else {
        tests.push({
          name: 'Field Mapping Validation',
          success: false,
          time: fieldsTime,
          message: 'Unable to validate field mappings (channel info missing)'
        });
      }
    } catch (error) {
      tests.push({
        name: 'Field Mapping Validation',
        success: false,
        error: error.message,
        message: `Failed to validate field mappings: ${error.message}`
      });
    }
    
    return {
      success: overallSuccess,
      channelId,
      timestamp: new Date().toISOString(),
      tests
    };
  }
  
  /**
   * Clear cache
   * @param {string} [key] - Specific cache key to clear, or all if not provided
   * @returns {number} Number of cleared items
   */
  clearCache(key = null) {
    try {
      if (key) {
        const success = this.cache.del(key);
        debugHelper.log(`Cleared cache key: ${key}`);
        return success ? 1 : 0;
      } else {
        const keys = this.cache.keys();
        const count = keys.length;
        this.cache.flushAll();
        debugHelper.log(`Cleared all ${count} cache items`);
        return count;
      }
    } catch (error) {
      debugHelper.error(`Error clearing cache: ${error.message}`);
      return 0;
    }
  }
}

// Create and export a singleton instance
module.exports = new ThingSpeakService();
