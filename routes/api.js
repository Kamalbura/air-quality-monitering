const express = require('express');
const router = express.Router();
const thingspeakService = require('../services/thingspeak-service');
const configService = require('../services/config-service');
const debugHelper = require('../helpers/debug-helper');
const analysisHelper = require('../helpers/analysis-helper');

/**
 * Configuration API endpoints
 */

// Get all configuration (sanitized for client)
router.get('/config', (req, res) => {
  try {
    const config = configService.getConfig();
    
    // Create sanitized config for client-side usage
    const safeConfig = JSON.parse(JSON.stringify(config));
    
    // Remove sensitive information
    if (safeConfig.thingspeak && safeConfig.thingspeak.writeApiKey) {
      safeConfig.thingspeak.writeApiKey = safeConfig.thingspeak.writeApiKey.replace(/./g, '*');
    }
    
    // Add metadata about when this config was last updated
    safeConfig._meta = {
      ...safeConfig._meta,
      retrievedAt: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: safeConfig
    });
  } catch (error) {
    debugHelper.error(`Failed to fetch configuration: ${error.message}`, 'api');
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Could not retrieve configuration' 
    });
  }
});

// Get specific config section
router.get('/config/:section', (req, res) => {
  try {
    const section = req.params.section;
    const sectionData = configService.getConfigSection(section);
    
    if (!sectionData) {
      return res.status(404).json({ 
        success: false, 
        error: `Configuration section '${section}' not found` 
      });
    }
    
    // Don't send write API key to client
    if (section === 'thingspeak' && sectionData.writeApiKey) {
      const safeSectionData = { ...sectionData };
      safeSectionData.writeApiKey = safeSectionData.writeApiKey.replace(/./g, '*');
      return res.json({ success: true, data: safeSectionData });
    }
    
    res.json({ success: true, data: sectionData });
  } catch (error) {
    debugHelper.error(`Failed to fetch config section: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update configuration section
router.put('/config/:section', (req, res) => {
  try {
    const section = req.params.section;
    const updates = req.body;
    
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No updates provided' 
      });
    }
    
    // Special handling for thingspeak section
    if (section === 'thingspeak') {
      // If we're updating ThingSpeak config, also update the ThingSpeak service
      thingspeakService.updateConfig(updates);
    }
    
    const result = configService.updateConfig(section, updates);
    
    if (result) {
      res.json({ 
        success: true,
        message: `Configuration section '${section}' updated successfully`,
        version: configService.getConfig()._meta?.version
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: `Failed to update configuration section '${section}'` 
      });
    }
  } catch (error) {
    debugHelper.error(`Failed to update configuration: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset configuration to defaults
router.post('/config/reset', (req, res) => {
  try {
    // Create a backup before reset
    configService.createConfigBackup();
    
    const result = configService.resetConfig();
    
    // Sync with ThingSpeak service
    thingspeakService.updateConfig(configService.getConfigSection('thingspeak'));
    
    if (result) {
      res.json({ 
        success: true,
        message: 'Configuration reset to defaults successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to reset configuration' 
      });
    }
  } catch (error) {
    debugHelper.error(`Failed to reset configuration: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export configuration
router.get('/config/export', (req, res) => {
  try {
    const configStr = configService.exportConfig();
    
    if (!configStr) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to export configuration' 
      });
    }
    
    if (req.query.download === 'true') {
      // Send as downloadable file
      res.setHeader('Content-Disposition', 'attachment; filename=app-config.json');
      res.setHeader('Content-Type', 'application/json');
      return res.send(configStr);
    }
    
    res.json({ success: true, data: JSON.parse(configStr) });
  } catch (error) {
    debugHelper.error(`Failed to export configuration: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import configuration
router.post('/config/import', (req, res) => {
  try {
    const configData = req.body;
    
    if (!configData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing configuration data' 
      });
    }
    
    // Convert to string if an object was provided
    const configStr = typeof configData === 'string' 
      ? configData 
      : JSON.stringify(configData);
    
    // Create backup before import
    configService.createConfigBackup();
    
    const result = configService.importConfig(configStr);
    
    if (result) {
      // Sync with ThingSpeak service after import
      thingspeakService.updateConfig(configService.getConfigSection('thingspeak'));
      
      res.json({ 
        success: true,
        message: 'Configuration imported successfully',
        version: configService.getConfig()._meta?.version
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to import configuration' 
      });
    }
  } catch (error) {
    debugHelper.error(`Failed to import configuration: ${error.message}`, 'api');
    res.status(500).json({ 
      success: false, 
      error: `Failed to import configuration: ${error.message}` 
    });
  }
});

/**
 * ThingSpeak API routes
 */

// Get ThingSpeak configuration
router.get('/thingspeak/config', (req, res) => {
  try {
    const thingspeakConfig = configService.getConfigSection('thingspeak');
    
    if (!thingspeakConfig) {
      return res.status(404).json({ 
        success: false, 
        error: 'ThingSpeak configuration not found' 
      });
    }
    
    // Create safe copy without write API key
    const safeConfig = { ...thingspeakConfig };
    if (safeConfig.writeApiKey) {
      safeConfig.writeApiKey = safeConfig.writeApiKey.replace(/./g, '*');
    }
    
    res.json({ success: true, data: safeConfig });
  } catch (error) {
    debugHelper.error(`Failed to fetch ThingSpeak config: ${error.message}`, 'api');
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Could not retrieve ThingSpeak configuration' 
    });
  }
});

// Update ThingSpeak configuration with validation
router.put('/thingspeak/config', async (req, res) => {
  try {
    const updates = req.body;
    
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'No updates provided' 
      });
    }
    
    // Basic validation
    if (updates.channelId && (!updates.channelId.toString().match(/^\d+$/))) {
      return res.status(400).json({ 
        success: false, 
        error: 'Channel ID must be a number' 
      });
    }
    
    if (updates.updateInterval && typeof updates.updateInterval !== 'number') {
      updates.updateInterval = parseInt(updates.updateInterval, 10);
      if (isNaN(updates.updateInterval)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Update interval must be a number' 
        });
      }
    }
    
    // Create backup before updating
    configService.createConfigBackup();
    
    // Update both ConfigService and ThingSpeak service
    const configResult = configService.updateConfig('thingspeak', updates);
    thingspeakService.updateConfig(updates);
    
    // Test connection with new settings
    let connectionStatus;
    try {
      connectionStatus = await thingspeakService.checkConnection();
    } catch (err) {
      connectionStatus = { 
        success: false,
        error: err.message,
        connected: false
      };
    }
    
    if (configResult) {
      res.json({ 
        success: true,
        message: 'ThingSpeak configuration updated successfully',
        connectionStatus: connectionStatus
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Failed to update ThingSpeak configuration',
        connectionStatus: connectionStatus
      });
    }
  } catch (error) {
    debugHelper.error(`Failed to update ThingSpeak config: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// ThingSpeak connection test endpoint with diagnostics
router.get('/thingspeak/test', async (req, res) => {
  try {
    // Get config from service directly or use query parameters
    const channelId = req.query.channelId || configService.getConfigSection('thingspeak')?.channelId;
    const readApiKey = req.query.readApiKey || configService.getConfigSection('thingspeak')?.readApiKey;
    
    if (!channelId || !readApiKey) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing ThingSpeak channel ID or read API key' 
      });
    }
    
    // Perform comprehensive connection test
    const results = await thingspeakService.testConnection({
      channelId,
      readApiKey
    });
    
    // Add recommendations if test failed
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
    debugHelper.error(`Failed to test ThingSpeak connection: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get latest feed data from ThingSpeak
router.get('/thingspeak/latest-feed', async (req, res) => {
  try {
    console.log('Fetching latest ThingSpeak feed data');
    const results = parseInt(req.query.results) || 1;
    
    const latestData = await thingspeakService.getLatestFeed(results);
    
    if (latestData && latestData.success && latestData.data) {
      res.json(latestData);
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
    debugHelper.error(`Failed to fetch latest feed: ${error.message}`, 'api');
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch latest feed data',
      fallback: true,
      timestamp: new Date().toISOString()
    });
  }
});

// Get channel data from ThingSpeak with pagination and filters
router.get('/thingspeak/data', async (req, res) => {
  try {
    const options = {
      results: parseInt(req.query.results) || 100,
      start: req.query.start,
      end: req.query.end,
      days: parseInt(req.query.days),
      page: parseInt(req.query.page) || 1
    };
    
    const response = await thingspeakService.getChannelData(options);
    res.json(response);
  } catch (error) {
    debugHelper.error(`Failed to fetch ThingSpeak data: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get ThingSpeak metrics and usage statistics
router.get('/thingspeak/metrics', async (req, res) => {
  try {
    const metrics = thingspeakService.getMetrics();
    res.json({ success: true, data: metrics });
  } catch (error) {
    debugHelper.error(`Failed to fetch ThingSpeak metrics: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * System API routes
 */

// Simple ping endpoint for connection checking
router.get('/ping', (req, res) => {
  res.json({ 
    success: true, 
    timestamp: new Date().toISOString(),
    server_time: new Date().toLocaleString(),
    api_version: '1.0'
  });
});

// System health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Check ThingSpeak connectivity
    const thingspeakStatus = await thingspeakService.checkConnection();
    
    // Get basic system info
    const os = require('os');
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      uptime: os.uptime(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        usage: Math.round((os.totalmem() - os.freemem()) / os.totalmem() * 100)
      }
    };
    
    // Check configuration status
    const configStatus = {
      valid: true,
      lastUpdated: configService.getConfig()._meta?.lastUpdated
    };
    
    res.json({
      success: true,
      status: 'up',
      timestamp: new Date().toISOString(),
      thingspeak: thingspeakStatus,
      system: systemInfo,
      config: configStatus
    });
  } catch (error) {
    debugHelper.error(`Health check failed: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Clear system cache endpoint
router.post('/cache/clear', (req, res) => {
  try {
    const clearedCount = thingspeakService.clearCache();
    res.json({ 
      success: true, 
      clearedCount,
      message: `Cleared ${clearedCount} cache items` 
    });
  } catch (error) {
    debugHelper.error(`Failed to clear cache: ${error.message}`, 'api');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export Arduino configuration via API
router.get('/thingspeak/arduino-config', (req, res) => {
  try {
    const arduinoConfig = configService.generateArduinoConfig();
    
    if (!arduinoConfig) {
      return res.status(500).json({
        success: false,
        error: 'Failed to generate Arduino configuration'
      });
    }
    
    if (req.query.download === 'true') {
      // Send as downloadable header file
      res.setHeader('Content-Disposition', 'attachment; filename=thingspeak_config.h');
      res.setHeader('Content-Type', 'text/plain');
      return res.send(arduinoConfig);
    }
    
    res.json({
      success: true,
      data: arduinoConfig
    });
  } catch (error) {
    debugHelper.error(`Failed to generate Arduino config: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// System diagnostics endpoint
router.get('/diagnostics', async (req, res) => {
  try {
    // Run all diagnostics with improved error handling
    const diagnosticHelper = require('../helpers/diagnostic-helper');
    
    const results = await Promise.allSettled([
      diagnosticHelper.testThingSpeakConnectivity(),
      diagnosticHelper.testApiEndpoints(),
      diagnosticHelper.testSystemResources(),
      diagnosticHelper.testDataQuality()
    ]);
    
    // Format results with custom handling for rejected promises
    const formattedResults = {
      thingspeak: results[0].status === 'fulfilled' ? results[0].value : { 
        success: false, 
        error: results[0].reason?.message || 'Test failed'
      },
      api: results[1].status === 'fulfilled' ? results[1].value : { 
        success: false, 
        error: results[1].reason?.message || 'Test failed'
      },
      system: results[2].status === 'fulfilled' ? results[2].value : { 
        success: false, 
        error: results[2].reason?.message || 'Test failed'
      },
      dataQuality: results[3].status === 'fulfilled' ? results[3].value : { 
        success: false, 
        error: results[3].reason?.message || 'Test failed'
      }
    };
    
    // Calculate overall health score
    const scores = Object.values(formattedResults)
      .map(r => r.success ? 100 : (r.score || 0));
    const overallScore = scores.length 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      healthScore: overallScore,
      details: formattedResults
    });
  } catch (error) {
    debugHelper.error(`Diagnostics failed: ${error.message}`, 'api');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
