// Usage: node export-arduino-config.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config', 'app-config.json');
const outputPath = path.join(__dirname, 'sketch_mar5a', 'sketch_mar5a', 'thingspeak_config.h');

if (!fs.existsSync(configPath)) {
  console.error('Config file not found:', configPath);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const ts = config.thingspeak || {};

if (!ts.channelId || !ts.writeApiKey || !ts.readApiKey) {
  console.error('Missing ThingSpeak configuration in app-config.json');
  process.exit(1);
}

const header = `// Auto-generated from config/app-config.json
#pragma once

#define THINGSPEAK_CHANNEL_ID ${parseInt(ts.channelId, 10)}
#define THINGSPEAK_WRITE_API_KEY "${ts.writeApiKey}"
#define THINGSPEAK_READ_API_KEY "${ts.readApiKey}"
`;

fs.writeFileSync(outputPath, header, 'utf-8');
console.log('Generated thingspeak_config.h from app-config.json');
