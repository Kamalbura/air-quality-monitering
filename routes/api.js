const express = require('express');
const router = express.Router();
const thingspeakService = require('../services/thingspeak-service');
const csvDataService = require('../services/csv-data-service');
const debugHelper = require('../helpers/debug-helper');
const analysisHelper = require('../helpers/analysis-helper');
const ErrorHandler = require('../error-handler');
const errorHandler = new ErrorHandler();

// Cache control middleware
const cacheControl = (req, res, next) => {
  // Set cache control headers
  res.setHeader('Cache-Control', 'private, max-age=300');
  next();
};

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

/**
 * @route GET /api/thingspeak/data
 * @desc Get data from ThingSpeak channel
 * @access Public
 */
router.get('/thingspeak/data', cacheControl, async (req, res) => {
  try {
    const { results = 100, offset = 0 } = req.query;
    const data = await thingspeakService.getChannelData({
      results: parseInt(results),
      offset: parseInt(offset)
    });
    res.json(data);
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'ThingSpeak API', req);
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/thingspeak/status
 * @desc Get ThingSpeak service status
 * @access Public
 */
router.get('/thingspeak/status', async (req, res) => {
  try {
    const status = await thingspeakService.getServiceStatus();
    res.json(status);
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'ThingSpeak Status', req);
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/csv/data
 * @desc Get data from local CSV file
 * @access Public
 */
router.get('/csv/data', cacheControl, async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const data = await csvDataService.getDefaultCsvData({
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    res.json(data);
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'CSV Data API', req);
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/csv/info
 * @desc Get information about the CSV file
 * @access Public
 */
router.get('/csv/info', async (req, res) => {
  try {
    const info = csvDataService.getCsvFileInfo();
    res.json(info);
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'CSV Info API', req);
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/data/stats
 * @desc Get statistical analysis of data
 * @access Public
 */
router.get('/data/stats', async (req, res) => {
  try {
    const { source = 'thingspeak', extended = false } = req.query;
    let data = [];
    
    if (source === 'csv') {
      const csvData = await csvDataService.getDefaultCsvData({ limit: 500 });
      data = csvData.success ? csvData.data : [];
    } else {
      const thingspeakData = await thingspeakService.getChannelData({ results: 500 });
      data = thingspeakData.feeds || [];
    }
    
    const stats = analysisHelper.calculateStatistics(data, { 
      extended: extended === 'true' 
    });
    
    res.json(stats);
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'Data Stats API', req);
    res.status(500).json(errorResponse);
  }
});

/**
 * @route GET /api/data/source-info
 * @desc Get information about available data sources
 * @access Public
 */
router.get('/data/source-info', async (req, res) => {
  try {
    // Check CSV file availability
    const csvInfo = csvDataService.getCsvFileInfo();
    
    // Check ThingSpeak availability
    const thingspeakStatus = await thingspeakService.getServiceStatus();
    
    res.json({
      sources: [
        {
          id: 'csv',
          name: 'Local CSV File',
          path: 'C:\\Users\\burak\\Desktop\\projects\\theme-based\\air-quality-monitering\\data\\feeds.csv',
          available: csvInfo.exists,
          info: csvInfo
        },
        {
          id: 'thingspeak',
          name: 'ThingSpeak IoT Platform',
          available: thingspeakStatus.available,
          info: thingspeakStatus
        }
      ],
      recommendedSource: csvInfo.exists ? 'csv' : 'thingspeak'
    });
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'Data Source Info API', req);
    res.status(500).json(errorResponse);
  }
});

module.exports = router;
