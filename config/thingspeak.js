// ThingSpeak Configuration - Using Working Credentials from app-config.json
const THINGSPEAK_CONFIG = {
    // Working credentials from thingspeak-info page
    CHANNEL_ID: '2863798',
    READ_API_KEY: 'RIXYDDDMXDBX9ALI',
    WRITE_API_KEY: 'PV514C353A367A3J',
    BASE_URL: 'https://api.thingspeak.com/channels',
    
    // Field mappings - confirmed working
    FIELDS: {
        HUMIDITY: 'field1',      // field1 maps to humidity
        TEMPERATURE: 'field2',   // field2 maps to temperature  
        PM25: 'field3',         // field3 maps to PM2.5
        PM10: 'field4'          // field4 maps to PM10
    },
    
    // Request settings
    UPDATE_INTERVAL: 30 * 1000,     // 30 seconds (matching app-config)
    MAX_RESULTS: 8000,               // Maximum records to fetch
    TIMEOUT: 10000                   // 10 seconds timeout
};

module.exports = THINGSPEAK_CONFIG;
