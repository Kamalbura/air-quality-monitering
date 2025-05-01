const express = require('express');
const router = express.Router();
const thingspeakService = require('../services/thingspeak-service');
const debugHelper = require('../helpers/debug-helper');
const analysisHelper = require('../helpers/analysis-helper');

/**
 * ThingSpeak API routes
 */

// Update this route to provide ThingSpeak config
router.get('/config', (req, res) => {
  try {
    const configService = require('../services/config-service');
    const fullConfig = configService.getConfig();
    const thingspeakConfig = fullConfig.thingspeak || {
      channelId: process.env.THINGSPEAK_CHANNEL_ID || '2863798',
      readApiKey: process.env.THINGSPEAK_READ_API_KEY || '',
      updateInterval: 30000
    };
    res.json({
      success: true,
      data: {
        thingspeak: {
          channelId: thingspeakConfig.channelId,
          readApiKey: thingspeakConfig.readApiKey,
          updateInterval: thingspeakConfig.updateInterval || 30000,
          fields: thingspeakConfig.fields || {
            humidity: 'field1',
            temperature: 'field2',
            pm25: 'field3',
            pm10: 'field4'
          }
        }
      }
    });
  } catch (error) {
    console.error('Error fetching ThingSpeak config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Could not retrieve ThingSpeak configuration'
    });
  }
});

// Improved ThingSpeak latest feed endpoint
router.get('/thingspeak/latest-feed', async (req, res) => {
  try {
    console.log('Fetching latest ThingSpeak feed data');
    const results = parseInt(req.query.results) || 1;
    
    const latestData = await thingspeakService.getChannelData({ results });
    
    if (latestData && latestData.data && latestData.data.length > 0) {
      const feed = latestData.data[0];
      
      // Create standardized response format
      const responseData = {
        success: true,
        data: {
          pm25: feed.field3 || feed.pm25 || 'N/A',
          pm10: feed.field4 || feed.pm10 || 'N/A',
          temperature: feed.field2 || feed.temperature || 'N/A',
          humidity: feed.field1 || feed.humidity || 'N/A',
          timestamp: feed.created_at || new Date().toISOString(),
          entry_id: feed.entry_id || '0'
        },
        timestamp: new Date().toISOString()
      };
      
      res.json(responseData);
    } else {
      // Provide fallback data if no data is available
      console.log('No ThingSpeak data returned, sending fallback data');
      res.json({ 
        success: false, 
        error: 'No data available',
        data: {
          pm25: 'N/A',
          pm10: 'N/A',
          temperature: 'N/A',
          humidity: 'N/A',
          timestamp: new Date().toISOString(),
          entry_id: '0'
        },
        timestamp: new Date().toISOString(),
        fallback: true
      });
    }
  } catch (error) {
    console.error('Error fetching latest feed:', error);
    // Still provide some data structure even in case of error
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch latest feed data',
      data: {
        pm25: 'N/A',
        pm10: 'N/A',
        temperature: 'N/A',
        humidity: 'N/A',
        timestamp: new Date().toISOString(),
        entry_id: '0'
      },
      timestamp: new Date().toISOString(),
      fallback: true
    });
  }
});

// Direct ThingSpeak data endpoint with better error handling
router.get('/thingspeak/direct', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const results = parseInt(req.query.results) || 500;
    const includeAnalysis = req.query.analysis === 'true';
    
    console.log(`Loading direct ThingSpeak data: ${days} days, ${results} results, analysis: ${includeAnalysis}`);
    
    const data = await thingspeakService.getDirectThingspeakData({
      days,
      results,
      includeAnalysis
    });
    
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error loading direct ThingSpeak data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : 'No response details available'
    });
  }
});

// Simple ping endpoint for connection checking
router.get('/ping', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    server_time: new Date().toLocaleString(),
    api_version: '1.0'
  });
});

// Data endpoints
router.get('/data', async (req, res) => {
  try {
    const options = {
      results: parseInt(req.query.results) || 100,
      start: req.query.start,
      end: req.query.end,
      page: parseInt(req.query.page) || 1
    };
    
    const response = await thingspeakService.getChannelData(options);
    res.json(response);
  } catch (error) {
    debugHelper.log(`API Error /data: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/latest-data', async (req, res) => {
  try {
    const lastEntryId = req.query.last_entry_id || 0;
    const response = await thingspeakService.getRealtimeUpdates(lastEntryId);
    res.json(response);
  } catch (error) {
    debugHelper.log(`API Error /latest-data: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Analyze data
router.get('/analyze', async (req, res) => {
  try {
    const options = {
      results: parseInt(req.query.results) || 100,
      start: req.query.start,
      end: req.query.end
    };
    
    const dataResponse = await thingspeakService.getChannelData(options);
    
    if (!dataResponse.success || !dataResponse.data) {
      return res.status(500).json({ success: false, error: 'Failed to fetch data for analysis' });
    }
    
    const stats = analysisHelper.calculateStatistics(dataResponse.data.data || []);
    res.json({ success: true, data: stats });
  } catch (error) {
    debugHelper.log(`API Error /analyze: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// System status endpoints
router.get('/system-status', async (req, res) => {
  try {
    const connectionStatus = await thingspeakService.checkConnection();
    res.json({ success: true, data: connectionStatus });
  } catch (error) {
    debugHelper.log(`API Error /system-status: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cache management
router.post('/clear-cache', (req, res) => {
  try {
    const clearedCount = thingspeakService.clearCache();
    res.json({ success: true, clearedCount });
  } catch (error) {
    debugHelper.log(`API Error /clear-cache: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear all data endpoint
router.post('/clear-data', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const nodeCache = require('node-cache');
    
    // Create a new cache instance to clear the current one
    global.apiCache = new nodeCache({ stdTTL: 600 });
    
    // Clear temporary files
    const tmpDir = path.join(__dirname, '..', 'public', 'images', 'tmp');
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      let count = 0;
      
      for (const file of files) {
        if (file !== '.gitkeep') {
          fs.unlinkSync(path.join(tmpDir, file));
          count++;
        }
      }
      
      res.json({ 
        success: true, 
        message: `Cleared ${count} temporary files and reset cache.`
      });
    } else {
      res.json({ success: true, message: 'Cache cleared successfully.' });
    }
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// API metrics
router.get('/metrics', (req, res) => {
  const { apiMonitor } = require('../middleware/api-monitor');
  const metrics = apiMonitor.getApiMetrics();
  res.json({ success: true, data: metrics });
});

// ThingSpeak channel details endpoint
router.get('/thingspeak/channel-details', async (req, res) => {
  try {
    const channelFields = await thingspeakService.getChannelFields();
    
    if (channelFields.success) {
      res.json({
        success: true,
        data: channelFields.fields
      });
    } else {
      res.json({
        success: false,
        error: channelFields.error || 'Failed to get channel details',
        data: null
      });
    }
  } catch (error) {
    console.error('Error fetching channel details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ThingSpeak status check endpoint
router.get('/thingspeak/status', async (req, res) => {
  try {
    const status = await thingspeakService.checkConnection();
    res.json(status);
  } catch (error) {
    console.error('Error checking ThingSpeak status:', error);
    res.status(500).json({
      success: false,
      online: false,
      error: error.message
    });
  }
});

// Enhanced ThingSpeak API endpoints for ThingSpeak info page
router.get('/thingspeak/test-connection', async (req, res) => {
  try {
    const channelId = req.query.channelId || process.env.THINGSPEAK_CHANNEL_ID;
    const readApiKey = req.query.readApiKey || process.env.THINGSPEAK_READ_API_KEY;

    // Perform comprehensive connection test
    const results = await thingspeakService.testConnection({
      channelId,
      readApiKey
    });

    // Add recommendations if applicable
    const recommendations = [];
    
    if (!results.success) {
      if (results.tests.some(t => t.name === 'Channel Validation' && !t.success)) {
        recommendations.push('Verify your ThingSpeak channel ID is correct.');
      }
      
      if (results.tests.some(t => t.message && t.message.includes('Invalid API key'))) {
        recommendations.push('Check that your ThingSpeak read API key is valid.');
      }
      
      if (results.tests.some(t => t.name === 'Data Retrieval' && !t.success && 
          results.tests.some(t => t.name === 'Channel Validation' && t.success))) {
        recommendations.push('Your channel exists but has no data. Make sure sensors are publishing data.');
      }
    }

    res.json({
      success: results.success,
      data: {
        tests: results.tests,
        recommendations
      }
    });
  } catch (error) {
    console.error('Error testing ThingSpeak connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Function to get integrated ThingSpeak data
router.get('/thingspeak/integrated-data', async (req, res) => {
  try {
    // Load ThingSpeak integration service dynamically
    const thingspeakIntegration = require('../services/thingspeak-integration');
    const days = parseInt(req.query.days) || 7;
    
    // Get data with proper error handling
    const latestData = await thingspeakIntegration.getLatestAirQuality();
    const timeSeriesData = await thingspeakIntegration.getTimeSeriesData({ days });
    const channelHealth = await thingspeakIntegration.getChannelHealth();
    
    // Format data for integrated dashboard view
    const result = {
      latest: latestData,
      timeSeries: timeSeriesData,
      health: channelHealth,
      metadata: {
        timestamp: new Date().toISOString(),
        requestedDays: days,
        source: 'thingspeak-integration'
      }
    };
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching integrated ThingSpeak data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      fallback: true
    });
  }
});

// Add endpoints for ThingSpeak info page
router.get('/thingspeak/metrics', async (req, res) => {
  try {
    const apiStats = thingspeakService.getStats();
    
    const metrics = {
      requestCount: apiStats.requestCount || 0,
      successRate: apiStats.successRate || 100,
      averageResponseTime: apiStats.averageResponseTime || 0,
      lastUpdated: apiStats.timestamp || new Date().toISOString(),
      errors: apiStats.errors || [],
      rateLimit: {
        remaining: apiStats.rateLimits?.requestsRemaining || null,
        limit: apiStats.rateLimits?.dailyLimit || 1000
      },
      usage: {
        daily: apiStats.thingspeakApiMetrics?.dailyRequests || 0,
        limit: apiStats.rateLimits?.dailyLimit || 1000,
        remaining: apiStats.rateLimits?.requestsRemaining || 0
      }
    };
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching ThingSpeak metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update configuration endpoint to handle ThingSpeak settings specially
router.post('/thingspeak/update-config', async (req, res) => {
  try {
    const { channelId, readApiKey, writeApiKey, updateInterval } = req.body;
    
    // Validate inputs
    if (!channelId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel ID is required' 
      });
    }
    
    // Update ThingSpeak configuration in the services
    thingspeakService.updateConfig({
      channelId,
      readApiKey,
      writeApiKey,
      updateInterval: parseInt(updateInterval) || 30000
    });
    
    // Also update in the global config service if available
    try {
      const configService = require('../services/config-service');
      configService.updateConfig('thingspeak', {
        channelId,
        readApiKey,
        writeApiKey,
        updateInterval: parseInt(updateInterval) || 30000
      });
    } catch (configError) {
      console.warn('Could not update config service:', configError.message);
    }
    
    // Test the connection with new config
    const testResult = await thingspeakService.testConnection({
      channelId,
      readApiKey
    });
    
    res.json({
      success: true,
      connectionTest: testResult,
      message: 'ThingSpeak configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating ThingSpeak configuration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate basic analysis from ThingSpeak data
 */
function generateAnalysis(feeds) {
  // Extract values
  const pm25Values = feeds.map(f => parseFloat(f.field3)).filter(v => !isNaN(v));
  const pm10Values = feeds.map(f => parseFloat(f.field4)).filter(v => !isNaN(v));
  const tempValues = feeds.map(f => parseFloat(f.field2)).filter(v => !isNaN(v));
  const humidValues = feeds.map(f => parseFloat(f.field1)).filter(v => !isNaN(v));
  
  // Calculate statistics
  const calcStats = (values) => {
    if (values.length === 0) return { avg: 'N/A', min: 'N/A', max: 'N/A', stdDev: 'N/A' };
    
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Standard deviation
    const squareDiffs = values.map(v => Math.pow(v - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    const stdDev = Math.sqrt(avgSquareDiff);
    
    return {
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      stdDev: stdDev.toFixed(2)
    };
  };
  
  const pm25Stats = calcStats(pm25Values);
  const pm10Stats = calcStats(pm10Values);
  const tempStats = calcStats(tempValues);
  const humidStats = calcStats(humidValues);
  
  return {
    average_pm25: pm25Stats.avg,
    average_pm10: pm10Stats.avg,
    min_pm25: pm25Stats.min,
    min_pm10: pm10Stats.min,
    max_pm25: pm25Stats.max,
    max_pm10: pm10Stats.max,
    stddev_pm25: pm25Stats.stdDev,
    stddev_pm10: pm10Stats.stdDev,
    averages: {
      pm25: pm25Stats.avg,
      pm10: pm10Stats.avg,
      temperature: tempStats.avg,
      humidity: humidStats.avg
    },
    dataPoints: {
      pm25: pm25Values.length,
      pm10: pm10Values.length,
      temperature: tempValues.length,
      humidity: humidValues.length
    }
  };
}

// Configuration API endpoints
router.get('/config', (req, res) => {
  try {
    const configService = require('../services/config-service');
    const config = configService.getConfig();
    
    // Remove sensitive info like API keys for client-side
    const safeConfig = JSON.parse(JSON.stringify(config)); // Deep clone
    if (safeConfig.thingspeak && safeConfig.thingspeak.writeApiKey) {
      safeConfig.thingspeak.writeApiKey = safeConfig.thingspeak.writeApiKey.replace(/./g, '*');
    }
    
    res.json({ success: true, data: safeConfig });
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/update', (req, res) => {
  try {
    const configService = require('../services/config-service');
    const { section, updates } = req.body;
    
    if (!section || !updates) {
      return res.status(400).json({ success: false, error: 'Missing section or updates' });
    }
    
    const result = configService.updateConfig(section, updates);
    res.json({ success: result });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/reset', (req, res) => {
  try {
    const configService = require('../services/config-service');
    const result = configService.resetConfig();
    res.json({ success: result });
  } catch (error) {
    console.error('Error resetting configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/config/export', (req, res) => {
  try {
    const configService = require('../services/config-service');
    const configStr = configService.exportConfig();
    if (!configStr) {
      return res.status(500).json({ success: false, error: 'Failed to export configuration' });
    }
    res.json({ success: true, data: configStr });
  } catch (error) {
    console.error('Error exporting configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/config/import', (req, res) => {
  try {
    const configService = require('../services/config-service');
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({ success: false, error: 'Missing configuration data' });
    }
    const result = configService.importConfig(config);
    res.json({ success: result });
  } catch (error) {
    console.error('Error importing configuration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add a new endpoint for monitoring ThingSpeak rate limits
router.get('/thingspeak/rate-limits', async (req, res) => {
  try {
    const rateLimit = thingspeakService.getStats().rateLimits;
    
    res.json({ 
      success: true, 
      data: rateLimit 
    });
  } catch (error) {
    console.error('Error fetching rate limit info:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
