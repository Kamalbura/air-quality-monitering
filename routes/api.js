/**
 * API Routes for Air Quality Monitoring System
 */
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const thingspeakService = require('../services/thingspeak-service');
const localDataService = require('../services/local-data-service');
const visualizationHelper = require('../helpers/visualization-helper');
const jsVisualizationHelper = require('../helpers/js-visualization-helper');
const diagnosticHelper = require('../helpers/diagnostic-helper');
const dataValidator = require('../helpers/data-validator');
const NodeCache = require('node-cache');

// Set up cache with 10 minute TTL
const apiCache = new NodeCache({ stdTTL: 600 });

/**
 * Get the latest data point
 */
router.get('/data/latest', async (req, res) => {
    try {
        // Check cache first
        const cacheKey = 'data_latest';
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Try to get data from ThingSpeak first
        let data;
        try {
            data = await thingspeakService.getLatestData();
        } catch (thingspeakError) {
            // If ThingSpeak fails, try local data
            data = await localDataService.getLatestData();
        }
        
        // Cache the result
        apiCache.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('Error fetching latest data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get recent data points
 */
router.get('/data/recent', async (req, res) => {
    try {
        // Parse query parameters
        const days = parseInt(req.query.days) || 1;
        const limit = parseInt(req.query.limit) || 100;
        
        // Check cache first
        const cacheKey = `data_recent_${days}_${limit}`;
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Try to get data from ThingSpeak first
        let data;
        try {
            data = await thingspeakService.getRecentData(days, limit);
        } catch (thingspeakError) {
            // If ThingSpeak fails, try local data
            data = await localDataService.getRecentData(days, limit);
        }
        
        // Cache the result
        apiCache.set(cacheKey, data);
        res.json(data);
    } catch (error) {
        console.error('Error fetching recent data:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get statistics for data within a time range
 */
router.get('/data/stats', async (req, res) => {
    try {
        // Parse query parameters
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const extended = req.query.extended === 'true';
        
        // Check cache first
        const cacheKey = `data_stats_${startDate || 'all'}_${endDate || 'latest'}_${extended}`;
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Get data from appropriate source
        let data;
        try {
            data = await thingspeakService.getData(startDate, endDate);
        } catch (thingspeakError) {
            console.log('ThingSpeak request failed, using local data:', thingspeakError.message);
            data = await localDataService.getData(startDate, endDate);
        }
        
        // Calculate statistics using the new JS analysis helper
        const analysisHelper = require('../helpers/analysis-helper');
        const stats = analysisHelper.calculateStatistics(data, { extended });
        
        // Add validation information
        if (extended) {
            stats.validation = dataValidator.validateData(data);
        }
        
        // Cache the result
        apiCache.set(cacheKey, stats);
        res.json(stats);
    } catch (error) {
        console.error('Error calculating statistics:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get time series visualization - uses JS visualization by default
 */
router.get('/visualization/time_series', async (req, res) => {
    try {
        // Parse query parameters
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const forcePython = req.query.forcePython === 'true';
        const useJs = req.query.useJs === 'true' || !global.pythonAvailable;
        
        // Check cache first with visualization engine type included in key
        const cacheKey = `viz_time_series_${startDate || 'all'}_${endDate || 'latest'}_${useJs ? 'js' : 'py'}`;
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Get data from appropriate source
        let data;
        try {
            data = await thingspeakService.getData(startDate, endDate);
        } catch (thingspeakError) {
            console.log('ThingSpeak request failed, using local data:', thingspeakError.message);
            data = await localDataService.getData(startDate, endDate);
        }
        
        // Generate visualization - use JS by default or fallback if Python is not available
        let vizResult;
        if (useJs || (!forcePython && !global.pythonAvailable)) {
            vizResult = await jsVisualizationHelper.createTimeSeriesVisualization(data, { startDate, endDate });
        } else {
            vizResult = await visualizationHelper.createTimeSeriesVisualization(data, { startDate, endDate });
        }
        
        // Cache the result
        apiCache.set(cacheKey, vizResult);
        res.json(vizResult);
    } catch (error) {
        console.error('Error generating time series visualization:', error);
        res.status(500).json({ 
            error: error.message,
            imagePath: '/images/error.png',
            description: `Failed to generate time series visualization: ${error.message}`
        });
    }
});

/**
 * Get daily pattern visualization
 */
router.get('/visualization/daily_pattern', async (req, res) => {
    try {
        // Parse query parameters
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const useJs = req.query.useJs === 'true' || !global.pythonAvailable;
        
        // Check cache first
        const cacheKey = `viz_daily_pattern_${startDate || 'all'}_${endDate || 'latest'}_${useJs ? 'js' : 'py'}`;
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Get data from appropriate source
        let data;
        try {
            data = await thingspeakService.getData(startDate, endDate);
        } catch (thingspeakError) {
            console.log('ThingSpeak request failed, using local data:', thingspeakError.message);
            data = await localDataService.getData(startDate, endDate);
        }
        
        // Generate visualization
        let vizResult;
        if (useJs || !global.pythonAvailable) {
            vizResult = await jsVisualizationHelper.createDailyPatternVisualization(data, { startDate, endDate });
        } else {
            vizResult = await visualizationHelper.createDailyPatternVisualization(data, { startDate, endDate });
        }
        
        // Cache the result
        apiCache.set(cacheKey, vizResult);
        res.json(vizResult);
    } catch (error) {
        console.error('Error generating daily pattern visualization:', error);
        res.status(500).json({ 
            error: error.message,
            imagePath: '/images/error.png',
            description: `Failed to generate daily pattern visualization: ${error.message}`
        });
    }
});

/**
 * Get PM2.5 trend visualization
 */
router.get('/visualization/pm25_trend', async (req, res) => {
    try {
        // Parse query parameters
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const useJs = req.query.useJs === 'true' || !global.pythonAvailable;
        
        // Check cache first
        const cacheKey = `viz_pm25_trend_${startDate || 'all'}_${endDate || 'latest'}_${useJs ? 'js' : 'py'}`;
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Get data from appropriate source
        let data;
        try {
            data = await thingspeakService.getData(startDate, endDate);
        } catch (thingspeakError) {
            console.log('ThingSpeak request failed, using local data:', thingspeakError.message);
            data = await localDataService.getData(startDate, endDate);
        }
        
        // Generate visualization
        let vizResult;
        if (useJs || !global.pythonAvailable) {
            vizResult = await jsVisualizationHelper.createPM25TrendVisualization(data, { startDate, endDate });
        } else {
            vizResult = await visualizationHelper.createPM25TrendVisualization(data, { startDate, endDate });
        }
        
        // Cache the result
        apiCache.set(cacheKey, vizResult);
        res.json(vizResult);
    } catch (error) {
        console.error('Error generating PM2.5 trend visualization:', error);
        res.status(500).json({ 
            error: error.message,
            imagePath: '/images/error.png',
            description: `Failed to generate PM2.5 trend visualization: ${error.message}`
        });
    }
});

/**
 * Get correlation visualization
 */
router.get('/visualization/correlation', async (req, res) => {
    try {
        // Parse query parameters
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const useJs = req.query.useJs === 'true' || !global.pythonAvailable;
        
        // Check cache first
        const cacheKey = `viz_correlation_${startDate || 'all'}_${endDate || 'latest'}_${useJs ? 'js' : 'py'}`;
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Get data from appropriate source
        let data;
        try {
            data = await thingspeakService.getData(startDate, endDate);
        } catch (thingspeakError) {
            console.log('ThingSpeak request failed, using local data:', thingspeakError.message);
            data = await localDataService.getData(startDate, endDate);
        }
        
        // Generate visualization
        let vizResult;
        if (useJs || !global.pythonAvailable) {
            vizResult = await jsVisualizationHelper.createCorrelationVisualization(data, { startDate, endDate });
        } else {
            vizResult = await visualizationHelper.createCorrelationVisualization(data, { startDate, endDate });
        }
        
        // Cache the result
        apiCache.set(cacheKey, vizResult);
        res.json(vizResult);
    } catch (error) {
        console.error('Error generating correlation visualization:', error);
        res.status(500).json({ 
            error: error.message,
            imagePath: '/images/error.png',
            description: `Failed to generate correlation visualization: ${error.message}`
        });
    }
});

/**
 * Get ThingSpeak channel status
 */
router.get('/channel/status', async (req, res) => {
    try {
        // Check cache first
        const cacheKey = 'channel_status';
        const cachedData = apiCache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Get channel info
        const channelInfo = await thingspeakService.getChannelInfo();
        
        // Calculate data age
        let dataAge = null;
        if (channelInfo.last_entry_id && channelInfo.updated_at) {
            const lastUpdate = new Date(channelInfo.updated_at);
            const now = new Date();
            dataAge = Math.floor((now - lastUpdate) / (1000 * 60)); // Age in minutes
        }
        
        // Format response
        const status = {
            channelId: process.env.THINGSPEAK_CHANNEL_ID,
            active: channelInfo.active || false,
            lastEntryId: channelInfo.last_entry_id,
            lastEntryDate: channelInfo.updated_at,
            entryCount: channelInfo.last_entry_id,
            dataAge: dataAge,
            fields: {
                humidity: !!channelInfo.field1,
                temperature: !!channelInfo.field2,
                pm25: !!channelInfo.field3,
                pm10: !!channelInfo.field4
            }
        };
        
        // Cache the result
        apiCache.set(cacheKey, status);
        res.json(status);
    } catch (error) {
        console.error('Error fetching channel status:', error);
        
        // Try to provide some information even if ThingSpeak is down
        try {
            const latestData = await localDataService.getLatestData();
            
            res.json({
                channelId: process.env.THINGSPEAK_CHANNEL_ID,
                active: false,
                error: error.message,
                lastEntryDate: latestData ? latestData.created_at : null,
                note: 'Using locally cached data, ThingSpeak connection failed'
            });
        } catch (localError) {
            res.status(500).json({ 
                error: error.message,
                active: false
            });
        }
    }
});

/**
 * Get visualization engine status
 */
router.get('/visualization/status', (req, res) => {
    // Get visualization engine status
    const pythonAvailable = !!global.pythonAvailable;
    const jsEngineAvailable = !!jsVisualizationHelper;
    
    let engineDetails = 'JavaScript Only';
    if (pythonAvailable) {
        engineDetails = 'Python Available (preferred)';
    }
    
    res.json({
        pythonAvailable,
        jsEngineAvailable,
        engineDetails,
        currentEngine: pythonAvailable ? 'python' : 'javascript'
    });
});

/**
 * Get system diagnostics
 */
router.get('/diagnostics', async (req, res) => {
    try {
        const diagResults = await diagnosticHelper.runDiagnostics();
        res.json(diagResults);
    } catch (error) {
        console.error('Error running diagnostics:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Clear API cache (admin endpoint)
 */
router.post('/admin/clear-cache', (req, res) => {
    const keysCount = apiCache.keys().length;
    apiCache.flushAll();
    
    console.log(`Cache cleared: ${keysCount} keys removed`);
    res.json({
        success: true,
        message: `Cache cleared successfully. ${keysCount} entries removed.`
    });
});

module.exports = router;
