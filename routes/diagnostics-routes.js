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
    console.error('Error assessing data quality:', error);
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

/**
 * Calculate hourly error rate from error logs
 */
function calculateErrorRate() {
  try {
    // Simple implementation - returning mocked data for now
    return Math.random() * 5; // 0-5 errors per hour
  } catch (error) {
    console.error('Error calculating error rate:', error);
    return 0;
  }
}

/**
 * Calculate percent change in error rate
 */
function calculateErrorRateChange() {
  try {
    // Simple implementation - returning mocked data for now
    return Math.floor(Math.random() * 40) - 20; // -20% to +20%
  } catch (error) {
    console.error('Error calculating error rate change:', error);
    return 0;
  }
}

/**
 * Count total errors
 */
function countErrors() {
  try {
    // Simple implementation - returning mocked data for now
    return Math.floor(Math.random() * 100) + 1;
  } catch (error) {
    console.error('Error counting errors:', error);
    return 0;
  }
}

/**
 * Read last N lines from a log file
 */
function readLastLogEntries(filePath, numLines = 50) {
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const lastLines = lines.slice(-numLines);
    
    // Parse log entries - this is a simplistic implementation
    // In a real system, you would have a more structured log format
    return lastLines.map(line => {
      try {
        // Try to extract timestamp and message
        const timestampMatch = line.match(/\[([^\]]+)\]/);
        const timestamp = timestampMatch ? timestampMatch[1] : null;
        
        // Extract other information based on log format
        // This is just an example implementation
        if (line.includes('API Error')) {
          return {
            timestamp: timestamp || new Date().toISOString(),
            context: 'API',
            message: line.substring(line.indexOf('API Error'))
          };
        } else {
          return {
            timestamp: timestamp || new Date().toISOString(),
            message: line
          };
        }
      } catch (e) {
        return { message: line, error: 'Parse error' };
      }
    });
  } catch (error) {
    console.error(`Error reading log file ${filePath}:`, error);
    return [];
  }
}

/**
 * Assess data quality
 */
function assessDataQuality() {
  // This would be implemented with real data quality metrics
  // For now, returning mock data for frontend development
  return {
    completeness: {
      overall: Math.floor(Math.random() * 30) + 70, // 70-100%
      metrics: {
        pm25: Array(24).fill(0).map(() => Math.floor(Math.random() * 30) + 70),
        pm10: Array(24).fill(0).map(() => Math.floor(Math.random() * 30) + 70),
        temperature: Array(24).fill(0).map(() => Math.floor(Math.random() * 20) + 80),
        humidity: Array(24).fill(0).map(() => Math.floor(Math.random() * 20) + 80)
      }
    },
    reception: {
      rates: Array(24).fill(0).map(() => Math.floor(Math.random() * 10) + 5), // 5-15 points/min
      dropouts: Math.floor(Math.random() * 5) // 0-5 dropouts
    },
    issues: [
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        metric: 'PM2.5',
        type: 'Out of range',
        description: 'Value exceeded normal range (>500)',
        resolved: true
      },
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        metric: 'Temperature',
        type: 'Missing data',
        description: 'Missing temperature readings for 30 minutes',
        resolved: true
      },
      {
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        metric: 'Humidity',
        type: 'Consistent value',
        description: 'Same value reported for over 1 hour',
        resolved: false
      }
    ]
  };
}

module.exports = router;
