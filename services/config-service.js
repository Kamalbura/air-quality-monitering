/**
 * Configuration Service
 * Handles loading, saving, and managing application configuration
 * Enhanced with schema validation, environment variable overrides, and synchronization capabilities
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

// Configuration schema definition for validation
const CONFIG_SCHEMA = {
  version: '2.0.0',
  properties: {
    thingspeak: {
      required: ['channelId', 'readApiKey', 'fields'],
      properties: {
        channelId: { type: 'string', minLength: 1 },
        readApiKey: { type: 'string', minLength: 1 },
        writeApiKey: { type: 'string' },
        updateInterval: { type: 'number', minimum: 5000, maximum: 3600000 },
        fields: {
          required: ['humidity', 'temperature', 'pm25', 'pm10'],
          properties: {
            humidity: { type: 'string' },
            temperature: { type: 'string' },
            pm25: { type: 'string' },
            pm10: { type: 'string' }
          }
        }
      }
    },
    dataSources: {
      required: ['defaultCsvPath', 'csvUploadDir', 'dataExportDir'],
      properties: {
        defaultCsvPath: { type: 'string' },
        csvUploadDir: { type: 'string' },
        dataExportDir: { type: 'string' },
        syncWithCloud: { type: 'boolean' }
      }
    },
    system: {
      required: ['port', 'logLevel', 'cacheTTL'],
      properties: {
        port: { type: 'number', minimum: 1, maximum: 65535 },
        logLevel: { type: 'string', enum: ['error', 'warn', 'info', 'debug', 'trace'] },
        cacheTTL: { type: 'number', minimum: 10, maximum: 86400 },
        debugMode: { type: 'boolean' }
      }
    },
    visualization: {
      properties: {
        defaultEngine: { type: 'string', enum: ['client', 'server', 'auto'] },
        chartTheme: { type: 'string', enum: ['light', 'dark', 'auto'] },
        autoRefresh: { type: 'boolean' },
        showExtendedViews: { type: 'boolean' }
      }
    },
    security: {
      properties: {
        enableRateLimiting: { type: 'boolean' },
        maxRequestsPerMinute: { type: 'number', minimum: 10, maximum: 1000 },
        enableIPBlocking: { type: 'boolean' }
      }
    }
  }
};

/**
 * Environment variable mapping to configuration properties
 * Allows overriding configuration via environment variables
 */
const ENV_MAPPING = {
  'THINGSPEAK_CHANNEL_ID': 'thingspeak.channelId',
  'THINGSPEAK_READ_API_KEY': 'thingspeak.readApiKey',
  'THINGSPEAK_WRITE_API_KEY': 'thingspeak.writeApiKey',
  'THINGSPEAK_UPDATE_INTERVAL': 'thingspeak.updateInterval',
  'PORT': 'system.port',
  'LOG_LEVEL': 'system.logLevel',
  'CACHE_TTL': 'system.cacheTTL',
  'DEBUG_MODE': 'system.debugMode',
  'DEFAULT_CSV_PATH': 'dataSources.defaultCsvPath',
  'CSV_UPLOAD_DIR': 'dataSources.csvUploadDir',
  'DATA_EXPORT_DIR': 'dataSources.dataExportDir',
  'VISUALIZATION_ENGINE': 'visualization.defaultEngine',
  'CHART_THEME': 'visualization.chartTheme', 
  'ENABLE_RATE_LIMITING': 'security.enableRateLimiting',
  'MAX_REQUESTS_PER_MINUTE': 'security.maxRequestsPerMinute'
};

class ConfigService {
  constructor() {
    this.configPath = path.join(__dirname, '..', 'config', 'app-config.json');
    this.configBackupDir = path.join(__dirname, '..', 'config', 'backups');
    this.schemaPath = path.join(__dirname, '..', 'config', 'config-schema.json');
    this.syncLock = false;
    this.lastSyncTime = Date.now();
    this.changeListeners = [];
    this.validationErrors = [];
    this.configSchema = CONFIG_SCHEMA;
    
    this.defaultConfig = {
      _meta: {
        version: '2.0.0',
        lastUpdated: new Date().toISOString(),
        syncStatus: 'ok',
        schema: CONFIG_SCHEMA.version
      },
      thingspeak: {
        channelId: process.env.THINGSPEAK_CHANNEL_ID || '2863798',
        readApiKey: process.env.THINGSPEAK_READ_API_KEY || 'RIXYDDDMXDBX9ALI',
        writeApiKey: process.env.THINGSPEAK_WRITE_API_KEY || 'PV514C353A367A3J',
        updateInterval: 30000, // 30 seconds
        fields: {
          humidity: 'field1',
          temperature: 'field2',
          pm25: 'field3',
          pm10: 'field4'
        }
      },
      dataSources: {
        defaultCsvPath: path.join(__dirname, '..', 'data', 'air_quality_data.csv'),
        csvUploadDir: path.join(__dirname, '..', 'data', 'uploads'),
        dataExportDir: path.join(__dirname, '..', 'data', 'exports'),
        syncWithCloud: false
      },
      system: {
        port: process.env.PORT || 3000,
        logLevel: process.env.LOG_LEVEL || 'info',
        cacheTTL: 300, // 5 minutes
        debugMode: process.env.NODE_ENV === 'development'
      },
      visualization: {
        defaultEngine: 'client', // 'client' or 'server' or 'auto'
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
    this.ensureDirectoryExists(path.dirname(this.configPath));
    this.ensureDirectoryExists(this.configBackupDir);
    
    // Save schema for reference
    this.saveSchema();
    
    // Load the config and apply environment variable overrides
    this.config = this.loadConfig();
    this.applyEnvOverrides();
    
    // Ensure directories exist
    this.ensureDirectoriesExist();
  }
  
  /**
   * Save the configuration schema for reference
   */
  saveSchema() {
    try {
      if (!fs.existsSync(this.schemaPath)) {
        fs.writeFileSync(this.schemaPath, JSON.stringify(this.configSchema, null, 2), 'utf-8');
        debug.log('Saved configuration schema', 'config-service');
      }
    } catch (err) {
      debug.error(`Error saving schema: ${err.message}`, 'config-service');
    }
  }
  
  /**
   * Apply environment variable overrides to loaded configuration
   */
  applyEnvOverrides() {
    let hasChanges = false;
    
    // Apply mappings from environment variables to config
    for (const [envVar, configPath] of Object.entries(ENV_MAPPING)) {
      if (process.env[envVar]) {
        const pathParts = configPath.split('.');
        let target = this.config;
        
        // Navigate to the nested property
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          if (!target[part]) {
            target[part] = {};
          }
          target = target[part];
        }
        
        // Set the value with appropriate type conversion
        const lastPart = pathParts[pathParts.length - 1];
        const currentValue = target[lastPart];
        let newValue = process.env[envVar];
        
        // Type conversion based on current value type
        if (typeof currentValue === 'number') {
          newValue = Number(newValue);
          if (isNaN(newValue)) continue; // Skip invalid number
        } else if (typeof currentValue === 'boolean') {
          newValue = newValue.toLowerCase() === 'true';
        }
        
        // Update only if different
        if (target[lastPart] !== newValue) {
          debug.log(`Overriding ${configPath} with environment variable ${envVar}`, 'config-service');
          target[lastPart] = newValue;
          hasChanges = true;
        }
      }
    }
    
    // If env vars changed config, update the meta info
    if (hasChanges) {
      this.config._meta.lastUpdated = new Date().toISOString();
      this.config._meta.envOverride = true;
      
      // Save changes to persist env overrides
      this.saveConfig(this.config);
    }
  }
  
  /**
   * Ensure a directory exists
   * @param {string} dir - Directory path
   */
  ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        debug.log(`Created directory: ${dir}`, 'config-service');
      } catch (err) {
        debug.error(`Failed to create directory ${dir}: ${err.message}`, 'config-service');
      }
    }
  }
  
  /**
   * Ensure all required directories exist
   */
  ensureDirectoriesExist() {
    const dirPaths = [
      path.dirname(this.configPath),
      this.configBackupDir,
      this.config.dataSources.csvUploadDir,
      this.config.dataSources.dataExportDir
    ];
    
    for (const dir of dirPaths) {
      this.ensureDirectoryExists(dir);
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
        let config;
        
        try {
          config = JSON.parse(configData);
        } catch (parseError) {
          debug.error(`Invalid JSON in config file: ${parseError.message}`, 'config-service');
          
          // Try to recover from backup
          return this.recoverFromBackup() || this.defaultConfig;
        }
        
        // Check schema compatibility
        if (config._meta && config._meta.schema) {
          const configSchemaVersion = config._meta.schema;
          const currentSchemaVersion = this.configSchema.version;
          
          if (configSchemaVersion !== currentSchemaVersion) {
            debug.log(`Schema version mismatch: config=${configSchemaVersion}, current=${currentSchemaVersion}`, 'config-service');
            
            // Handle schema migration if needed
            config = this.migrateSchema(config, configSchemaVersion, currentSchemaVersion);
          }
        }
        
        // Check if config has the expected structure
        const validationResult = this.validateConfig(config);
        if (!validationResult.valid) {
          debug.error(`Configuration validation failed: ${validationResult.errors.join(', ')}`, 'config-service');
          this.validationErrors = validationResult.errors;
          
          // Use config anyway but merge with defaults to ensure all props exist
          return this.mergeWithDefaults(config);
        }
        
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
   * Migrate configuration schema from old version to new version
   * @param {Object} config - Old config
   * @param {string} fromVersion - Old schema version
   * @param {string} toVersion - New schema version
   * @returns {Object} Migrated config
   */
  migrateSchema(config, fromVersion, toVersion) {
    debug.log(`Migrating config schema from ${fromVersion} to ${toVersion}`, 'config-service');
    
    // Create a backup before migration
    this.createConfigBackup();
    
    // Simple migration strategy - merge with current defaults
    const migrated = this.mergeWithDefaults(config);
    
    // Update schema version
    if (!migrated._meta) migrated._meta = {};
    migrated._meta.schema = toVersion;
    migrated._meta.lastUpdated = new Date().toISOString();
    migrated._meta.migrated = true;
    migrated._meta.previousVersion = fromVersion;
    
    // Save the migrated config
    this.saveConfig(migrated);
    
    return migrated;
  }
  
  /**
   * Validate the configuration against schema
   * @param {Object} config - Config to validate
   * @returns {Object} Validation result {valid: boolean, errors: string[]}
   */
  validateConfig(config) {
    const errors = [];
    
    // Basic validation - check if required sections exist
    const requiredSections = ['thingspeak', 'system', 'dataSources'];
    const missingSections = requiredSections.filter(
      section => !config[section] || typeof config[section] !== 'object'
    );
    
    if (missingSections.length > 0) {
      errors.push(`Missing required sections: ${missingSections.join(', ')}`);
    }
    
    // Schema validation for each section
    for (const section in this.configSchema.properties) {
      if (config[section]) {
        const sectionSchema = this.configSchema.properties[section];
        const sectionConfig = config[section];
        
        // Check required properties
        if (sectionSchema.required) {
          const missingProps = sectionSchema.required.filter(prop => !sectionConfig[prop]);
          if (missingProps.length > 0) {
            errors.push(`Section "${section}" missing required properties: ${missingProps.join(', ')}`);
          }
        }
        
        // Check property types and constraints
        if (sectionSchema.properties) {
          for (const prop in sectionSchema.properties) {
            if (sectionConfig[prop] !== undefined) {
              const propSchema = sectionSchema.properties[prop];
              const value = sectionConfig[prop];
              
              // Type check
              const expectedType = propSchema.type;
              const actualType = typeof value;
              if (expectedType && actualType !== expectedType) {
                errors.push(`Property "${section}.${prop}" has wrong type: expected ${expectedType}, got ${actualType}`);
              }
              
              // Range check for numbers
              if (expectedType === 'number') {
                if (propSchema.minimum !== undefined && value < propSchema.minimum) {
                  errors.push(`Property "${section}.${prop}" below minimum: ${value} < ${propSchema.minimum}`);
                }
                if (propSchema.maximum !== undefined && value > propSchema.maximum) {
                  errors.push(`Property "${section}.${prop}" above maximum: ${value} > ${propSchema.maximum}`);
                }
              }
              
              // String length check
              if (expectedType === 'string') {
                if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
                  errors.push(`Property "${section}.${prop}" too short: ${value.length} < ${propSchema.minLength}`);
                }
                if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
                  errors.push(`Property "${section}.${prop}" too long: ${value.length} > ${propSchema.maxLength}`);
                }
              }
              
              // Enum check
              if (propSchema.enum && !propSchema.enum.includes(value)) {
                errors.push(`Property "${section}.${prop}" has invalid value: ${value}. Allowed: ${propSchema.enum.join(', ')}`);
              }
            }
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get validation errors from the last validation
   * @returns {Array} Array of validation error messages
   */
  getValidationErrors() {
    return this.validationErrors;
  }
  
  /**
   * Try to recover configuration from backup
   * @returns {Object|null} Recovered config or null if recovery failed
   */
  recoverFromBackup() {
    try {
      // List backup files
      const backupFiles = fs.readdirSync(this.configBackupDir)
        .filter(file => file.startsWith('app-config-backup-'))
        .sort()
        .reverse(); // Get newest first
      
      // Try to recover from the newest backup
      for (const backupFile of backupFiles) {
        try {
          const backupPath = path.join(this.configBackupDir, backupFile);
          const backupData = fs.readFileSync(backupPath, 'utf-8');
          const backupConfig = JSON.parse(backupData);
          
          // Do a basic validation to ensure it's a usable config
          if (backupConfig && typeof backupConfig === 'object' && 
              backupConfig.thingspeak && backupConfig.system) {
            debug.log(`Recovered configuration from backup: ${backupFile}`, 'config-service');
            return backupConfig;
          }
        } catch (e) {
          debug.error(`Failed to recover from backup ${backupFile}: ${e.message}`, 'config-service');
        }
      }
    } catch (err) {
      debug.error(`Error during backup recovery: ${err.message}`, 'config-service');
    }
    
    return null;
  }
  
  /**
   * Create a backup of the current configuration
   */
  createConfigBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.configBackupDir, `app-config-backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, JSON.stringify(this.config, null, 2), 'utf-8');
      
      // Clean up old backups - keep only the 10 most recent
      this.cleanupOldBackups(10);
      
      debug.log(`Created configuration backup: ${backupPath}`, 'config-service');
    } catch (err) {
      debug.error(`Failed to create config backup: ${err.message}`, 'config-service');
    }
  }
  
  /**
   * Clean up old backup files
   * @param {number} keepCount - Number of recent backups to keep
   */
  cleanupOldBackups(keepCount = 10) {
    try {
      const backupFiles = fs.readdirSync(this.configBackupDir)
        .filter(file => file.startsWith('app-config-backup-'))
        .sort();
      
      // Remove older backups
      if (backupFiles.length > keepCount) {
        const filesToRemove = backupFiles.slice(0, backupFiles.length - keepCount);
        filesToRemove.forEach(file => {
          try {
            fs.unlinkSync(path.join(this.configBackupDir, file));
          } catch (e) {
            debug.error(`Failed to delete backup file ${file}: ${e.message}`, 'config-service');
          }
        });
      }
    } catch (err) {
      debug.error(`Failed to clean up old backups: ${err.message}`, 'config-service');
    }
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
      if (section === '_meta') {
        // Handle metadata specially
        merged._meta = {
          ...merged._meta,
          ...config._meta,
          lastUpdated: config._meta?.lastUpdated || new Date().toISOString()
        };
      } else if (section in merged && typeof config[section] === 'object') {
        merged[section] = { ...merged[section], ...config[section] };
        
        // Special case for ThingSpeak fields - preserve field mappings
        if (section === 'thingspeak' && config.thingspeak && config.thingspeak.fields) {
          merged.thingspeak.fields = {
            ...merged.thingspeak.fields,
            ...config.thingspeak.fields
          };
        }
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
      // Prevent saving during sync lock
      if (this.syncLock) {
        debug.log('Skipping config save due to sync lock', 'config-service');
        return false;
      }
      
      // Create backup before changing
      if (fs.existsSync(this.configPath)) {
        this.createConfigBackup();
      }
      
      // Update metadata
      const configToSave = { 
        ...config,
        _meta: {
          ...(config._meta || {}),
          lastUpdated: new Date().toISOString(),
          version: config._meta?.version || this.defaultConfig._meta.version,
          schema: this.configSchema.version
        }
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(configToSave, null, 2), 'utf-8');
      this.config = configToSave;
      
      // Reset validation errors
      this.validationErrors = [];
      
      // Notify change listeners
      this.notifyChangeListeners();
      
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
   * Get a specific section of the configuration with validation
   * @param {string} section - Section name
   * @returns {Object|null} Config section or null if not found
   */
  getConfigSection(section) {
    if (!this.config[section]) {
      debug.error(`Config section '${section}' does not exist`, 'config-service');
      return null;
    }
    return this.config[section];
  }
  
  /**
   * Get a specific configuration value by path
   * @param {string} path - Config path (e.g., 'thingspeak.channelId')
   * @param {any} defaultValue - Default value if path doesn't exist
   * @returns {any} Config value or default
   */
  getConfigValue(path, defaultValue = null) {
    try {
      const pathParts = path.split('.');
      let value = this.config;
      
      for (const part of pathParts) {
        if (value === undefined || value === null) return defaultValue;
        value = value[part];
      }
      
      return value !== undefined ? value : defaultValue;
    } catch (err) {
      debug.error(`Error getting config value for path ${path}: ${err.message}`, 'config-service');
      return defaultValue;
    }
  }
  
  /**
   * Update a specific configuration value by path
   * @param {string} path - Config path (e.g., 'thingspeak.channelId')
   * @param {any} value - New value
   * @returns {boolean} Success status
   */
  setConfigValue(path, value) {
    try {
      const pathParts = path.split('.');
      const lastPart = pathParts.pop();
      let target = this.config;
      
      // Navigate to the parent object
      for (const part of pathParts) {
        if (target[part] === undefined || target[part] === null || typeof target[part] !== 'object') {
          target[part] = {};
        }
        target = target[part];
      }
      
      // Only update if value has changed
      if (target[lastPart] !== value) {
        target[lastPart] = value;
        
        // Update version
        if (this.config._meta) {
          const versionParts = this.config._meta.version.split('.');
          versionParts[2] = (parseInt(versionParts[2], 10) + 1).toString();
          this.config._meta.version = versionParts.join('.');
        }
        
        return this.saveConfig(this.config);
      }
      
      return true;
    } catch (err) {
      debug.error(`Error setting config value for path ${path}: ${err.message}`, 'config-service');
      return false;
    }
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
      const newConfig = { ...this.config };
      newConfig[section] = { ...newConfig[section], ...updates };
      
      // Update version
      if (newConfig._meta) {
        const versionParts = newConfig._meta.version.split('.');
        versionParts[2] = (parseInt(versionParts[2], 10) + 1).toString();
        newConfig._meta.version = versionParts.join('.');
      }
      
      return this.saveConfig(newConfig);
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
    // Create backup before reset
    this.createConfigBackup();
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
      
      // Validate the imported config
      const validationResult = this.validateConfig(newConfig);
      if (!validationResult.valid) {
        debug.error(`Imported configuration validation failed: ${validationResult.errors.join(', ')}`, 'config-service');
        this.validationErrors = validationResult.errors;
        return false;
      }
      
      // Make sure we don't completely overwrite with potentially missing properties
      const mergedConfig = this.mergeWithDefaults(newConfig);
      
      // Create backup before import
      this.createConfigBackup();
      
      return this.saveConfig(mergedConfig);
    } catch (err) {
      debug.error(`Error importing configuration: ${err.message}`, 'config-service');
      return false;
    }
  }
  
  /**
   * Register a change listener for configuration changes
   * @param {Function} listener - Function to call when config changes
   * @returns {Function} Function to unregister the listener
   */
  onChange(listener) {
    if (typeof listener === 'function') {
      this.changeListeners.push(listener);
      
      // Return unsubscribe function
      return () => {
        this.changeListeners = this.changeListeners.filter(l => l !== listener);
      };
    }
  }
  
  /**
   * Notify all registered change listeners
   */
  notifyChangeListeners() {
    const config = this.getConfig();
    this.changeListeners.forEach(listener => {
      try {
        listener(config);
      } catch (error) {
        debug.error(`Error in config change listener: ${error.message}`, 'config-service');
      }
    });
  }
  
  /**
   * Generate Arduino compatible configuration file
   * @returns {string} Arduino header file content
   */
  generateArduinoConfig() {
    try {
      const ts = this.config.thingspeak;
      
      return `// Auto-generated ThingSpeak configuration for Arduino
// Generated on ${new Date().toISOString()} from app-config.json
// Config Version: ${this.config._meta?.version || 'unknown'}
#ifndef THINGSPEAK_CONFIG_H
#define THINGSPEAK_CONFIG_H

#define THINGSPEAK_CHANNEL_ID "${ts.channelId}"
#define THINGSPEAK_READ_API_KEY "${ts.readApiKey}"
#define THINGSPEAK_WRITE_API_KEY "${ts.writeApiKey}"
#define THINGSPEAK_UPDATE_INTERVAL ${ts.updateInterval}

// Field mappings
#define FIELD_HUMIDITY "${ts.fields.humidity}"
#define FIELD_TEMPERATURE "${ts.fields.temperature}"
#define FIELD_PM25 "${ts.fields.pm25}"
#define FIELD_PM10 "${ts.fields.pm10}"

// Connection timeout in milliseconds
#define CONNECTION_TIMEOUT 10000

// Error handling and retry parameters
#define MAX_RETRY_ATTEMPTS 5
#define RETRY_DELAY 5000

#endif // THINGSPEAK_CONFIG_H
`;
    } catch (err) {
      debug.error(`Error generating Arduino config: ${err.message}`, 'config-service');
      return null;
    }
  }
  
  /**
   * Save Arduino configuration to file
   * @param {string} filePath - Path to save the Arduino config
   * @returns {boolean} Success status
   */
  saveArduinoConfig(filePath) {
    try {
      const arduinoConfig = this.generateArduinoConfig();
      if (!arduinoConfig) return false;
      
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      fs.writeFileSync(filePath, arduinoConfig, 'utf-8');
      debug.log(`Arduino configuration saved to ${filePath}`, 'config-service');
      return true;
    } catch (err) {
      debug.error(`Error saving Arduino config: ${err.message}`, 'config-service');
      return false;
    }
  }
  
  /**
   * Get stats about the configuration
   * @returns {Object} Configuration statistics
   */
  getConfigStats() {
    try {
      const stats = {
        lastUpdated: this.config._meta?.lastUpdated,
        version: this.config._meta?.version,
        schemaVersion: this.config._meta?.schema,
        hasEnvOverrides: !!this.config._meta?.envOverride,
        validationErrors: this.validationErrors.length,
        backupCount: 0,
        sections: Object.keys(this.config).filter(k => k !== '_meta').length
      };
      
      // Count backups
      if (fs.existsSync(this.configBackupDir)) {
        stats.backupCount = fs.readdirSync(this.configBackupDir)
          .filter(file => file.startsWith('app-config-backup-')).length;
      }
      
      return stats;
    } catch (err) {
      debug.error(`Error getting config stats: ${err.message}`, 'config-service');
      return {
        error: err.message
      };
    }
  }
}

module.exports = new ConfigService();
