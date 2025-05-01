/**
 * Export Arduino Configuration Script
 * Generates a configuration header file for Arduino/ESP8266 firmware
 * from the centralized configuration managed by ConfigService
 * 
 * Usage: node export-arduino-config.js [output-path]
 */
const path = require('path');
const configService = require('./services/config-service');

// Get output path from command line or use default
const outputPath = process.argv[2] || 
  path.join(__dirname, 'sketch_mar5a', 'sketch_mar5a', 'thingspeak_config.h');

// Get ThingSpeak config from the service
const thingspeakConfig = configService.getConfigSection('thingspeak');

if (!thingspeakConfig) {
  console.error('Could not retrieve ThingSpeak configuration from ConfigService');
  process.exit(1);
}

console.log('Exporting ThingSpeak configuration to Arduino header file...');
console.log(`Channel ID: ${thingspeakConfig.channelId}`);
console.log(`Update Interval: ${thingspeakConfig.updateInterval}ms`);

// Generate and save the Arduino configuration file
const success = configService.saveArduinoConfig(outputPath);

if (success) {
  console.log(`Successfully generated Arduino config at: ${outputPath}`);
  console.log('You can now upload this configuration to your ESP8266/Arduino device');
} else {
  console.error('Failed to generate Arduino configuration');
  process.exit(1);
}
