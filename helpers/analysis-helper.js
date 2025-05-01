/**
 * Analysis Helper
 * Provides statistical analysis functions for air quality data
 */

/**
 * Calculate statistics for a dataset
 * @param {Array} data - Array of data points
 * @returns {Object} Statistical metrics
 */
function calculateStatistics(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      success: false,
      error: 'No data available for analysis'
    };
  }

  try {
    // Extract values
    const pm25Values = data.map(item => parseFloat(item.pm25 || item.field3)).filter(val => !isNaN(val));
    const pm10Values = data.map(item => parseFloat(item.pm10 || item.field4)).filter(val => !isNaN(val));
    const tempValues = data.map(item => parseFloat(item.temperature || item.field2)).filter(val => !isNaN(val));
    const humidityValues = data.map(item => parseFloat(item.humidity || item.field1)).filter(val => !isNaN(val));

    // Calculate averages
    const calcStats = (values) => {
      if (values.length === 0) return null;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const average = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      // Calculate standard deviation
      const squareDiffs = values.map(val => Math.pow(val - average, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(avgSquareDiff);
      
      return {
        average: average.toFixed(2),
        min: min.toFixed(2),
        max: max.toFixed(2),
        stdDev: stdDev.toFixed(2),
        count: values.length
      };
    };

    // Get statistics
    const pm25Stats = calcStats(pm25Values);
    const pm10Stats = calcStats(pm10Values);
    const tempStats = calcStats(tempValues);
    const humidityStats = calcStats(humidityValues);

    // Calculate AQI if possible
    let aqi = null;
    let aqiCategory = '';

    if (pm25Stats) {
      const avgPM25 = parseFloat(pm25Stats.average);
      aqi = calculateAQI(avgPM25);
      aqiCategory = getAQICategory(aqi);
    }

    // Calculate completeness
    const totalExpectedPoints = data.length * 4; // 4 parameters
    const actualDataPoints = (pm25Values.length + pm10Values.length + tempValues.length + humidityValues.length);
    const completeness = Math.round((actualDataPoints / totalExpectedPoints) * 100);

    return {
      success: true,
      dataPoints: data.length,
      timeRange: {
        start: data[data.length - 1]?.created_at,
        end: data[0]?.created_at
      },
      completeness,
      averages: {
        pm25: pm25Stats?.average || 'N/A',
        pm10: pm10Stats?.average || 'N/A',
        temperature: tempStats?.average || 'N/A',
        humidity: humidityStats?.average || 'N/A'
      },
      min: {
        pm25: pm25Stats?.min || 'N/A',
        pm10: pm10Stats?.min || 'N/A',
        temperature: tempStats?.min || 'N/A',
        humidity: humidityStats?.min || 'N/A'
      },
      max: {
        pm25: pm25Stats?.max || 'N/A',
        pm10: pm10Stats?.max || 'N/A',
        temperature: tempStats?.max || 'N/A',
        humidity: humidityStats?.max || 'N/A'
      },
      stdDev: {
        pm25: pm25Stats?.stdDev || 'N/A',
        pm10: pm10Stats?.stdDev || 'N/A',
        temperature: tempStats?.stdDev || 'N/A',
        humidity: humidityStats?.stdDev || 'N/A'
      },
      aqi: aqi,
      aqiCategory: aqiCategory,
      dataAvailability: {
        pm25: pm25Values.length,
        pm10: pm10Values.length,
        temperature: tempValues.length,
        humidity: humidityValues.length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Analysis error: ${error.message}`
    };
  }
}

/**
 * Calculate Air Quality Index based on PM2.5
 * @param {number} pm25 - PM2.5 value in μg/m³
 * @returns {number} AQI value
 */
function calculateAQI(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) {
    return null;
  }
  
  // EPA AQI breakpoints for PM2.5
  const breakpoints = [
    { min: 0, max: 12.0, aqiMin: 0, aqiMax: 50 },
    { min: 12.1, max: 35.4, aqiMin: 51, aqiMax: 100 },
    { min: 35.5, max: 55.4, aqiMin: 101, aqiMax: 150 },
    { min: 55.5, max: 150.4, aqiMin: 151, aqiMax: 200 },
    { min: 150.5, max: 250.4, aqiMin: 201, aqiMax: 300 },
    { min: 250.5, max: 500.4, aqiMin: 301, aqiMax: 500 }
  ];
  
  // Find the appropriate breakpoint
  for (const bp of breakpoints) {
    if (pm25 >= bp.min && pm25 <= bp.max) {
      // Linear interpolation
      return Math.round(
        ((bp.aqiMax - bp.aqiMin) / (bp.max - bp.min)) * (pm25 - bp.min) + bp.aqiMin
      );
    }
  }
  
  // If above highest breakpoint
  if (pm25 > 500.4) {
    return 500;
  }
  
  return null;
}

/**
 * Get AQI category description
 * @param {number} aqi - AQI value
 * @returns {string} AQI category description
 */
function getAQICategory(aqi) {
  if (aqi === null || aqi === undefined) return 'Unknown';
  
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Detect outliers in the dataset using IQR method
 * @param {Array} data - Array of data points 
 * @returns {Object} Outlier information
 */
function detectOutliers(data) {
  // ...existing code...
}

/**
 * Calculate trends in the data
 * @param {Array} data - Array of data points
 * @returns {Object} Trend information
 */
function calculateTrends(data) {
  // ...existing code...
}

module.exports = {
  calculateStatistics,
  calculateAQI,
  getAQICategory,
  detectOutliers,
  calculateTrends
};
