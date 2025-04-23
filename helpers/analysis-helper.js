/**
 * Analysis Helper - Performs data analysis on air quality data
 * Replaces Python analysis scripts with JavaScript implementation
 */
const path = require('path');
const fs = require('fs');
const debug = require('../helpers/debug-helper');

/**
 * Helper for statistical analysis of air quality data
 */
let stats;
try {
  stats = require('simple-statistics');
} catch (error) {
  console.warn('Warning: simple-statistics module not available. Using fallback statistics implementation.');
  // Basic fallback implementations for required functions
  stats = {
    mean: (array) => array.reduce((sum, val) => sum + val, 0) / array.length,
    median: (array) => {
      const sorted = [...array].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 
        ? (sorted[mid - 1] + sorted[mid]) / 2 
        : sorted[mid];
    },
    quantile: (array, p) => {
      // Simple implementation of quantile
      const sorted = [...array].sort((a, b) => a - b);
      const idx = Math.floor(sorted.length * p);
      return sorted[idx];
    },
    standardDeviation: (array) => {
      const avg = array.reduce((sum, val) => sum + val, 0) / array.length;
      const squareDiffs = array.map(value => Math.pow(value - avg, 2));
      const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / array.length;
      return Math.sqrt(avgSquareDiff);
    },
    // Add correlation function since it's used below
    sampleCorrelation: (array1, array2) => {
      if (array1.length !== array2.length || array1.length === 0) {
        return 0;
      }
      
      const n = array1.length;
      const mean1 = array1.reduce((sum, val) => sum + val, 0) / n;
      const mean2 = array2.reduce((sum, val) => sum + val, 0) / n;
      
      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;
      
      for (let i = 0; i < n; i++) {
        const diff1 = array1[i] - mean1;
        const diff2 = array2[i] - mean2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }
      
      return numerator / Math.sqrt(denom1 * denom2);
    },
    // Additional basic implementations as needed
    linearRegression: (data) => {
      // Super simplified linear regression for trend analysis
      const n = data.length;
      if (n <= 1) return { slope: 0, intercept: 0 };
      
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
      for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += data[i];
        sumXY += i * data[i];
        sumX2 += i * i;
      }
      
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      return { slope, intercept };
    }
  };
}

/**
 * Calculate basic statistics for air quality data
 * @param {Array} data - Array of data points
 * @param {Object} options - Analysis options
 * @returns {Object} Statistical analysis results
 */
function calculateStatistics(data, options = {}) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      average_pm25: 0,
      average_pm10: 0,
      average_temperature: 0,
      average_humidity: 0,
      max_pm25: 0,
      max_pm10: 0,
      min_pm25: 0,
      min_pm10: 0,
      count: 0,
      source: 'js-analysis',
      error: 'No data available for analysis'
    };
  }

  try {
    // Extract arrays of each measurement type
    const pm25Values = data
      .map(item => parseFloat(item.pm25 || item.field3))
      .filter(val => !isNaN(val) && val !== null);
      
    const pm10Values = data
      .map(item => parseFloat(item.pm10 || item.field4))
      .filter(val => !isNaN(val) && val !== null);
      
    const tempValues = data
      .map(item => parseFloat(item.temperature || item.field2))
      .filter(val => !isNaN(val) && val !== null);
      
    const humidityValues = data
      .map(item => parseFloat(item.humidity || item.field1))
      .filter(val => !isNaN(val) && val !== null);

    // Calculate statistics
    const results = {
      average_pm25: pm25Values.length > 0 ? stats.mean(pm25Values) : 0,
      average_pm10: pm10Values.length > 0 ? stats.mean(pm10Values) : 0,
      average_temperature: tempValues.length > 0 ? stats.mean(tempValues) : 0,
      average_humidity: humidityValues.length > 0 ? stats.mean(humidityValues) : 0,
      max_pm25: pm25Values.length > 0 ? Math.max(...pm25Values) : 0,
      max_pm10: pm10Values.length > 0 ? Math.max(...pm10Values) : 0,
      min_pm25: pm25Values.length > 0 ? Math.min(...pm25Values) : 0,
      min_pm10: pm10Values.length > 0 ? Math.min(...pm10Values) : 0,
      count: data.length,
      source: 'js-analysis'
    };

    // Add additional statistics for extended analysis if requested
    if (options.extended) {
      results.median_pm25 = pm25Values.length > 0 ? stats.median(pm25Values) : 0;
      results.median_pm10 = pm10Values.length > 0 ? stats.median(pm10Values) : 0;
      results.stddev_pm25 = pm25Values.length > 0 ? stats.standardDeviation(pm25Values) : 0;
      results.stddev_pm10 = pm10Values.length > 0 ? stats.standardDeviation(pm10Values) : 0;
      
      // Calculate percentiles for PM2.5
      if (pm25Values.length > 0) {
        results.percentile_25_pm25 = stats.quantile(pm25Values, 0.25);
        results.percentile_75_pm25 = stats.quantile(pm25Values, 0.75);
        results.percentile_90_pm25 = stats.quantile(pm25Values, 0.90);
      }
      
      // Calculate percentiles for PM10
      if (pm10Values.length > 0) {
        results.percentile_25_pm10 = stats.quantile(pm10Values, 0.25);
        results.percentile_75_pm10 = stats.quantile(pm10Values, 0.75);
        results.percentile_90_pm10 = stats.quantile(pm10Values, 0.90);
      }
    }

    return results;
  } catch (error) {
    console.error('Error calculating statistics:', error);
    debug.log(`Analysis error: ${error.message}`, 'analysis-helper');
    
    return {
      average_pm25: 0,
      average_pm10: 0,
      average_temperature: 0,
      average_humidity: 0,
      max_pm25: 0,
      max_pm10: 0,
      min_pm25: 0,
      min_pm10: 0,
      count: data.length,
      source: 'js-analysis',
      error: error.message
    };
  }
}

/**
 * Perform seasonal analysis on air quality data
 * @param {Array} data - Data array
 * @returns {Object} - Seasonal analysis results
 */
function performSeasonalAnalysis(data) {
  try {
    // Group data by season
    const seasonalData = {
      winter: { pm25: [], pm10: [], temp: [], humidity: [] },
      spring: { pm25: [], pm10: [], temp: [], humidity: [] },
      summer: { pm25: [], pm10: [], temp: [], humidity: [] },
      fall: { pm25: [], pm10: [], temp: [], humidity: [] }
    };
    
    // Process each data point
    data.forEach(entry => {
      const date = new Date(entry.created_at);
      const month = date.getMonth();
      let season;
      
      // Determine season from month
      if (month >= 2 && month <= 4) season = 'spring';
      else if (month >= 5 && month <= 7) season = 'summer';
      else if (month >= 8 && month <= 10) season = 'fall';
      else season = 'winter';
      
      // Extract values with fallbacks
      const pm25 = parseFloat(entry.pm25 || entry.field3) || 0;
      const pm10 = parseFloat(entry.pm10 || entry.field4) || 0;
      const temp = parseFloat(entry.temperature || entry.field2) || 0;
      const humidity = parseFloat(entry.humidity || entry.field1) || 0;
      
      // Add to relevant season
      seasonalData[season].pm25.push(pm25);
      seasonalData[season].pm10.push(pm10);
      seasonalData[season].temp.push(temp);
      seasonalData[season].humidity.push(humidity);
    });
    
    // Calculate averages for each season
    const result = {};
    
    for (const [season, values] of Object.entries(seasonalData)) {
      result[season] = {
        pm25: calculateAverage(values.pm25),
        pm10: calculateAverage(values.pm10),
        temperature: calculateAverage(values.temp),
        humidity: calculateAverage(values.humidity),
        count: values.pm25.length
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in seasonal analysis:', error);
    return {};
  }
}

/**
 * Perform weekly comparison analysis
 * @param {Array} data - Data array
 * @returns {Object} - Weekly comparison results
 */
function performWeeklyComparison(data) {
  try {
    // Group data by day of week (0-6, where 0 is Sunday)
    const weekdayData = {
      0: { pm25: [], pm10: [], temp: [], humidity: [] }, // Sunday
      1: { pm25: [], pm10: [], temp: [], humidity: [] },
      2: { pm25: [], pm10: [], temp: [], humidity: [] },
      3: { pm25: [], pm10: [], temp: [], humidity: [] },
      4: { pm25: [], pm10: [], temp: [], humidity: [] },
      5: { pm25: [], pm10: [], temp: [], humidity: [] },
      6: { pm25: [], pm10: [], temp: [], humidity: [] }  // Saturday
    };
    
    // Process each data point
    data.forEach(entry => {
      const date = new Date(entry.created_at);
      const dayOfWeek = date.getDay(); // 0-6
      
      // Extract values with fallbacks
      const pm25 = parseFloat(entry.pm25 || entry.field3) || 0;
      const pm10 = parseFloat(entry.pm10 || entry.field4) || 0;
      const temp = parseFloat(entry.temperature || entry.field2) || 0;
      const humidity = parseFloat(entry.humidity || entry.field1) || 0;
      
      // Add to relevant day
      weekdayData[dayOfWeek].pm25.push(pm25);
      weekdayData[dayOfWeek].pm10.push(pm10);
      weekdayData[dayOfWeek].temp.push(temp);
      weekdayData[dayOfWeek].humidity.push(humidity);
    });
    
    // Calculate hourly averages for each day
    const result = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    for (let day = 0; day < 7; day++) {
      const values = weekdayData[day];
      const hourlyData = calculateHourlyAverages(data, day);
      
      result[dayNames[day]] = {
        pm25: calculateAverage(values.pm25),
        pm10: calculateAverage(values.pm10),
        temperature: calculateAverage(values.temp),
        humidity: calculateAverage(values.humidity),
        hourly: hourlyData,
        count: values.pm25.length
      };
    }
    
    return result;
  } catch (error) {
    console.error('Error in weekly comparison:', error);
    return {};
  }
}

/**
 * Calculate hourly averages for a specific day of week
 * @param {Array} data - Data array
 * @param {Number} dayOfWeek - Day of week (0-6)
 * @returns {Array} - Hourly averages
 */
function calculateHourlyAverages(data, dayOfWeek) {
  // Initialize arrays for each hour
  const hours = Array(24).fill().map(() => ({
    pm25: [],
    pm10: [],
    temp: [],
    humidity: []
  }));
  
  // Group data by hour
  data.forEach(entry => {
    const date = new Date(entry.created_at);
    if (date.getDay() !== dayOfWeek) return;
    
    const hour = date.getHours();
    
    const pm25 = parseFloat(entry.pm25 || entry.field3) || 0;
    const pm10 = parseFloat(entry.pm10 || entry.field4) || 0;
    const temp = parseFloat(entry.temperature || entry.field2) || 0;
    const humidity = parseFloat(entry.humidity || entry.field1) || 0;
    
    hours[hour].pm25.push(pm25);
    hours[hour].pm10.push(pm10);
    hours[hour].temp.push(temp);
    hours[hour].humidity.push(humidity);
  });
  
  // Calculate averages for each hour
  return hours.map((hourData, hour) => ({
    hour,
    pm25: calculateAverage(hourData.pm25),
    pm10: calculateAverage(hourData.pm10),
    temperature: calculateAverage(hourData.temp),
    humidity: calculateAverage(hourData.humidity)
  }));
}

/**
 * Calculate average of an array of numbers
 * @param {Array} array - Array of numbers
 * @returns {Number} - Average value
 */
function calculateAverage(array) {
  if (!array.length) return 0;
  const sum = array.reduce((a, b) => a + b, 0);
  return parseFloat((sum / array.length).toFixed(2));
}

/**
 * Calculate correlation matrix between different measurements
 * @param {Array} data - Array of data points
 * @returns {Object} Correlation matrix
 */
function calculateCorrelation(data) {
  if (!data || !Array.isArray(data) || data.length < 2) {
    return {
      correlation_matrix: {},
      error: 'Insufficient data for correlation analysis'
    };
  }

  try {
    // Extract arrays of each measurement type
    const pm25Values = data
      .map(item => parseFloat(item.pm25 || item.field3))
      .filter(val => !isNaN(val) && val !== null);
      
    const pm10Values = data
      .map(item => parseFloat(item.pm10 || item.field4))
      .filter(val => !isNaN(val) && val !== null);
      
    const tempValues = data
      .map(item => parseFloat(item.temperature || item.field2))
      .filter(val => !isNaN(val) && val !== null);
      
    const humidityValues = data
      .map(item => parseFloat(item.humidity || item.field1))
      .filter(val => !isNaN(val) && val !== null);

    // Get the minimum length of all arrays to ensure we only compare matching pairs
    const minLength = Math.min(
      pm25Values.length,
      pm10Values.length,
      tempValues.length,
      humidityValues.length
    );

    if (minLength < 2) {
      return {
        correlation_matrix: {},
        error: 'Insufficient matching data points for correlation'
      };
    }

    // Trim arrays to the same length
    const pm25 = pm25Values.slice(0, minLength);
    const pm10 = pm10Values.slice(0, minLength);
    const temp = tempValues.slice(0, minLength);
    const humidity = humidityValues.slice(0, minLength);

    // Calculate correlations
    const correlation_matrix = {
      'PM2.5_PM10': stats.sampleCorrelation(pm25, pm10),
      'PM2.5_Temperature': stats.sampleCorrelation(pm25, temp),
      'PM2.5_Humidity': stats.sampleCorrelation(pm25, humidity),
      'PM10_Temperature': stats.sampleCorrelation(pm10, temp),
      'PM10_Humidity': stats.sampleCorrelation(pm10, humidity),
      'Temperature_Humidity': stats.sampleCorrelation(temp, humidity)
    };

    return { correlation_matrix };
  } catch (error) {
    console.error('Error calculating correlation matrix:', error);
    debug.log(`Correlation analysis error: ${error.message}`, 'analysis-helper');
    
    return {
      correlation_matrix: {},
      error: error.message
    };
  }
}

/**
 * Calculate daily patterns in air quality data
 * @param {Array} data - Array of data points
 * @returns {Object} Daily patterns analysis
 */
function calculateDailyPatterns(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return {
      hourly_averages: {},
      error: 'No data available for daily pattern analysis'
    };
  }

  try {
    // Initialize arrays for each hour (0-23)
    const hourlyPm25 = Array(24).fill().map(() => []);
    const hourlyPm10 = Array(24).fill().map(() => []);
    
    // Group data by hour of day
    data.forEach(item => {
      const timestamp = new Date(item.created_at);
      if (isNaN(timestamp.getTime())) return;
      
      const hour = timestamp.getHours();
      const pm25 = parseFloat(item.pm25 || item.field3);
      const pm10 = parseFloat(item.pm10 || item.field4);
      
      if (!isNaN(pm25)) hourlyPm25[hour].push(pm25);
      if (!isNaN(pm10)) hourlyPm10[hour].push(pm10);
    });
    
    // Calculate hourly averages
    const hourly_averages = {
      pm25: hourlyPm25.map(values => values.length > 0 ? stats.mean(values) : null),
      pm10: hourlyPm10.map(values => values.length > 0 ? stats.mean(values) : null),
      hours: Array(24).fill().map((_, i) => i)
    };
    
    return { hourly_averages };
  } catch (error) {
    console.error('Error calculating daily patterns:', error);
    debug.log(`Daily pattern analysis error: ${error.message}`, 'analysis-helper');
    
    return {
      hourly_averages: {},
      error: error.message
    };
  }
}

/**
 * Process data for use in advanced analysis and visualizations
 * @param {Array} rawData - Raw data array
 * @returns {Object} Processed data ready for analysis
 */
function processDataForAnalysis(rawData) {
  if (!rawData || !Array.isArray(rawData)) {
    return { error: 'Invalid data format' };
  }

  try {
    // Create consistent data structure
    const processedData = rawData.map(item => {
      // Parse date if it exists
      let timestamp = null;
      try {
        timestamp = new Date(item.created_at);
        if (isNaN(timestamp.getTime())) timestamp = null;
      } catch (e) {
        timestamp = null;
      }
      
      return {
        timestamp,
        pm25: parseFloat(item.pm25 || item.field3) || null,
        pm10: parseFloat(item.pm10 || item.field4) || null,
        temperature: parseFloat(item.temperature || item.field2) || null,
        humidity: parseFloat(item.humidity || item.field1) || null,
        entry_id: parseInt(item.entry_id) || 0
      };
    }).filter(item => item.timestamp !== null); // Remove items with invalid dates
    
    // Sort by timestamp
    processedData.sort((a, b) => a.timestamp - b.timestamp);
    
    return { processedData };
  } catch (error) {
    console.error('Error processing data for analysis:', error);
    return { error: error.message };
  }
}

module.exports = {
  calculateStatistics,
  calculateCorrelation,
  calculateDailyPatterns,
  processDataForAnalysis,
  performSeasonalAnalysis,
  performWeeklyComparison
};
