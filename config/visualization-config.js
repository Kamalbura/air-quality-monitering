/**
 * Configuration for visualization libraries
 */
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

// Ensure fonts directory exists
const fontsDir = path.join(__dirname, '..', 'assets', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Try to register default font if exists
try {
  registerFont(path.join(fontsDir, 'OpenSans-Regular.ttf'), { family: 'Open Sans' });
} catch (err) {
  console.log('Default font not available, using system fonts');
}

// Configure chart rendering dimensions
const width = 800; // px
const height = 600; // px

// Create canvas instances with different background colors
const whiteBackgroundCanvas = new ChartJSNodeCanvas({
  width, height, backgroundColour: 'white',
  plugins: {
    modern: ['chartjs-plugin-annotation']
  }
});

const transparentBackgroundCanvas = new ChartJSNodeCanvas({
  width, height, backgroundColour: 'transparent',
  plugins: {
    modern: ['chartjs-plugin-annotation']
  }
});

// WHO Guidelines for air quality
const WHO_GUIDELINES = {
  PM25: {
    daily: 15, // µg/m³ (24-hour mean)
    annual: 5  // µg/m³ (annual mean)
  },
  PM10: {
    daily: 45, // µg/m³ (24-hour mean)
    annual: 15 // µg/m³ (annual mean)
  }
};

// Air quality index breakpoints and colors
const AQI_LEVELS = [
  { label: 'Good', range: [0, 50], color: 'rgba(0, 228, 0, 1)' },
  { label: 'Moderate', range: [51, 100], color: 'rgba(255, 255, 0, 1)' },
  { label: 'Unhealthy for Sensitive Groups', range: [101, 150], color: 'rgba(255, 126, 0, 1)' },
  { label: 'Unhealthy', range: [151, 200], color: 'rgba(255, 0, 0, 1)' },
  { label: 'Very Unhealthy', range: [201, 300], color: 'rgba(143, 63, 151, 1)' },
  { label: 'Hazardous', range: [301, 500], color: 'rgba(126, 0, 35, 1)' }
];

module.exports = {
  whiteBackgroundCanvas,
  transparentBackgroundCanvas,
  width,
  height,
  WHO_GUIDELINES,
  AQI_LEVELS
};
