/**
 * Data Processing Service
 * Handles data aggregation, filtering, calculations, and transformations
 */
const NodeCache = require('node-cache');

// Try to import debug helper
let debugHelper;
try {
  debugHelper = require('../helpers/debug-helper');
} catch (e) {
  debugHelper = {
    log: (msg, context = 'data-processing-service', level = 'info') => console.log(`[${context}] ${msg}`),
    error: (msg, context = 'data-processing-service') => console.error(`[${context}] ${msg}`)
  };
}

class DataProcessingService {
  constructor() {
    this.config = {
      // Air quality thresholds (WHO guidelines)
      thresholds: {
        pm25: {
          good: 10,
          moderate: 25,
          unhealthy_sensitive: 50,
          unhealthy: 75,
          very_unhealthy: 150,
          hazardous: 250
        },
        pm10: {
          good: 20,
          moderate: 50,
          unhealthy_sensitive: 100,
          unhealthy: 150,
          very_unhealthy: 250,
          hazardous: 350
        },
        temperature: {
          very_cold: -10,
          cold: 0,
          cool: 15,
          comfortable_min: 18,
          comfortable_max: 24,
          warm: 30,
          hot: 35,
          very_hot: 40
        },
        humidity: {
          very_dry: 30,
          dry: 40,
          comfortable_min: 40,
          comfortable_max: 60,
          humid: 70,
          very_humid: 80
        }
      },
      // Data validation ranges
      validRanges: {
        temperature: { min: -40, max: 60 },
        humidity: { min: 0, max: 100 },
        pm25: { min: 0, max: 1000 },
        pm10: { min: 0, max: 2000 }
      },
      // Calculation settings
      aggregation: {
        defaultPeriod: '1h', // 1 hour
        periods: ['15m', '1h', '6h', '12h', '24h', '7d'],
        maxDataPoints: 10000
      }
    };

    // Cache for processed data
    this.cache = new NodeCache({ 
      stdTTL: 300, // 5 minutes
      checkperiod: 60,
      useClones: false
    });

    // Processing stats
    this.stats = {
      processedCount: 0,
      aggregationCount: 0,
      validationErrors: 0,
      lastProcessing: null,
      processingTime: []
    };

    debugHelper.log('Data Processing Service initialized');
  }

  /**
   * Process and validate raw sensor data
   * @param {Array} rawData - Raw data array from sensors
   * @returns {Object} Processed data with validation results
   */
  processRawData(rawData) {
    const startTime = Date.now();
    
    try {
      if (!Array.isArray(rawData)) {
        throw new Error('Invalid data format: expected array');
      }

      const processed = rawData.map(entry => this.processDataEntry(entry));
      const validEntries = processed.filter(entry => entry.valid);
      const invalidEntries = processed.filter(entry => !entry.valid);

      const result = {
        success: true,
        data: validEntries,
        metadata: {
          total: rawData.length,
          valid: validEntries.length,
          invalid: invalidEntries.length,
          validationErrors: invalidEntries.map(e => ({
            timestamp: e.timestamp,
            errors: e.validationErrors
          }))
        },
        timestamp: new Date().toISOString()
      };

      // Update stats
      this.stats.processedCount += rawData.length;
      this.stats.validationErrors += invalidEntries.length;
      this.stats.lastProcessing = new Date();
      
      const processingTime = Date.now() - startTime;
      this.stats.processingTime.push(processingTime);
      if (this.stats.processingTime.length > 100) {
        this.stats.processingTime.shift();
      }

      debugHelper.log(`Processed ${rawData.length} entries (${validEntries.length} valid, ${invalidEntries.length} invalid)`);
      
      return result;
    } catch (error) {
      debugHelper.error(`Data processing failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Process ThingSpeak data - wrapper around processRawData for compatibility
   * @param {Array} thingspeakData - Array of ThingSpeak feed objects
   * @returns {Array} Processed data array
   */
  processThingSpeakData(thingspeakData) {
    try {
      if (!Array.isArray(thingspeakData)) {
        debugHelper.error('processThingSpeakData: Expected array input');
        return [];
      }

      if (thingspeakData.length === 0) {
        debugHelper.log('processThingSpeakData: Empty data array provided');
        return [];
      }

      // Process the data using existing processRawData method
      const result = this.processRawData(thingspeakData);
      
      if (result.success && result.data) {
        debugHelper.log(`processThingSpeakData: Successfully processed ${result.data.length} entries`);
        return result.data;
      } else {
        debugHelper.error(`processThingSpeakData: Processing failed - ${result.error || 'Unknown error'}`);
        return [];
      }
    } catch (error) {
      debugHelper.error(`processThingSpeakData error: ${error.message}`);
      return [];
    }
  }

  /**
   * Process a single data entry
   * @param {Object} entry - Single data entry
   * @returns {Object} Processed entry with validation
   */
  processDataEntry(entry) {
    const processed = {
      ...entry,
      valid: true,
      validationErrors: [],
      airQuality: {},
      comfort: {}
    };

    // Validate and process each field
    ['temperature', 'humidity', 'pm25', 'pm10'].forEach(field => {
      const value = this.parseNumericValue(entry[field]);
      
      if (value !== null) {
        // Validate range
        const range = this.config.validRanges[field];
        if (range && (value < range.min || value > range.max)) {
          processed.validationErrors.push(`${field} out of valid range (${range.min}-${range.max}): ${value}`);
          processed.valid = false;
        } else {
          processed[field] = value;
          
          // Add quality classifications
          if (field === 'pm25' || field === 'pm10') {
            processed.airQuality[field] = this.classifyAirQuality(value, field);
          } else if (field === 'temperature' || field === 'humidity') {
            processed.comfort[field] = this.classifyComfort(value, field);
          }
        }
      } else if (entry[field] !== null && entry[field] !== undefined) {
        processed.validationErrors.push(`Invalid ${field} value: ${entry[field]}`);
      }
    });

    // Calculate overall air quality index
    if (processed.pm25 !== null || processed.pm10 !== null) {
      processed.airQuality.overall = this.calculateOverallAQI(processed);
    }

    // Calculate comfort index
    if (processed.temperature !== null && processed.humidity !== null) {
      processed.comfort.overall = this.calculateComfortIndex(processed.temperature, processed.humidity);
    }

    return processed;
  }

  /**
   * Parse numeric value with error handling
   * @param {*} value - Value to parse
   * @returns {number|null} Parsed number or null
   */
  parseNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Classify air quality based on WHO standards
   * @param {number} value - Pollutant value
   * @param {string} pollutant - Pollutant type (pm25, pm10)
   * @returns {Object} Classification result
   */
  classifyAirQuality(value, pollutant) {
    const thresholds = this.config.thresholds[pollutant];
    
    if (!thresholds) {
      return { level: 'unknown', description: 'Unknown pollutant', color: '#999999' };
    }

    if (value <= thresholds.good) {
      return { level: 'good', description: 'Good', color: '#00e400', aqi: 1 };
    } else if (value <= thresholds.moderate) {
      return { level: 'moderate', description: 'Moderate', color: '#ffff00', aqi: 2 };
    } else if (value <= thresholds.unhealthy_sensitive) {
      return { level: 'unhealthy_sensitive', description: 'Unhealthy for Sensitive Groups', color: '#ff7e00', aqi: 3 };
    } else if (value <= thresholds.unhealthy) {
      return { level: 'unhealthy', description: 'Unhealthy', color: '#ff0000', aqi: 4 };
    } else if (value <= thresholds.very_unhealthy) {
      return { level: 'very_unhealthy', description: 'Very Unhealthy', color: '#8f3f97', aqi: 5 };
    } else {
      return { level: 'hazardous', description: 'Hazardous', color: '#7e0023', aqi: 6 };
    }
  }

  /**
   * Classify comfort level for temperature and humidity
   * @param {number} value - Sensor value
   * @param {string} type - Sensor type (temperature, humidity)
   * @returns {Object} Comfort classification
   */
  classifyComfort(value, type) {
    const thresholds = this.config.thresholds[type];
    
    if (!thresholds) {
      return { level: 'unknown', description: 'Unknown parameter' };
    }

    if (type === 'temperature') {
      if (value < thresholds.very_cold) {
        return { level: 'very_cold', description: 'Very Cold', comfort: 1 };
      } else if (value < thresholds.cold) {
        return { level: 'cold', description: 'Cold', comfort: 2 };
      } else if (value < thresholds.cool) {
        return { level: 'cool', description: 'Cool', comfort: 3 };
      } else if (value >= thresholds.comfortable_min && value <= thresholds.comfortable_max) {
        return { level: 'comfortable', description: 'Comfortable', comfort: 5 };
      } else if (value <= thresholds.warm) {
        return { level: 'warm', description: 'Warm', comfort: 4 };
      } else if (value <= thresholds.hot) {
        return { level: 'hot', description: 'Hot', comfort: 2 };
      } else {
        return { level: 'very_hot', description: 'Very Hot', comfort: 1 };
      }
    } else if (type === 'humidity') {
      if (value < thresholds.very_dry) {
        return { level: 'very_dry', description: 'Very Dry', comfort: 2 };
      } else if (value < thresholds.dry) {
        return { level: 'dry', description: 'Dry', comfort: 3 };
      } else if (value >= thresholds.comfortable_min && value <= thresholds.comfortable_max) {
        return { level: 'comfortable', description: 'Comfortable', comfort: 5 };
      } else if (value <= thresholds.humid) {
        return { level: 'humid', description: 'Humid', comfort: 3 };
      } else {
        return { level: 'very_humid', description: 'Very Humid', comfort: 2 };
      }
    }
  }

  /**
   * Calculate overall Air Quality Index
   * @param {Object} data - Data entry with PM values
   * @returns {Object} Overall AQI classification
   */
  calculateOverallAQI(data) {
    let maxAQI = 0;
    let dominantPollutant = null;

    if (data.pm25 !== null && data.airQuality.pm25) {
      if (data.airQuality.pm25.aqi > maxAQI) {
        maxAQI = data.airQuality.pm25.aqi;
        dominantPollutant = 'PM2.5';
      }
    }

    if (data.pm10 !== null && data.airQuality.pm10) {
      if (data.airQuality.pm10.aqi > maxAQI) {
        maxAQI = data.airQuality.pm10.aqi;
        dominantPollutant = 'PM10';
      }
    }

    // Get classification based on max AQI
    const levels = ['good', 'moderate', 'unhealthy_sensitive', 'unhealthy', 'very_unhealthy', 'hazardous'];
    const level = levels[maxAQI - 1] || 'unknown';

    return {
      aqi: maxAQI,
      level,
      dominantPollutant,
      ...this.classifyAirQuality(maxAQI * 25, 'pm25') // Approximate mapping
    };
  }

  /**
   * Calculate comfort index based on temperature and humidity
   * @param {number} temperature - Temperature value
   * @param {number} humidity - Humidity value
   * @returns {Object} Comfort index
   */
  calculateComfortIndex(temperature, humidity) {
    // Simple comfort calculation based on both parameters
    const tempComfort = this.classifyComfort(temperature, 'temperature').comfort || 3;
    const humidityComfort = this.classifyComfort(humidity, 'humidity').comfort || 3;
    
    // Average comfort score
    const overallComfort = (tempComfort + humidityComfort) / 2;
    
    let level, description;
    if (overallComfort >= 4.5) {
      level = 'very_comfortable';
      description = 'Very Comfortable';
    } else if (overallComfort >= 3.5) {
      level = 'comfortable';
      description = 'Comfortable';
    } else if (overallComfort >= 2.5) {
      level = 'moderate';
      description = 'Moderate';
    } else if (overallComfort >= 1.5) {
      level = 'uncomfortable';
      description = 'Uncomfortable';
    } else {
      level = 'very_uncomfortable';
      description = 'Very Uncomfortable';
    }

    return {
      score: Math.round(overallComfort * 10) / 10,
      level,
      description,
      factors: {
        temperature: tempComfort,
        humidity: humidityComfort
      }
    };
  }

  /**
   * Aggregate data over time periods
   * @param {Array} data - Data array to aggregate
   * @param {string} period - Aggregation period (15m, 1h, 6h, 12h, 24h, 7d)
   * @returns {Object} Aggregated data
   */
  aggregateData(data, period = '1h') {
    const cacheKey = `aggregated-${period}-${data.length}-${this.generateDataHash(data)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      debugHelper.log(`Returning cached aggregated data for period: ${period}`);
      return cached;
    }

    const startTime = Date.now();

    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid or empty data array');
      }

      // Parse period to minutes
      const periodMinutes = this.parsePeriodToMinutes(period);
      if (!periodMinutes) {
        throw new Error(`Invalid aggregation period: ${period}`);
      }

      // Group data by time intervals
      const groups = this.groupDataByInterval(data, periodMinutes);
      
      // Calculate aggregations for each group
      const aggregated = Object.keys(groups).map(timestamp => {
        const groupData = groups[timestamp];
        return this.calculateAggregation(groupData, new Date(parseInt(timestamp)));
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      const result = {
        success: true,
        data: aggregated,
        metadata: {
          period,
          periodMinutes,
          originalCount: data.length,
          aggregatedCount: aggregated.length,
          aggregationType: 'average_with_stats'
        },
        timestamp: new Date().toISOString()
      };

      // Update stats
      this.stats.aggregationCount++;
      
      const processingTime = Date.now() - startTime;
      debugHelper.log(`Aggregated ${data.length} entries into ${aggregated.length} ${period} intervals (${processingTime}ms)`);

      // Cache result
      this.cache.set(cacheKey, result, 600); // 10 minutes

      return result;
    } catch (error) {
      debugHelper.error(`Data aggregation failed: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Parse period string to minutes
   * @param {string} period - Period string (e.g., '15m', '1h', '24h', '7d')
   * @returns {number|null} Minutes or null if invalid
   */
  parsePeriodToMinutes(period) {
    const match = period.match(/^(\d+)([mhd])$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm': return value;
      case 'h': return value * 60;
      case 'd': return value * 60 * 24;
      default: return null;
    }
  }

  /**
   * Group data by time intervals
   * @param {Array} data - Data to group
   * @param {number} intervalMinutes - Interval in minutes
   * @returns {Object} Grouped data
   */
  groupDataByInterval(data, intervalMinutes) {
    const groups = {};
    const intervalMs = intervalMinutes * 60 * 1000;

    data.forEach(entry => {
      const timestamp = new Date(entry.timestamp || entry.created_at);
      if (isNaN(timestamp.getTime())) return; // Skip invalid timestamps

      // Round timestamp down to interval boundary
      const intervalStart = Math.floor(timestamp.getTime() / intervalMs) * intervalMs;
      
      if (!groups[intervalStart]) {
        groups[intervalStart] = [];
      }
      
      groups[intervalStart].push(entry);
    });

    return groups;
  }

  /**
   * Calculate aggregation statistics for a group of data
   * @param {Array} groupData - Data points in the group
   * @param {Date} timestamp - Group timestamp
   * @returns {Object} Aggregated statistics
   */
  calculateAggregation(groupData, timestamp) {
    const fields = ['temperature', 'humidity', 'pm25', 'pm10'];
    const aggregated = {
      timestamp: timestamp.toISOString(),
      count: groupData.length
    };

    fields.forEach(field => {
      const values = groupData
        .map(entry => this.parseNumericValue(entry[field]))
        .filter(val => val !== null);

      if (values.length > 0) {
        const sorted = values.sort((a, b) => a - b);
        
        aggregated[field] = {
          avg: this.round(values.reduce((sum, val) => sum + val, 0) / values.length, 2),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          median: this.calculateMedian(sorted),
          count: values.length,
          // Add percentiles for air quality data
          ...(field.includes('pm') && {
            p75: this.calculatePercentile(sorted, 75),
            p90: this.calculatePercentile(sorted, 90)
          })
        };
      } else {
        aggregated[field] = null;
      }
    });

    // Add air quality classification based on averages
    if (aggregated.pm25 && aggregated.pm25.avg !== null) {
      aggregated.airQuality = {
        pm25: this.classifyAirQuality(aggregated.pm25.avg, 'pm25')
      };
    }
    
    if (aggregated.pm10 && aggregated.pm10.avg !== null) {
      if (!aggregated.airQuality) aggregated.airQuality = {};
      aggregated.airQuality.pm10 = this.classifyAirQuality(aggregated.pm10.avg, 'pm10');
    }

    return aggregated;
  }

  /**
   * Calculate median value
   * @param {Array} sortedValues - Sorted array of values
   * @returns {number} Median value
   */
  calculateMedian(sortedValues) {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  /**
   * Calculate percentile
   * @param {Array} sortedValues - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  calculatePercentile(sortedValues, percentile) {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    
    if (lower === upper) {
      return sortedValues[lower];
    }
    
    const weight = index - lower;
    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Round number to specified decimal places
   * @param {number} num - Number to round
   * @param {number} decimals - Decimal places
   * @returns {number} Rounded number
   */
  round(num, decimals) {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  /**
   * Generate simple hash for data array (for caching)
   * @param {Array} data - Data array
   * @returns {string} Hash string
   */
  generateDataHash(data) {
    const hashData = {
      length: data.length,
      first: data[0]?.timestamp || data[0]?.created_at,
      last: data[data.length - 1]?.timestamp || data[data.length - 1]?.created_at
    };
    return Buffer.from(JSON.stringify(hashData)).toString('base64').slice(0, 10);
  }

  /**
   * Get processing statistics
   * @returns {Object} Processing statistics
   */
  getStats() {
    const avgProcessingTime = this.stats.processingTime.length > 0
      ? this.stats.processingTime.reduce((sum, time) => sum + time, 0) / this.stats.processingTime.length
      : 0;

    return {
      ...this.stats,
      avgProcessingTime: Math.round(avgProcessingTime * 100) / 100,
      cacheStats: this.cache.getStats()
    };
  }

  /**
   * Clear processing cache
   */
  clearCache() {
    this.cache.flushAll();
    debugHelper.log('Data processing cache cleared');
  }

  /**
   * Update processing configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    if (newConfig && typeof newConfig === 'object') {
      this.config = {
        ...this.config,
        ...newConfig,
        // Merge nested objects properly
        thresholds: newConfig.thresholds ? {
          ...this.config.thresholds,
          ...newConfig.thresholds
        } : this.config.thresholds,
        validRanges: newConfig.validRanges ? {
          ...this.config.validRanges,
          ...newConfig.validRanges
        } : this.config.validRanges
      };
      
      debugHelper.log('Data processing configuration updated');
      return true;
    }
    return false;
  }

  /**
   * Merge new data with existing historical data
   * @param {Array} existingData - Existing historical data
   * @param {Array} newData - New data to merge
   * @returns {Array} Merged and deduplicated data array
   */
  mergeData(existingData, newData) {
    try {
      if (!Array.isArray(existingData)) existingData = [];
      if (!Array.isArray(newData)) newData = [];

      if (newData.length === 0) {
        debugHelper.log('mergeData: No new data to merge');
        return existingData;
      }

      // Combine arrays
      const combined = [...existingData, ...newData];
      
      // Remove duplicates based on entry_id and created_at
      const uniqueData = combined.filter((item, index, arr) => {
        return index === arr.findIndex(t => 
          (t.entry_id && t.entry_id === item.entry_id) ||
          (t.created_at && t.created_at === item.created_at)
        );
      });

      // Sort by timestamp (newest first)
      const sortedData = uniqueData.sort((a, b) => {
        const dateA = new Date(a.created_at || a.timestamp);
        const dateB = new Date(b.created_at || b.timestamp);
        return dateB - dateA;
      });

      debugHelper.log(`mergeData: Merged ${existingData.length} + ${newData.length} = ${sortedData.length} unique entries`);
      return sortedData;
    } catch (error) {
      debugHelper.error(`mergeData error: ${error.message}`);
      return existingData;
    }
  }

  /**
   * Save processed data to CSV file
   * @param {Array} data - Data array to save
   * @returns {Promise<boolean>} Success status
   */
  async saveDataToCsv(data) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        debugHelper.log('saveDataToCsv: No data to save');
        return false;
      }

      const fs = require('fs');
      const path = require('path');
      const createCsvWriter = require('csv-writer').createObjectCsvWriter;

      const csvPath = path.join(process.cwd(), 'data', 'feeds_updated.csv');
      
      // Ensure directory exists
      if (!fs.existsSync(path.dirname(csvPath))) {
        fs.mkdirSync(path.dirname(csvPath), { recursive: true });
      }

      const csvWriter = createCsvWriter({
        path: csvPath,
        header: [
          { id: 'created_at', title: 'created_at' },
          { id: 'entry_id', title: 'entry_id' },
          { id: 'humidity', title: 'field1' },
          { id: 'temperature', title: 'field2' },
          { id: 'pm25', title: 'field3' },
          { id: 'pm10', title: 'field4' }
        ]
      });

      // Prepare data for CSV (ensure all required fields exist)
      const csvData = data.map(entry => ({
        created_at: entry.created_at || entry.timestamp || new Date().toISOString(),
        entry_id: entry.entry_id || '',
        humidity: entry.humidity || entry.field1 || '',
        temperature: entry.temperature || entry.field2 || '',
        pm25: entry.pm25 || entry.field3 || '',
        pm10: entry.pm10 || entry.field4 || ''
      }));

      await csvWriter.writeRecords(csvData);
      debugHelper.log(`saveDataToCsv: Saved ${csvData.length} records to ${csvPath}`);
      return true;
    } catch (error) {
      debugHelper.error(`saveDataToCsv error: ${error.message}`);
      return false;
    }
  }
}

// Create and export instance
const dataProcessingServiceInstance = new DataProcessingService();
module.exports = dataProcessingServiceInstance;
