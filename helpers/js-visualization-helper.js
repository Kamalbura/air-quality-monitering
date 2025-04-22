/**
 * JavaScript Visualization Helper
 * Provides visualization functions without requiring external dependencies
 */
const path = require('path');
const fs = require('fs');
const { createCanvas } = require('canvas');
const analysisHelper = require('./analysis-helper');

/**
 * Create a time series chart using Node.js Canvas
 * @param {Array} data - Air quality data array
 * @param {string} outputPath - Path to save the image
 * @returns {Promise<Object>} Chart info
 */
async function createTimeSeriesChart(data, outputPath) {
  try {
    // Process data for visualization
    const { processedData } = analysisHelper.processDataForAnalysis(data);
    if (!processedData || processedData.length === 0) {
      throw new Error('No valid data for visualization');
    }

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);

    // Set up margins
    const margin = {
      top: 40,
      right: 30,
      bottom: 60,
      left: 60
    };

    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Draw title
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText('PM2.5 and PM10 Time Series', width / 2, 20);

    // Extract PM2.5 and PM10 data
    const pm25Data = processedData.map(d => ({ x: d.timestamp, y: d.pm25 }))
      .filter(d => d.y !== null);
    const pm10Data = processedData.map(d => ({ x: d.timestamp, y: d.pm10 }))
      .filter(d => d.y !== null);

    if (pm25Data.length === 0 && pm10Data.length === 0) {
      throw new Error('No PM2.5 or PM10 data available');
    }

    // Find min and max values for axes
    const allValues = [...pm25Data.map(d => d.y), ...pm10Data.map(d => d.y)];
    const minY = Math.min(...allValues);
    const maxY = Math.max(...allValues);
    const yPadding = (maxY - minY) * 0.1;

    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Y-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, height - margin.bottom);
    ctx.stroke();

    // X-axis
    ctx.beginPath();
    ctx.moveTo(margin.left, height - margin.bottom);
    ctx.lineTo(width - margin.right, height - margin.bottom);
    ctx.stroke();

    // Draw y-axis labels
    ctx.font = '12px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'right';

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = margin.top + (chartHeight / yTicks) * (yTicks - i);
      const value = minY + ((maxY - minY) / yTicks) * i;

      ctx.fillText(value.toFixed(1), margin.left - 10, y + 4);

      // Grid line
      ctx.strokeStyle = '#ddd';
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
    }

    // Plot PM2.5 data
    if (pm25Data.length > 0) {
      ctx.strokeStyle = '#007bff';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const timeMin = new Date(Math.min(...pm25Data.map(d => d.x)));
      const timeMax = new Date(Math.max(...pm25Data.map(d => d.x)));

      pm25Data.forEach((point, i) => {
        const x = margin.left + ((point.x - timeMin) / (timeMax - timeMin)) * chartWidth;
        const y = margin.top + chartHeight - ((point.y - minY) / (maxY - minY + yPadding * 2)) * chartHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Plot PM10 data
    if (pm10Data.length > 0) {
      ctx.strokeStyle = '#dc3545';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const timeMin = new Date(Math.min(...pm10Data.map(d => d.x)));
      const timeMax = new Date(Math.max(...pm10Data.map(d => d.x)));

      pm10Data.forEach((point, i) => {
        const x = margin.left + ((point.x - timeMin) / (timeMax - timeMin)) * chartWidth;
        const y = margin.top + chartHeight - ((point.y - minY) / (maxY - minY + yPadding * 2)) * chartHeight;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }

    // Draw legend
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.font = '12px Arial';

    // PM2.5 legend
    ctx.strokeStyle = '#007bff';
    ctx.beginPath();
    ctx.moveTo(margin.left + 10, height - margin.bottom + 20);
    ctx.lineTo(margin.left + 40, height - margin.bottom + 20);
    ctx.stroke();
    ctx.fillText('PM2.5', margin.left + 45, height - margin.bottom + 24);

    // PM10 legend
    ctx.strokeStyle = '#dc3545';
    ctx.beginPath();
    ctx.moveTo(margin.left + 100, height - margin.bottom + 20);
    ctx.lineTo(margin.left + 130, height - margin.bottom + 20);
    ctx.stroke();
    ctx.fillText('PM10', margin.left + 135, height - margin.bottom + 24);

    // Write the file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    return {
      success: true,
      path: outputPath,
      description: `Time series chart of PM2.5 and PM10 values. Data points: ${pm25Data.length + pm10Data.length}`
    };
  } catch (error) {
    console.error('Error creating time series chart:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  createTimeSeriesChart
};
