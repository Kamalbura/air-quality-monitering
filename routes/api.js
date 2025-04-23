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

// API metrics
router.get('/metrics', (req, res) => {
  const { apiMonitor } = require('../middleware/api-monitor');
  const metrics = apiMonitor.getApiMetrics();
  res.json({ success: true, data: metrics });
});

// New ThingSpeak Info Endpoints
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
    res.json(latestData);
  } catch (error) {
    debugHelper.log(`API Error /thingspeak/latest-feed: ${error.message}`, 'api');
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

module.exports = router;
