/**
 * ThingSpeak Service
 * Handles server-side communication with ThingSpeak API
 */
const axios = require('axios');
const THINGSPEAK_CONFIG = require('../config/thingspeak-consolidated');

class ThingSpeakService {
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
        }
    }

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
}

// Create and export an instance
const thingSpeakServiceInstance = new ThingSpeakService();
module.exports = thingSpeakServiceInstance;
