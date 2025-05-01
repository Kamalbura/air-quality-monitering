/**
 * ThingSpeak API Routes
 * Dedicated endpoints for ThingSpeak integration
 */
const express = require('express');
const router = express.Router();
const thingspeakService = require('../../services/thingspeak-service');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { format } = require('date-fns');

/**
 * Get ThingSpeak channel details
 */
router.get('/channel-details', async (req, res) => {
  try {
    // Use getChannelInfo instead of getChannelFields which doesn't exist
    const channelInfo = await thingspeakService.getChannelInfo();
    
    if (channelInfo.success) {
      res.json({
        success: true,
        data: channelInfo.data
      });
    } else {
      // If ThingSpeak API call fails, try an alternative approach
      // Get channel details from public access which doesn't require API key
      try {
        const axios = require('axios');
        const channelId = process.env.THINGSPEAK_CHANNEL_ID || '2863798';
        
        // Try public access - your channel is marked as public_flag: true
        const response = await axios.get(`https://api.thingspeak.com/channels/${channelId}.json`, {
          timeout: 5000
        });
        
        if (response.status === 200 && response.data) {
          res.json({
            success: true,
            data: response.data,
            source: 'public-api'
          });
          return;
        }
      } catch (publicError) {
        console.log('Failed to fetch channel details through public API:', publicError.message);
      }
      
      res.json({
        success: false,
        error: channelInfo.error || 'Failed to get channel details',
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

/**
 * Get latest feed data
 */
router.get('/latest-feed', async (req, res) => {
  try {
    const results = parseInt(req.query.results) || 1;
    
    const latestData = await thingspeakService.getLatestFeed();
    
    if (latestData.success && latestData.data) {
      res.json({
        success: true,
        data: latestData.data,
        timestamp: new Date().toISOString()
      });
    } else {
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
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        pm25: 'N/A',
        pm10: 'N/A',
        temperature: 'N/A',
        humidity: 'N/A',
        timestamp: new Date().toISOString(),
        entry_id: '0'
      }
    });
  }
});

/**
 * Get ThingSpeak connection status
 */
router.get('/status', async (req, res) => {
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

/**
 * Test ThingSpeak connection
 */
router.get('/test-connection', async (req, res) => {
  try {
    const channelId = req.query.channelId || process.env.THINGSPEAK_CHANNEL_ID;
    const readApiKey = req.query.readApiKey || process.env.THINGSPEAK_READ_API_KEY;

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

/**
 * Get metrics about ThingSpeak service
 */
router.get('/metrics', async (req, res) => {
  try {
    const apiStats = thingspeakService.getStats();
    
    const metrics = {
      connected: apiStats.connectionStatus,
      lastSuccess: apiStats.lastSuccess,
      lastFailure: apiStats.lastFailure,
      usage: {
        used: apiStats.rateLimits?.dailyLimit - apiStats.rateLimits?.requestsRemaining || 0,
        daily_limit: apiStats.rateLimits?.dailyLimit || 1000,
        rate_limit: apiStats.rateLimits?.rateLimit || 60,
        remaining: apiStats.rateLimits?.requestsRemaining || 0
      },
      diagnostics: {
        tests: apiStats.lastDiagnostics?.tests || []
      },
      requests: apiStats.requests?.slice(0, 10) || []
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

/**
 * Export ThingSpeak data to CSV
 * This creates or updates a local CSV file with the latest data
 */
router.post('/export-csv', async (req, res) => {
  try {
    const dataDir = path.join(__dirname, '../../data');
    const csvFilePath = path.join(dataDir, 'thingspeak-data.csv');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Get data from ThingSpeak
    const days = req.body.days || 30;
    const results = req.body.results || 8000; // Max results for free accounts
    
    const data = await thingspeakService.getChannelData({
      days,
      results
    });
    
    if (!data.success || !data.data || data.data.length === 0) {
      return res.json({
        success: false,
        error: 'No data available from ThingSpeak'
      });
    }
    
    // Format data for CSV
    const csvData = data.data.map(entry => {
      return {
        timestamp: entry.created_at,
        entry_id: entry.entry_id,
        humidity: entry.field1 || entry.humidity || '',
        temperature: entry.field2 || entry.temperature || '',
        pm25: entry.field3 || entry.pm25 || '',
        pm10: entry.field4 || entry.pm10 || ''
      };
    });
    
    // Setup CSV writer
    const csvWriter = createCsvWriter({
      path: csvFilePath,
      header: [
        { id: 'timestamp', title: 'TIMESTAMP' },
        { id: 'entry_id', title: 'ENTRY_ID' },
        { id: 'humidity', title: 'HUMIDITY' },
        { id: 'temperature', title: 'TEMPERATURE' },
        { id: 'pm25', title: 'PM25' },
        { id: 'pm10', title: 'PM10' }
      ]
    });
    
    // Write data to CSV
    await csvWriter.writeRecords(csvData);
    
    // Return success response
    res.json({
      success: true,
      data: {
        path: csvFilePath,
        rows: csvData.length,
        date_range: {
          start: csvData[csvData.length - 1].timestamp,
          end: csvData[0].timestamp
        }
      },
      message: `CSV file created with ${csvData.length} rows of data`
    });
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get historical data for a specific timeframe
 */
router.get('/historical', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const results = parseInt(req.query.results) || 1000;
    
    const data = await thingspeakService.getChannelData({
      days,
      results
    });
    
    if (!data.success || !data.data) {
      return res.status(404).json({
        success: false,
        error: 'No historical data available'
      });
    }
    
    // Return the data with extra metadata
    res.json({
      success: true,
      data: data.data,
      metadata: {
        days_requested: days,
        results_requested: results,
        results_returned: data.data.length,
        time_range: data.timeRange || {
          start: data.data[data.data.length - 1]?.created_at,
          end: data.data[0]?.created_at
        }
      }
    });
  } catch (error) {
    console.error('Error fetching historical data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
