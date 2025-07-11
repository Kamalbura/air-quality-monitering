/**
 * Consolidated API Routes
 * Central API endpoint management with no duplications
 */
const express = require('express');
const router = express.Router();

// Import services
const thingspeakService = require('../services/thingspeak-service');
const configService = require('../services/config-service');
const dataProcessing = require('../services/data-processing-service');
const pythonBackend = require('../services/python-backend-service');
const apiCache = require('../services/api-cache-service');
const debugHelper = require('../helpers/debug-helper');
const analysisHelper = require('../helpers/analysis-helper');

/**
 * CONFIGURATION ENDPOINTS
 */

// Get all configuration (sanitized for client)
router.get('/config', async (req, res) => {
  try {
    const cacheKey = 'api:config:full';
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const config = configService.getConfig();
    
    // Create sanitized config for client-side usage
    const safeConfig = JSON.parse(JSON.stringify(config));
    
    // Remove sensitive information
    if (safeConfig.thingspeak && safeConfig.thingspeak.writeApiKey) {
      safeConfig.thingspeak.writeApiKey = safeConfig.thingspeak.writeApiKey.replace(/./g, '*');
    }
    
    // Add metadata
    safeConfig._meta = {
      ...safeConfig._meta,
      retrievedAt: new Date().toISOString()
    };
    
    const response = {
      success: true,
      data: safeConfig,
      timestamp: new Date().toISOString()
    };
    
    // Cache for 5 minutes
    apiCache.set(cacheKey, response, 300);
    
    res.json(response);
  } catch (error) {
    debugHelper.error(`Failed to fetch configuration: ${error.message}`, 'api');
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Could not retrieve configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific config section
router.get('/config/:section', async (req, res) => {
  try {
    const section = req.params.section;
    const cacheKey = `api:config:section:${section}`;
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    const sectionData = configService.getConfigSection(section);
    
    if (!sectionData) {
      return res.status(404).json({
        success: false,
        error: `Configuration section '${section}' not found`,
        timestamp: new Date().toISOString()
      });
    }
    
    const response = {
      success: true,
      data: sectionData,
      section: section,
      timestamp: new Date().toISOString()
    };
    
    // Cache for 5 minutes
    apiCache.set(cacheKey, response, 300);
    
    res.json(response);
  } catch (error) {
    debugHelper.error(`Failed to fetch config section ${req.params.section}: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Update specific config section
router.post('/config/:section', async (req, res) => {
  try {
    const section = req.params.section;
    const updates = req.body;
    
    debugHelper.log(`Updating config section: ${section}`, 'api');
    
    const result = configService.updateConfig(section, updates);
    
    if (result) {
      // Invalidate cache
      apiCache.invalidateByTag('config');
      
      res.json({ 
        success: true,
        message: `Configuration section '${section}' updated successfully`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update configuration',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    debugHelper.error(`Failed to update config section ${req.params.section}: ${error.message}`, 'api');
    res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Reset config section to defaults
router.post('/config/:section/reset', async (req, res) => {
  try {
    const section = req.params.section;
    
    const result = configService.resetConfigSection(section);
    
    if (result) {
      // Invalidate cache
      apiCache.invalidateByTag('config');
      
      res.json({
        success: true,
        message: `Configuration section '${section}' reset to defaults`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to reset configuration section',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    debugHelper.error(`Failed to reset config section ${req.params.section}: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * HEALTH AND DIAGNOSTICS ENDPOINTS
 */

// Comprehensive health check
router.get('/health', async (req, res) => {
  try {
    const cacheKey = 'api:health';
    const cached = apiCache.get(cacheKey, 'quick');
    
    if (cached) {
      return res.json(cached);
    }
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {},
      version: require('../package.json').version
    };

    // Check ThingSpeak service
    try {
      const thingspeakTest = await thingspeakService.testConnection();
      health.services.thingspeak = thingspeakTest.success ? 'connected' : 'failed';
      if (!thingspeakTest.success) {
        health.services.thingspeakError = thingspeakTest.error;
      }
    } catch (error) {
      health.services.thingspeak = 'error';
      health.services.thingspeakError = error.message;
    }

    // Check Python backend
    const pythonStatus = pythonBackend.getStatus();
    health.services.pythonBackend = pythonStatus.running ? 'running' : 'stopped';
    health.services.pythonDetails = pythonStatus;

    // Check cache service
    health.services.cache = apiCache.getStats();

    // Determine overall status
    const criticalServices = ['thingspeak'];
    const hasFailures = criticalServices.some(service => 
      health.services[service] === 'failed' || health.services[service] === 'error'
    );
    
    if (hasFailures) {
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    // Cache for 30 seconds
    apiCache.set(cacheKey, health, 30, 'quick');
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API metrics
router.get('/metrics', (req, res) => {
  try {
    const { getApiMetrics } = require('../middleware/api-monitor');
    const metrics = getApiMetrics();
    
    res.json({
      success: true,
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    debugHelper.error(`Error getting API metrics: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * DATA ENDPOINTS
 */

// Get latest sensor data
router.get('/latest', async (req, res) => {
  try {
    const cacheKey = 'api:data:latest';
    const cached = apiCache.get(cacheKey, 'quick');
    
    if (cached) {
      return res.json(cached);
    }    // Get latest data from ThingSpeak
    const latestResponse = await thingspeakService.getLatestFeed();
    
    if (latestResponse && latestResponse.success && latestResponse.data) {
      const processed = dataProcessing.processThingSpeakData([latestResponse.data]);
      const response = {
        success: true,
        data: processed[0],
        timestamp: new Date().toISOString()
      };
      
      // Cache for 2 minutes
      apiCache.set(cacheKey, response, 120, 'quick');
      
      res.json(response);
    } else {
      res.status(404).json({
        success: false,
        message: 'No data available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    debugHelper.error(`Error getting latest data: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get historical data
router.get('/historical', async (req, res) => {
  try {
    const { hours, limit, results } = req.query;
    const cacheKey = `api:data:historical:${hours || 'all'}:${limit || 'all'}:${results || 100}`;
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Get data from ThingSpeak
    const rawData = await thingspeakService.fetchData(parseInt(results) || 100);
    let processedData = dataProcessing.processThingSpeakData(rawData);
    
    // Apply filters
    processedData = dataProcessing.filterByTimeRange(processedData, hours, limit);
    
    const response = {
      success: true,
      data: processedData,
      count: processedData.length,
      filters: { hours, limit, results },
      timestamp: new Date().toISOString()
    };
    
    // Cache for 5 minutes
    apiCache.set(cacheKey, response, 300);
    
    res.json(response);
  } catch (error) {
    debugHelper.error(`Error getting historical data: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get data statistics
router.get('/stats', async (req, res) => {
  try {
    const cacheKey = 'api:data:stats';
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Get recent data for statistics
    const rawData = await thingspeakService.fetchData(200);
    const processedData = dataProcessing.processThingSpeakData(rawData);
    
    if (processedData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data available for statistics',
        timestamp: new Date().toISOString()
      });
    }
    
    const stats = dataProcessing.calculateStatistics(processedData, true);
    stats.lastUpdated = processedData.length > 0 ? processedData[processedData.length - 1].timestamp : null;
    
    const response = {
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    };
    
    // Cache for 10 minutes
    apiCache.set(cacheKey, response, 600);
    
    res.json(response);
  } catch (error) {
    debugHelper.error(`Error getting data statistics: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manual data refresh
router.post('/refresh', async (req, res) => {
  try {
    debugHelper.log('Manual data refresh requested', 'api');
    
    // Clear related caches
    apiCache.invalidateByTag('data');
    
    // Fetch fresh data
    const rawData = await thingspeakService.fetchData(100);
    const processedData = dataProcessing.processThingSpeakData(rawData);
    
    res.json({
      success: true,
      message: 'Data refreshed successfully',
      dataCount: processedData.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    debugHelper.error(`Error refreshing data: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      message: 'Error refreshing data',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * LSTM/PREDICTION ENDPOINTS
 */

// Get LSTM prediction
router.get('/prediction', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const cacheKey = `api:prediction:${hours}h`;
    const cached = apiCache.get(cacheKey);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Get recent data for prediction
    const rawData = await thingspeakService.fetchData(100);
    const processedData = dataProcessing.processThingSpeakData(rawData);
    
    if (processedData.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data for prediction (minimum 10 points required)',
        timestamp: new Date().toISOString()
      });
    }
    
    // Prepare data for LSTM
    const lstmData = dataProcessing.prepareDataForLSTM(processedData);
    
    // Get prediction from Python backend
    const prediction = await pythonBackend.getPrediction(lstmData, parseInt(hours));
    
    const response = {
      success: true,
      prediction: prediction.predictions,
      confidence: prediction.confidence,
      hours: parseInt(hours),
      inputDataPoints: processedData.length,
      timestamp: new Date().toISOString()
    };
    
    // Cache for 30 minutes
    apiCache.set(cacheKey, response, 1800);
    
    res.json(response);
  } catch (error) {
    debugHelper.error(`Error getting prediction: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Train LSTM model
router.post('/train', async (req, res) => {
  try {
    debugHelper.log('LSTM model training requested', 'api');
    
    // Get training data
    const rawData = await thingspeakService.fetchData(1000); // Get more data for training
    const processedData = dataProcessing.processThingSpeakData(rawData);
    
    if (processedData.length < 100) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient data for training (minimum 100 points required)',
        timestamp: new Date().toISOString()
      });
    }
    
    // Prepare data for LSTM
    const trainingData = dataProcessing.prepareDataForLSTM(processedData);
    
    // Train model
    const trainingResult = await pythonBackend.trainModel(trainingData);
    
    // Clear prediction cache since model has changed
    apiCache.invalidateByTag('prediction');
    
    res.json({
      success: true,
      message: 'Model training completed',
      trainingResult: trainingResult,
      trainingDataPoints: processedData.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    debugHelper.error(`Error training model: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * ERROR HANDLER
 */
router.use((err, req, res, next) => {
  debugHelper.error(`API Error: ${err.message}`, 'api');
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
