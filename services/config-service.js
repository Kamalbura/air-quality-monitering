/**
 * Configuration Service
 * Handles loading, saving, and managing application configuration
 */
const fs = require('fs');
const path = require('path');

// Import debug helper if available or create a simple fallback
let debug;
try {
  debug = require('../helpers/debug-helper');
} catch (err) {
  debug = {
    log: (msg, context) => console.log(`[${context}] ${msg}`),
    error: (msg, context) => console.error(`[${context}] ${msg}`)
  };
}

class ConfigService {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'config', 'app-config.json');
    this.defaultConfig = {
      thingspeak: {
        channelId: process.env.THINGSPEAK_CHANNEL_ID || '2863798',
        readApiKey: process.env.THINGSPEAK_READ_API_KEY || 'RIXYDDDMXDBX9ALI',
        writeApiKey: process.env.THINGSPEAK_WRITE_API_KEY || '',
        updateInterval: 30000 // 30 seconds
      },
      dataSources: {
        defaultCsvPath: path.join(__dirname, '..', 'data', 'air_quality_data.csv'),
        csvUploadDir: path.join(__dirname, '..', 'data', 'uploads'),
        dataExportDir: path.join(__dirname, '..', 'data', 'exports')
      },
      system: {
        port: process.env.PORT || 3000,
        logLevel: process.env.LOG_LEVEL || 'info',
        cacheTTL: 300, // 5 minutes
        debugMode: process.env.NODE_ENV === 'development'
      },
      visualization: {
        defaultEngine: 'client', // 'client' or 'server'
        chartTheme: 'light',
        autoRefresh: true,
        showExtendedViews: false
      },
      security: {
        enableRateLimiting: true,
        maxRequestsPerMinute: 100,
        enableIPBlocking: false
      }
    };
    
    // Create config directory if it doesn't exist
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      try {
        fs.mkdirSync(configDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create config directory: ${err.message}`);
      }
    }
    
    this.config = this.loadConfig();
    
    // Ensure directories exist
    this.ensureDirectoriesExist();
  }
  
  /**
   * Ensure all required directories exist
   */
  ensureDirectoriesExist() {
    const dirPaths = [
      path.dirname(this.configPath),
      this.config.dataSources.csvUploadDir,
      this.config.dataSources.dataExportDir
    ];
    
    for (const dir of dirPaths) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          debug.log(`Created directory: ${dir}`, 'config-service');
        } catch (err) {
          debug.error(`Failed to create directory ${dir}: ${err.message}`, 'config-service');
        }
      }
    }
  }
  
  /**
   * Load configuration from file or initialize with defaults
   * @returns {Object} Current configuration
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(configData);
        
        // Merge with default config to ensure all properties exist
        return this.mergeWithDefaults(config);
      }
    } catch (err) {
      debug.error(`Error loading configuration: ${err.message}`, 'config-service');
    }
    
    // If we get here, either the file doesn't exist or there was an error
    // Initialize with default config
    this.saveConfig(this.defaultConfig);
    return this.defaultConfig;
  }
  
  /**
   * Merge a config object with defaults to ensure all properties exist
   * @param {Object} config - Config object to merge
   * @returns {Object} Merged config
   */
  mergeWithDefaults(config) {
    const merged = JSON.parse(JSON.stringify(this.defaultConfig)); // Deep clone
    
    // Only merge top-level sections that exist in the input config
    for (const section in config) {
      if (section in merged && typeof config[section] === 'object') {
        merged[section] = { ...merged[section], ...config[section] };
      }
    }
    
    return merged;
  }
  
  /**
   * Save configuration to file
   * @param {Object} config - Configuration to save
   * @returns {boolean} Success status
   */
  saveConfig(config) {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.config = config;
      return true;
    } catch (err) {
      debug.error(`Error saving configuration: ${err.message}`, 'config-service');
      return false;
    }
  }
  
  /**
   * Get the current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return this.config;
  }
  
  /**
   * Update a section of the configuration
   * @param {string} section - Section name (e.g., 'thingspeak', 'dataSources')
   * @param {Object} updates - Updates to apply to that section
   * @returns {boolean} Success status
   */
  updateConfig(section, updates) {
    if (!this.config[section]) {
      debug.error(`Config section '${section}' does not exist`, 'config-service');
      return false;
    }
    
    try {
      this.config[section] = { ...this.config[section], ...updates };
      return this.saveConfig(this.config);
    } catch (err) {
      debug.error(`Error updating configuration: ${err.message}`, 'config-service');
      return false;
    }
  }
  
  /**
   * Reset configuration to defaults
   * @returns {boolean} Success status
   */
  resetConfig() {
    return this.saveConfig(this.defaultConfig);
  }
  
  /**
   * Export configuration as JSON string
   * @returns {string} JSON string of the configuration
   */
  exportConfig() {
    try {
      return JSON.stringify(this.config, null, 2);
    } catch (err) {
      debug.error(`Error exporting configuration: ${err.message}`, 'config-service');
      return null;
    }
  }
  
  /**
   * Import configuration from JSON string
   * @param {string} configStr - JSON string of configuration
   * @returns {boolean} Success status
   */
  importConfig(configStr) {
    try {
      const newConfig = JSON.parse(configStr);
      // Make sure we don't completely overwrite with potentially missing properties
      const mergedConfig = this.mergeWithDefaults(newConfig);
      return this.saveConfig(mergedConfig);
    } catch (err) {
      debug.error(`Error importing configuration: ${err.message}`, 'config-service');
      return false;
    }
  }
}

module.exports = new ConfigService();
