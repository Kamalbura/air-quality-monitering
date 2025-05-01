const express = require('express');
const path = require('path');
const app = express();

// Configure Express static file serving
app.use(express.static('public'));

// Add direct access to the data directory for CSV files
app.use('/data', express.static(path.join(__dirname, 'data')));

// Import ThingSpeak services
const thingspeakService = require('./services/thingspeak-service');
const thingspeakIntegration = require('./services/thingspeak-integration');

// Log ThingSpeak channel info on startup
console.log('ThingSpeak Configuration:');
console.log(`- Channel ID: ${process.env.THINGSPEAK_CHANNEL_ID}`);
console.log(`- Read API Key: ${process.env.THINGSPEAK_READ_API_KEY ? '***' + process.env.THINGSPEAK_READ_API_KEY.slice(-4) : 'Not configured'}`);

// Test ThingSpeak connection on startup
thingspeakService.checkConnection()
  .then(status => {
    if (status.success) {
      console.log('✅ ThingSpeak connection successful');
    } else {
      console.warn('⚠️ ThingSpeak connection issue:', status.message);
    }
  })
  .catch(error => {
    console.error('❌ ThingSpeak connection error:', error.message);
  });

// Make ThingSpeak services available to routes
app.use((req, res, next) => {
  req.thingspeakService = thingspeakService;
  req.thingspeakIntegration = thingspeakIntegration;
  next();
});

module.exports = app;