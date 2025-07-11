/**
 * Consolidated ThingSpeak Configuration
 * This file centralizes ALL ThingSpeak channel details and settings
 */

// Load environment variables
require('dotenv').config();

// Load from app-config.json if available
let appConfig = {};
try {
    appConfig = require('./app-config.json');
} catch (error) {
    console.warn('app-config.json not found, using environment variables');
}

const THINGSPEAK_CONSOLIDATED = {
    // Channel Information - Use environment variables first, then app-config, then defaults
    CHANNEL: {
        ID: process.env.THINGSPEAK_CHANNEL_ID || appConfig.thingspeak?.channelId || '2863798',
        NAME: 'Air Quality Monitoring Station',
        DESCRIPTION: 'Real-time PM2.5, PM10, Temperature and Humidity monitoring',
        LOCATION: 'Environmental Sensor Network',
        CREATED_AT: '2025-03-05',
        TIMEZONE: 'UTC',
        ELEVATION: null,
        LATITUDE: null,
        LONGITUDE: null,
        TAGS: ['air-quality', 'pm25', 'pm10', 'temperature', 'humidity', 'environmental']
    },

    // API Credentials - Use environment variables first
    API: {
        READ_KEY: process.env.THINGSPEAK_READ_API_KEY || appConfig.thingspeak?.readApiKey || 'RIXYDDDMXDBX9ALI',
        WRITE_KEY: process.env.THINGSPEAK_WRITE_API_KEY || appConfig.thingspeak?.writeApiKey || 'PV514C353A367A3J',
        USER_API_KEY: process.env.THINGSPEAK_USER_API_KEY || null,
        BASE_URL: 'https://api.thingspeak.com',
        CHANNEL_URL: 'https://api.thingspeak.com/channels',
        UPDATE_URL: 'https://api.thingspeak.com/update'
    },

    // Field Mappings - CONFIRMED STRUCTURE
    FIELDS: {
        FIELD1: {
            name: 'humidity',
            label: 'Humidity',
            unit: '%',
            description: 'Relative Humidity percentage',
            color: '#54a0ff',
            min: 0,
            max: 100,
            precision: 1
        },
        FIELD2: {
            name: 'temperature',
            label: 'Temperature', 
            unit: '°C',
            description: 'Temperature in Celsius',
            color: '#ff6b6b',
            min: -40,
            max: 60,
            precision: 1
        },
        FIELD3: {
            name: 'pm25',
            label: 'PM2.5',
            unit: 'μg/m³',
            description: 'Particulate Matter 2.5 micrometers',
            color: '#5f27cd',
            min: 0,
            max: 500,
            precision: 1
        },
        FIELD4: {
            name: 'pm10',
            label: 'PM10',
            unit: 'μg/m³', 
            description: 'Particulate Matter 10 micrometers',
            color: '#00d2d3',
            min: 0,
            max: 600,
            precision: 1
        }
    },

    // Request Settings
    SETTINGS: {
        UPDATE_INTERVAL: appConfig.thingspeak?.updateInterval || 30000, // 30 seconds
        MAX_RESULTS: 8000,
        DEFAULT_RESULTS: 100,
        TIMEOUT: 15000, // 15 seconds
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 2000, // 2 seconds
        RATE_LIMIT: {
            READS_PER_MINUTE: 300,
            WRITES_PER_MINUTE: 1,
            BULK_WRITES_PER_MINUTE: 1
        }
    },

    // Data Validation Rules
    VALIDATION: {
        REQUIRED_FIELDS: ['field1', 'field2', 'field3', 'field4'],
        TIMESTAMP_FORMAT: 'ISO8601',
        OUTLIER_DETECTION: true,
        OUTLIER_THRESHOLD: 3, // Standard deviations
        DATA_QUALITY_THRESHOLD: 0.8 // 80% data completeness
    },

    // Channel Status
    STATUS: {
        ACTIVE: true,
        LAST_VERIFIED: new Date().toISOString(),
        DATA_POINTS: 92365, // Based on your notebook data
        DATE_RANGE: {
            START: '2025-03-05T03:37:33.000Z',
            END: '2025-04-30T07:28:07.000Z'
        },
        HEALTH_CHECK_URL: function() {
            return `${this.API.CHANNEL_URL}/${this.CHANNEL.ID}/feeds/last.json?api_key=${this.API.READ_KEY}`;
        }
    },

    // Helper Methods
    METHODS: {
        /**
         * Get configuration summary for debugging
         */
        getConfigSummary: function() {
            return {
                channelId: this.CHANNEL.ID,
                hasReadKey: !!this.API.READ_KEY,
                hasWriteKey: !!this.API.WRITE_KEY,
                readKeyLength: this.API.READ_KEY ? this.API.READ_KEY.length : 0,
                configSource: process.env.THINGSPEAK_CHANNEL_ID ? 'environment' : 'fallback'
            };
        },

        /**
         * Validate configuration
         */
        validateConfig: function() {
            const issues = [];
            
            if (!this.CHANNEL.ID || this.CHANNEL.ID === 'undefined') {
                issues.push('Channel ID is not configured');
            }
            
            if (!this.API.READ_KEY || this.API.READ_KEY === 'undefined') {
                issues.push('Read API Key is not configured');
            }
            
            return {
                valid: issues.length === 0,
                issues: issues
            };
        },

        /**
         * Get field mapping by ThingSpeak field name
         */
        getFieldByName: function(fieldName) {
            return this.FIELDS[fieldName.toUpperCase()] || null;
        },

        /**
         * Get field mapping by sensor parameter name
         */
        getFieldByParameter: function(paramName) {
            for (const [key, field] of Object.entries(this.FIELDS)) {
                if (field.name === paramName) {
                    return { key, ...field };
                }
            }
            return null;
        },

        /**
         * Build API URL for data fetching
         */
        buildFeedUrl: function(options = {}) {
            const {
                results = this.SETTINGS.DEFAULT_RESULTS,
                start = null,
                end = null,
                days = null
            } = options;

            let url = `${this.API.CHANNEL_URL}/${this.CHANNEL.ID}/feeds.json`;
            const params = new URLSearchParams();

            if (this.API.READ_KEY) {
                params.append('api_key', this.API.READ_KEY);
            }

            if (results !== 'unlimited') {
                params.append('results', results);
            }

            if (days) {
                const endDate = new Date();
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - parseInt(days));
                params.append('start', startDate.toISOString());
                params.append('end', endDate.toISOString());
            } else {
                if (start) params.append('start', start);
                if (end) params.append('end', end);
            }

            return `${url}?${params.toString()}`;
        },

        /**
         * Build channel info URL
         */
        buildChannelUrl: function() {
            let url = `${this.API.CHANNEL_URL}/${this.CHANNEL.ID}.json`;
            if (this.API.READ_KEY) {
                url += `?api_key=${this.API.READ_KEY}`;
            }
            return url;
        },

        /**
         * Validate feed data
         */
        validateFeed: function(feed) {
            const issues = [];
            
            for (const fieldKey of this.VALIDATION.REQUIRED_FIELDS) {
                const fieldConfig = this.getFieldByName(fieldKey);
                const value = parseFloat(feed[fieldKey]);
                
                if (isNaN(value)) {
                    issues.push(`${fieldKey}: Missing or invalid value`);
                    continue;
                }

                if (fieldConfig) {
                    if (value < fieldConfig.min || value > fieldConfig.max) {
                        issues.push(`${fieldKey}: Value ${value} outside range [${fieldConfig.min}, ${fieldConfig.max}]`);
                    }
                }
            }

            return {
                valid: issues.length === 0,
                issues: issues
            };
        },

        /**
         * Get channel status summary
         */
        getStatusSummary: function() {
            return {
                channelId: this.CHANNEL.ID,
                channelName: this.CHANNEL.NAME,
                active: this.STATUS.ACTIVE,
                lastVerified: this.STATUS.LAST_VERIFIED,
                dataPoints: this.STATUS.DATA_POINTS,
                fields: Object.keys(this.FIELDS).length,
                apiEndpoint: this.buildChannelUrl(),
                healthCheckUrl: this.STATUS.HEALTH_CHECK_URL.call(this)
            };
        }
    }
};

// Bind methods to the main object
Object.keys(THINGSPEAK_CONSOLIDATED.METHODS).forEach(methodName => {
    THINGSPEAK_CONSOLIDATED[methodName] = THINGSPEAK_CONSOLIDATED.METHODS[methodName].bind(THINGSPEAK_CONSOLIDATED);
});

// Validate configuration on startup
const validation = THINGSPEAK_CONSOLIDATED.validateConfig();
if (!validation.valid) {
    console.warn('⚠️  ThingSpeak Configuration Issues:');
    validation.issues.forEach(issue => console.warn(`   - ${issue}`));
}

console.log('📡 ThingSpeak Configuration:');
console.log(`   - Channel ID: ${THINGSPEAK_CONSOLIDATED.CHANNEL.ID}`);
console.log(`   - Read API Key: ${THINGSPEAK_CONSOLIDATED.API.READ_KEY ? 'Configured' : 'Not configured'}`);
console.log(`   - Config Source: ${THINGSPEAK_CONSOLIDATED.getConfigSummary().configSource}`);

module.exports = THINGSPEAK_CONSOLIDATED;
