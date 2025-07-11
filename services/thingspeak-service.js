/**
 * ThingSpeak Service
 * Handles server-side communication with ThingSpeak API
 */
const axios = require('axios');
const THINGSPEAK_CONFIG = require('../config/thingspeak-consolidated');

class ThingSpeakService {
<<<<<<< HEAD
    constructor() {
        this.config = THINGSPEAK_CONFIG;
        this.lastFetchTime = null;
        this.cache = new Map();
        this.cacheTimeout = 60000; // 1 minute cache
    }

    /**
     * Test ThingSpeak connectivity and channel access
     */
    async testConnection() {
        try {
            console.log('🔍 Testing ThingSpeak Connection...');
            console.log(`Channel ID: ${this.config.CHANNEL.ID}`);
            console.log(`API URL: ${this.config.buildChannelUrl()}`);

            const response = await axios.get(this.config.buildChannelUrl(), {
                timeout: this.config.SETTINGS.TIMEOUT
            });

            if (response.status === 200 && response.data) {
                const channelData = response.data;
                
                // Update status with live data
                this.config.STATUS.LAST_VERIFIED = new Date().toISOString();
                this.config.STATUS.ACTIVE = true;
                
                if (channelData.last_entry_id) {
                    this.config.STATUS.DATA_POINTS = parseInt(channelData.last_entry_id);
                }

                console.log('✅ ThingSpeak Connection Successful');
                console.log(`✅ Channel: ${channelData.name || this.config.CHANNEL.NAME}`);
                console.log(`✅ Last Entry ID: ${channelData.last_entry_id}`);
                console.log(`✅ Created: ${channelData.created_at}`);
                console.log(`✅ Updated: ${channelData.updated_at}`);

                return {
                    success: true,
                    channel: channelData,
                    config: this.config.getStatusSummary(),
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error('Invalid response from ThingSpeak API');
            }
        } catch (error) {
            console.error('❌ ThingSpeak Connection Failed:', error.message);
            
            this.config.STATUS.ACTIVE = false;
            
            return {
                success: false,
                error: error.message,
                config: this.config.getStatusSummary(),
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Fetch comprehensive channel data with analysis
     */
    async fetchAllChannelData(options = {}) {
        const {
            includeAnalysis = true,
            chunkSize = 8000,
            onProgress = null
        } = options;

        try {
            console.log('📊 Fetching ALL ThingSpeak data...');
            console.log(`Channel: ${this.config.CHANNEL.ID}`);
            console.log(`Chunk size: ${chunkSize}`);

            let allData = [];
            let totalFetched = 0;
            let hasMoreData = true;
            let attempts = 0;
            const maxAttempts = 20; // Safety limit

            while (hasMoreData && attempts < maxAttempts) {
                attempts++;
                
                // Progress callback
                if (onProgress && totalFetched > 0) {
                    onProgress((attempts / maxAttempts) * 90, totalFetched);
                }

                try {
                    const url = this.config.buildFeedUrl({
                        results: chunkSize,
                        start: totalFetched > 0 ? allData[allData.length - 1].entry_id : null
                    });

                    console.log(`📡 Fetching chunk ${attempts} (${totalFetched} records so far)...`);
                    
                    const response = await axios.get(url, {
                        timeout: this.config.SETTINGS.TIMEOUT
                    });

                    if (response.data && response.data.feeds) {
                        const chunk = response.data.feeds;
                        
                        if (chunk.length === 0) {
                            hasMoreData = false;
                            break;
                        }

                        // Process and validate chunk
                        const processedChunk = chunk.map(feed => {
                            const validation = this.config.validateFeed(feed);
                            return {
                                ...feed,
                                validation: validation.valid ? 'valid' : 'issues',
                                issues: validation.issues,
                                // Add processed field names
                                humidity: parseFloat(feed.field1) || null,
                                temperature: parseFloat(feed.field2) || null,
                                pm25: parseFloat(feed.field3) || null,
                                pm10: parseFloat(feed.field4) || null
                            };
                        });

                        allData = allData.concat(processedChunk);
                        totalFetched = allData.length;

                        console.log(`✅ Chunk ${attempts}: ${chunk.length} records (Total: ${totalFetched})`);

                        // Stop if we got fewer records than requested
                        if (chunk.length < chunkSize) {
                            hasMoreData = false;
                        }

                        // Memory management for very large datasets
                        if (totalFetched > 100000) {
                            console.log('⚠️  Large dataset detected, stopping at 100k records');
                            hasMoreData = false;
                        }

                    } else {
                        console.warn(`⚠️  Empty response on attempt ${attempts}`);
                        hasMoreData = false;
                    }

                } catch (chunkError) {
                    console.error(`❌ Error fetching chunk ${attempts}:`, chunkError.message);
                    
                    // Try a few more times before giving up
                    if (attempts < 3) {
                        console.log(`🔄 Retrying chunk ${attempts + 1}...`);
                        await this.delay(this.config.SETTINGS.RETRY_DELAY);
                        continue;
                    } else {
                        hasMoreData = false;
                    }
                }
            }

            // Final progress update
            if (onProgress) {
                onProgress(95, totalFetched);
            }

            console.log(`🎉 Data fetch complete: ${totalFetched} total records`);

            // Prepare result
            const result = {
                success: true,
                data: {
                    data: allData,
                    total_records: totalFetched,
                    chunks_loaded: attempts,
                    channel: {
                        id: this.config.CHANNEL.ID,
                        name: this.config.CHANNEL.NAME
                    }
                },
                timestamp: new Date().toISOString()
            };

            // Add comprehensive analysis if requested
            if (includeAnalysis && allData.length > 0) {
                console.log('📈 Generating comprehensive analysis...');
                result.data.analysis = this.generateComprehensiveAnalysis(allData);
                
                if (onProgress) {
                    onProgress(100, totalFetched);
                }
            }

            return result;

        } catch (error) {
            console.error('❌ Failed to fetch all ThingSpeak data:', error);
            return {
                success: false,
                error: error.message,
                data: {
                    data: [],
                    total_records: 0
                },
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Generate comprehensive data analysis
     */
    generateComprehensiveAnalysis(data) {
        if (!data || data.length === 0) return null;

        try {
            const analysis = {
                dataPoints: data.length,
                dateRange: {
                    start: data[data.length - 1]?.created_at,
                    end: data[0]?.created_at
                },
                completeness: {},
                statistics: {}
            };

            // Analyze each field
            Object.values(this.config.FIELDS).forEach(field => {
                const fieldName = field.name;
                const values = data.map(d => parseFloat(d[fieldName])).filter(v => !isNaN(v));
                
                if (values.length > 0) {
                    const sorted = values.sort((a, b) => a - b);
                    const sum = values.reduce((a, b) => a + b, 0);
                    const mean = sum / values.length;
                    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
                    
                    analysis.completeness[fieldName] = ((values.length / data.length) * 100).toFixed(1);
                    analysis.statistics[fieldName] = {
                        count: values.length,
                        min: sorted[0].toFixed(2),
                        max: sorted[sorted.length - 1].toFixed(2),
                        avg: mean.toFixed(2),
                        median: (sorted[Math.floor(sorted.length / 2)]).toFixed(2),
                        stdDev: Math.sqrt(variance).toFixed(2)
                    };

                    // Add convenience aliases
                    analysis[fieldName] = analysis.statistics[fieldName];
                }
            });

            return analysis;

        } catch (error) {
            console.error('Error generating analysis:', error);
            return null;
=======
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
>>>>>>> c0f1212 (works-on-reload)
        }
    }
<<<<<<< HEAD

    /**
     * Get latest feed data
     */
    async getLatestFeed() {
        try {
            const url = `${this.config.API.CHANNEL_URL}/${this.config.CHANNEL.ID}/feeds/last.json?api_key=${this.config.API.READ_KEY}`;
            
            const response = await axios.get(url, {
                timeout: this.config.SETTINGS.TIMEOUT
            });

            if (response.data) {
                const feed = response.data;
                const processed = {
                    ...feed,
                    humidity: parseFloat(feed.field1) || null,
                    temperature: parseFloat(feed.field2) || null,
                    pm25: parseFloat(feed.field3) || null,
                    pm10: parseFloat(feed.field4) || null,
                    validation: this.config.validateFeed(feed)
                };

                return {
                    success: true,
                    data: processed,
                    timestamp: new Date().toISOString()
                };
            }

            throw new Error('No data received');

        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }    /**
     * Get channel data with configurable options
     */
    async getChannelData(options = {}) {
        try {
            const {
                results = 100,
                days = null,
                start = null,
                end = null
            } = options;

            const url = this.config.buildFeedUrl({
                results,
                days,
                start,
                end
            });
            
            const response = await axios.get(url, {
                timeout: this.config.SETTINGS.TIMEOUT
            });

            if (response.data && response.data.feeds) {
                const feeds = response.data.feeds.map(feed => ({
                    ...feed,
                    humidity: parseFloat(feed.field1) || null,
                    temperature: parseFloat(feed.field2) || null,
                    pm25: parseFloat(feed.field3) || null,
                    pm10: parseFloat(feed.field4) || null,
                    created_at: feed.created_at,
                    entry_id: parseInt(feed.entry_id) || null
                }));

                return {
                    success: true,
                    data: feeds,
                    channel: response.data.channel || {},
                    count: feeds.length,
                    timestamp: new Date().toISOString()
                };
            }

            throw new Error('No feeds data received');

        } catch (error) {
            console.error('Error fetching channel data:', error.message);
            return {
                success: false,
                error: error.message,
                data: [],
                count: 0,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Utility method for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get configuration summary
     */
    getConfigSummary() {
        return this.config.getStatusSummary();
    }
=======
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
>>>>>>> c0f1212 (works-on-reload)
}

// Create and export an instance
const thingSpeakServiceInstance = new ThingSpeakService();
module.exports = thingSpeakServiceInstance;
