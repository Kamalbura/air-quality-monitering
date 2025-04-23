const express = require('express');
const router = express.Router();
const thingspeakService = require('../services/thingspeak-service');
const debugHelper = require('../helpers/debug-helper');
const analysisHelper = require('../helpers/analysis-helper');

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

// New ThingSpeak Info Endpoints/ Remove sensitive info like API keys for client-side
router.get('/thingspeak/channel-details', async (req, res) => {
  try {
    const details = await thingspeakService.getDataSourceInfo();
    res.json({ success: true, data: details });
  } catch (error) {
    debugHelper.log(`API Error /thingspeak/channel-details: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/thingspeak/latest-feed', async (req, res) => {
  try {
    const latestData = await thingspeakService.getChannelData({ results: 1 });
    if (latestData.feeds && latestData.feeds.length > 0) {
      const feed = latestData.feeds[0];
      res.json({
        success: true,
        data: {
          pm25: feed.field3 || 'N/A',
          pm10: feed.field4 || 'N/A',
          temperature: feed.field2 || 'N/A',
          humidity: feed.field1 || 'N/A',
        },
      });
    } else {
      res.json({ success: false, error: 'No data available' });
    }
  } catch (error) {
    console.error('Error fetching latest feed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/thingspeak/status', async (req, res) => {
  try {
    const status = await thingspeakService.getChannelStatus();
    res.json(status);
  } catch (error) {
    debugHelper.log(`API Error /thingspeak/status: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Simple ping endpoint for connection checking
router.get('/ping', (req, res) => {
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Direct ThingSpeak data loading
router.get('/thingspeak/direct', async (req, res) => {
  try {
    const options = {
      days: parseInt(req.query.days) || 7,
      results: parseInt(req.query.results) || 500,
      includeAnalysis: req.query.analysis === 'true'
    };
    
    const data = await thingspeakService.getDirectThingspeakData(options);
    
    if (options.includeAnalysis) {
      const analysis = analysisHelper.calculateStatistics(data.data || []);
      data.analysis = analysis;
    }
    
    res.json({ success: true, data });
  } catch (error) {
    debugHelper.log(`API Error /thingspeak/direct: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Seasonal comparison endpoint (for new visualization)
router.get('/analysis/seasonal', async (req, res) => {
  try {
    const options = {
      results: parseInt(req.query.results) || 5000, // Need more data for seasonal analysis
      start: req.query.start,
      end: req.query.end
    };
    
    const dataResponse = await thingspeakService.getChannelData(options);
    
    if (!dataResponse.success || !dataResponse.data) {
      return res.status(500).json({ success: false, error: 'Failed to fetch data for seasonal analysis' });
    }
    
    const seasonalData = analysisHelper.performSeasonalAnalysis(dataResponse.data.data || []);
    res.json({ success: true, data: seasonalData });
  } catch (error) {
    debugHelper.log(`API Error /analysis/seasonal: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Weekly comparison endpoint (for new visualization)
router.get('/analysis/weekly', async (req, res) => {
  try {
    const options = {
      results: parseInt(req.query.results) || 2000,
      start: req.query.start,
      end: req.query.end
    };
    
    const dataResponse = await thingspeakService.getChannelData(options);
    
    if (!dataResponse.success || !dataResponse.data) {
      return res.status(500).json({ success: false, error: 'Failed to fetch data for weekly analysis' });
    }
    
    const weeklyData = analysisHelper.performWeeklyComparison(dataResponse.data.data || []);
    res.json({ success: true, data: weeklyData });
  } catch (error) {
    debugHelper.log(`API Error /analysis/weekly: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

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

module.exports = router;
