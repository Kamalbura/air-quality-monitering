/**
 * Diagnostics Routes
 * API endpoints for system diagnostics and health checks
 */
const express = require('express');
const router = express.Router();
const os = require('os');
const fs = require('fs');
const path = require('path');
const diagnosticHelper = require('../helpers/diagnostic-helper');
const networkDiagnostics = require('../helpers/network-diagnostics');

// Get system metrics
router.get('/metrics', (req, res) => {
  try {
    // Collect system metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed
      },
      environment: {
        'Node.js Version': process.version,
        'Platform': os.platform(),
        'Architecture': os.arch(),
        'CPU Cores': os.cpus().length
      },
      errors: {
        rate: calculateErrorRate(), // Function to calculate errors per hour
        change: calculateErrorRateChange(), // Function to calculate % change in error rate
        total: countErrors()
      }
    };
    
    res.json({ success: true, data: metrics });
  } catch (error) {
    console.error('Error getting system metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check ThingSpeak connectivity
router.post('/thingspeak', async (req, res) => {
  try {
    const { channelId, readApiKey } = req.body;
    
    // Validate input
    if (!channelId) {
      return res.status(400).json({ success: false, error: 'Channel ID is required' });
    }
    
    // Run diagnostics
    const results = await diagnosticHelper.testThingSpeakConnectivity(channelId, readApiKey);
    
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error testing ThingSpeak connectivity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get logs for diagnostics
router.get('/logs', (req, res) => {
  try {
    const logs = {
      error: readLastLogEntries(path.join(__dirname, '..', 'logs', 'error.log'), 50),
      access: readLastLogEntries(path.join(__dirname, '..', 'logs', 'access.log'), 50),
      api: readLastLogEntries(path.join(__dirname, '..', 'logs', 'api.log'), 50)
    };
    
    res.json({ success: true, data: logs });
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check data quality
router.get('/data-quality', (req, res) => {
  try {
    const dataQuality = assessDataQuality();
    res.json({ success: true, data: dataQuality });
  } catch (error) {
    console.error('Error checking data quality:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run network diagnostics
router.get('/network', async (req, res) => {
  try {
    const results = await networkDiagnostics.runNetworkDiagnostics();
    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error running network diagnostics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add missing helper functions
function calculateErrorRate() {
  // Implementation for error rate calculation
  return Math.floor(Math.random() * 10); // Placeholder
}

function calculateErrorRateChange() {
  // Implementation for error rate change calculation
  return Math.floor(Math.random() * 20) - 10; // Placeholder
}

function countErrors() {
  // Implementation for total error count
  return Math.floor(Math.random() * 100); // Placeholder
}

function readLastLogEntries(logPath, count) {
  // Implementation for reading log entries
  return [`Log entry ${count}`, `Log entry ${count-1}`]; // Placeholder
}

function assessDataQuality() {
  // Implementation for data quality assessment
  return {
    score: Math.random() * 100,
    issues: [],
    recommendations: []
  };
}

module.exports = router;
