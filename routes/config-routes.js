/**
 * Configuration Routes
 * API endpoints for managing application configuration
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const configService = require('../services/config-service');
const path = require('path');
const fs = require('fs');
const debugHelper = require('../helpers/debug-helper');

// Get the entire configuration
router.get('/', (req, res) => {
  try {
    const config = configService.getConfig();
    res.json({ success: true, config });
  } catch (error) {
    debugHelper.log(`API Error /config: ${error.message}`, 'config-routes', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update a specific section of the configuration
router.post('/:section', (req, res) => {
  const { section } = req.params;
  const updates = req.body;
  
  try {
    const result = configService.updateConfig(section, updates);
    
    if (result) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update configuration' });
    }
  } catch (error) {
    debugHelper.log(`API Error /config/${section}: ${error.message}`, 'config-routes', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update all configuration sections at once
router.post('/all', (req, res) => {
  const updates = req.body;
  
  try {
    let success = true;
    
    // Update each section
    for (const [section, sectionUpdates] of Object.entries(updates)) {
      const sectionResult = configService.updateConfig(section, sectionUpdates);
      if (!sectionResult) {
        success = false;
      }
    }
    
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to update some configuration sections' });
    }
  } catch (error) {
    debugHelper.log(`API Error /config/all: ${error.message}`, 'config-routes', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset configuration to defaults
router.post('/reset', (req, res) => {
  try {
    const result = configService.resetConfig();
    
    if (result) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to reset configuration' });
    }
  } catch (error) {
    debugHelper.log(`API Error /config/reset: ${error.message}`, 'config-routes', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export configuration as JSON file
router.get('/export', (req, res) => {
  try {
    const configData = configService.exportConfig();
    
    if (!configData) {
      return res.status(500).json({ success: false, error: 'Failed to export configuration' });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="air-quality-monitoring-config.json"');
    res.send(configData);
  } catch (error) {
    debugHelper.log(`API Error /config/export: ${error.message}`, 'config-routes', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import configuration from JSON file
router.post('/import', upload.single('config'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const configString = req.file.buffer.toString('utf8');
    const result = configService.importConfig(configString);
    
    if (result) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: 'Failed to import configuration' });
    }
  } catch (error) {
    debugHelper.log(`API Error /config/import: ${error.message}`, 'config-routes', 'error');
    res.status(500).json({ success: false, error: 'Invalid configuration file' });
  }
});

module.exports = router;
