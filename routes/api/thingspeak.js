/**
 * ThingSpeak API Routes
 * Dedicated endpoints for ThingSpeak integration
 */
const express = require('express');
const router = express.Router();
const thingspeakService = require('../../services/thingspeak-service');
const THINGSPEAK_CONFIG = require('../../config/thingspeak-consolidated');

/**
 * GET /api/thingspeak/config
 * Get ThingSpeak configuration and channel info
 */
router.get('/config', (req, res) => {
    try {
        const config = thingspeakService.getConfigSummary();
        
        res.json({
            success: true,
            config: config,
            fields: THINGSPEAK_CONFIG.FIELDS,
            settings: {
                updateInterval: THINGSPEAK_CONFIG.SETTINGS.UPDATE_INTERVAL,
                maxResults: THINGSPEAK_CONFIG.SETTINGS.MAX_RESULTS,
                timeout: THINGSPEAK_CONFIG.SETTINGS.TIMEOUT
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/thingspeak/test-connection
 * Test ThingSpeak connectivity and verify channel access
 */
router.get('/test-connection', async (req, res) => {
    try {
        const result = await thingspeakService.testConnection();
        
        const statusCode = result.success ? 200 : 503;
        res.status(statusCode).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * POST /api/thingspeak/fetch-all
 * Fetch all available data from ThingSpeak with analysis
 */
router.post('/fetch-all', async (req, res) => {
    try {
        const { includeAnalysis = true, chunkSize = 8000 } = req.body;
        
        console.log('📡 Starting comprehensive ThingSpeak data fetch...');
        console.log(`Include Analysis: ${includeAnalysis}`);
        console.log(`Chunk Size: ${chunkSize}`);
        
        const result = await thingspeakService.fetchAllChannelData({
            includeAnalysis,
            chunkSize
        });
        
        if (result.success) {
            console.log(`✅ Successfully fetched ${result.data.total_records} records`);
        } else {
            console.error(`❌ Fetch failed: ${result.error}`);
        }
        
        const statusCode = result.success ? 200 : 500;
        res.status(statusCode).json(result);
        
    } catch (error) {
        console.error('❌ Error in fetch-all endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/thingspeak/latest-feed
 * Get the most recent data point
 */
router.get('/latest-feed', async (req, res) => {
    try {
        const result = await thingspeakService.getLatestFeed();
        
        const statusCode = result.success ? 200 : 500;
        res.status(statusCode).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/thingspeak/channel-details
 * Get detailed channel information
 */
router.get('/channel-details', async (req, res) => {
    try {
        const connectionTest = await thingspeakService.testConnection();
        
        if (connectionTest.success) {
            const channelData = connectionTest.channel;
            
            res.json({
                success: true,
                data: {
                    ...channelData,
                    configuration: THINGSPEAK_CONFIG.CHANNEL,
                    fields: THINGSPEAK_CONFIG.FIELDS,
                    api_endpoints: {
                        channel_url: THINGSPEAK_CONFIG.buildChannelUrl(),
                        feed_url: THINGSPEAK_CONFIG.buildFeedUrl(),
                        latest_url: `${THINGSPEAK_CONFIG.API.CHANNEL_URL}/${THINGSPEAK_CONFIG.CHANNEL.ID}/feeds/last.json`
                    }
                },
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json(connectionTest);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/thingspeak/data
 * Fetch ThingSpeak data with flexible parameters
 */
router.get('/data', async (req, res) => {
    try {
        const {
            results = 100,
            days = null,
            start = null,
            end = null
        } = req.query;

        const url = THINGSPEAK_CONFIG.buildFeedUrl({
            results: results === 'unlimited' ? null : parseInt(results),
            days: days ? parseInt(days) : null,
            start,
            end
        });

        console.log(`📡 Fetching ThingSpeak data: ${url}`);

        const axios = require('axios');
        const response = await axios.get(url, {
            timeout: THINGSPEAK_CONFIG.SETTINGS.TIMEOUT
        });

        if (response.data && response.data.feeds) {
            // Process the feeds
            const processedFeeds = response.data.feeds.map(feed => ({
                ...feed,
                humidity: parseFloat(feed.field1) || null,
                temperature: parseFloat(feed.field2) || null,
                pm25: parseFloat(feed.field3) || null,
                pm10: parseFloat(feed.field4) || null,
                validation: THINGSPEAK_CONFIG.validateFeed(feed)
            }));

            res.json({
                success: true,
                data: {
                    ...response.data,
                    feeds: processedFeeds,
                    processed_count: processedFeeds.length
                },
                timestamp: new Date().toISOString()
            });
        } else {
            throw new Error('Invalid response from ThingSpeak API');
        }

    } catch (error) {
        console.error('❌ Error fetching ThingSpeak data:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/thingspeak/health
 * Health check endpoint for ThingSpeak service
 */
router.get('/health', async (req, res) => {
    try {
        const connectionTest = await thingspeakService.testConnection();
        const latestFeed = await thingspeakService.getLatestFeed();
        
        const health = {
            service: 'ThingSpeak Integration',
            status: connectionTest.success && latestFeed.success ? 'healthy' : 'degraded',
            channel: {
                id: THINGSPEAK_CONFIG.CHANNEL.ID,
                accessible: connectionTest.success,
                latest_data: latestFeed.success
            },
            configuration: THINGSPEAK_CONFIG.getStatusSummary(),
            last_check: new Date().toISOString()
        };

        const statusCode = health.status === 'healthy' ? 200 : 503;
        res.status(statusCode).json(health);

    } catch (error) {
        res.status(500).json({
            service: 'ThingSpeak Integration',
            status: 'error',
            error: error.message,
            last_check: new Date().toISOString()
        });
    }
});

module.exports = router;
