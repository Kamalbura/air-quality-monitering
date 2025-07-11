/**
 * Data Preprocessing Utilities
 * Handles data cleaning, smoothing, and preparation for LSTM training
 */

const fs = require('fs');
const path = require('path');

class DataPreprocessor {
  constructor(options = {}) {
    this.config = {
      smoothingWindow: options.smoothingWindow || 5,
      outlierThreshold: options.outlierThreshold || 3, // Standard deviations
      fillMethod: options.fillMethod || 'interpolation', // 'interpolation', 'forward', 'backward', 'mean'
      minValidDataPoints: options.minValidDataPoints || 0.7, // 70% valid data required
      timeSeriesInterval: options.timeSeriesInterval || 900000, // 15 minutes in ms
      ...options
    };
  }

  /**
   * Clean and preprocess raw ThingSpeak data
   * @param {Array} rawData - Raw data from ThingSpeak
   * @returns {Object} Processed data with metadata
   */
  async preprocessData(rawData) {
    if (!rawData || rawData.length === 0) {
      throw new Error('No data provided for preprocessing');
    }

    console.log(`Starting preprocessing of ${rawData.length} records...`);

    // Step 1: Sort by timestamp
    const sortedData = this.sortByTimestamp(rawData);
    
    // Step 2: Remove duplicates
    const deduplicatedData = this.removeDuplicates(sortedData);
    
    // Step 3: Detect and handle outliers
    const outlierProcessedData = this.handleOutliers(deduplicatedData);
    
    // Step 4: Fill missing values
    const filledData = this.fillMissingValues(outlierProcessedData);
    
    // Step 5: Smooth the data
    const smoothedData = this.smoothData(filledData);
    
    // Step 6: Create regular time intervals
    const regularizedData = this.regularizeTimeSeries(smoothedData);
    
    // Step 7: Calculate derived features
    const enhancedData = this.calculateDerivedFeatures(regularizedData);

    const processingReport = {
      original_count: rawData.length,
      deduplicated_count: deduplicatedData.length,
      outliers_removed: deduplicatedData.length - outlierProcessedData.length,
      final_count: enhancedData.length,
      time_range: {
        start: enhancedData[0]?.timestamp,
        end: enhancedData[enhancedData.length - 1]?.timestamp
      },
      data_quality: this.assessDataQuality(enhancedData)
    };

    console.log('Preprocessing complete:', processingReport);

    return {
      data: enhancedData,
      report: processingReport,
      config: this.config
    };
  }

  /**
   * Sort data by timestamp
   */
  sortByTimestamp(data) {
    return [...data].sort((a, b) => {
      const timeA = new Date(a.created_at || a.timestamp);
      const timeB = new Date(b.created_at || b.timestamp);
      return timeA - timeB;
    });
  }

  /**
   * Remove duplicate entries
   */
  removeDuplicates(data) {
    const seen = new Set();
    return data.filter(record => {
      const key = `${record.created_at}-${record.entry_id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Detect and handle outliers using statistical methods
   */
  handleOutliers(data) {
    const fields = ['humidity', 'temperature', 'pm25', 'pm10'];
    const outlierIndices = new Set();

    fields.forEach(field => {
      const values = data
        .map(record => parseFloat(record[field]))
        .filter(val => !isNaN(val));

      if (values.length === 0) return;

      const stats = this.calculateStatistics(values);
      const threshold = this.config.outlierThreshold * stats.stdDev;

      data.forEach((record, index) => {
        const value = parseFloat(record[field]);
        if (!isNaN(value)) {
          const zScore = Math.abs(value - stats.mean) / stats.stdDev;
          if (zScore > this.config.outlierThreshold) {
            outlierIndices.add(index);
          }
        }
      });
    });

    console.log(`Detected ${outlierIndices.size} outlier records`);
    
    // Remove outliers
    return data.filter((_, index) => !outlierIndices.has(index));
  }

  /**
   * Fill missing values using various methods
   */
  fillMissingValues(data) {
    const fields = ['humidity', 'temperature', 'pm25', 'pm10'];
    const processedData = JSON.parse(JSON.stringify(data)); // Deep copy

    fields.forEach(field => {
      this.fillFieldValues(processedData, field);
    });

    return processedData;
  }

  /**
   * Fill missing values for a specific field
   */
  fillFieldValues(data, field) {
    const method = this.config.fillMethod;

    switch (method) {
      case 'interpolation':
        this.interpolateField(data, field);
        break;
      case 'forward':
        this.forwardFillField(data, field);
        break;
      case 'backward':
        this.backwardFillField(data, field);
        break;
      case 'mean':
        this.meanFillField(data, field);
        break;
      default:
        this.interpolateField(data, field);
    }
  }

  /**
   * Linear interpolation for missing values
   */
  interpolateField(data, field) {
    for (let i = 0; i < data.length; i++) {
      const value = parseFloat(data[i][field]);
      
      if (isNaN(value) || value === null) {
        // Find previous and next valid values
        let prevIndex = -1;
        let nextIndex = -1;
        
        // Find previous valid value
        for (let j = i - 1; j >= 0; j--) {
          if (!isNaN(parseFloat(data[j][field]))) {
            prevIndex = j;
            break;
          }
        }
        
        // Find next valid value
        for (let j = i + 1; j < data.length; j++) {
          if (!isNaN(parseFloat(data[j][field]))) {
            nextIndex = j;
            break;
          }
        }
        
        // Interpolate if we have both boundaries
        if (prevIndex !== -1 && nextIndex !== -1) {
          const prevValue = parseFloat(data[prevIndex][field]);
          const nextValue = parseFloat(data[nextIndex][field]);
          const ratio = (i - prevIndex) / (nextIndex - prevIndex);
          data[i][field] = prevValue + (nextValue - prevValue) * ratio;
        } else if (prevIndex !== -1) {
          // Forward fill
          data[i][field] = data[prevIndex][field];
        } else if (nextIndex !== -1) {
          // Backward fill
          data[i][field] = data[nextIndex][field];
        }
      }
    }
  }

  /**
   * Apply smoothing filter to reduce noise
   */
  smoothData(data) {
    const fields = ['humidity', 'temperature', 'pm25', 'pm10'];
    const smoothedData = JSON.parse(JSON.stringify(data));
    const window = this.config.smoothingWindow;

    fields.forEach(field => {
      for (let i = 0; i < smoothedData.length; i++) {
        const start = Math.max(0, i - Math.floor(window / 2));
        const end = Math.min(smoothedData.length, i + Math.floor(window / 2) + 1);
        
        const windowValues = [];
        for (let j = start; j < end; j++) {
          const value = parseFloat(smoothedData[j][field]);
          if (!isNaN(value)) {
            windowValues.push(value);
          }
        }
        
        if (windowValues.length > 0) {
          // Use median for better outlier resistance
          windowValues.sort((a, b) => a - b);
          const median = windowValues.length % 2 === 0
            ? (windowValues[windowValues.length / 2 - 1] + windowValues[windowValues.length / 2]) / 2
            : windowValues[Math.floor(windowValues.length / 2)];
          
          smoothedData[i][field + '_smoothed'] = median;
        }
      }
    });

    return smoothedData;
  }

  /**
   * Create regular time intervals for time series analysis
   */
  regularizeTimeSeries(data) {
    if (data.length === 0) return data;

    const interval = this.config.timeSeriesInterval;
    const startTime = new Date(data[0].created_at || data[0].timestamp);
    const endTime = new Date(data[data.length - 1].created_at || data[data.length - 1].timestamp);
    
    const regularData = [];
    let currentTime = new Date(startTime);
    
    while (currentTime <= endTime) {
      // Find closest data point
      const targetTime = currentTime.getTime();
      let closestRecord = null;
      let minDistance = Infinity;
      
      data.forEach(record => {
        const recordTime = new Date(record.created_at || record.timestamp).getTime();
        const distance = Math.abs(recordTime - targetTime);
        
        if (distance < minDistance && distance < interval) {
          minDistance = distance;
          closestRecord = record;
        }
      });
      
      if (closestRecord) {
        regularData.push({
          ...closestRecord,
          timestamp: currentTime.toISOString(),
          interpolated: minDistance > interval / 4 // Mark as interpolated if far from actual data
        });
      } else {
        // Create interpolated record
        const interpolatedRecord = this.interpolateAtTime(data, currentTime);
        if (interpolatedRecord) {
          regularData.push({
            ...interpolatedRecord,
            timestamp: currentTime.toISOString(),
            interpolated: true
          });
        }
      }
      
      currentTime = new Date(currentTime.getTime() + interval);
    }
    
    return regularData;
  }

  /**
   * Calculate derived features for enhanced analysis
   */
  calculateDerivedFeatures(data) {
    const enhancedData = [...data];
    
    for (let i = 1; i < enhancedData.length; i++) {
      const current = enhancedData[i];
      const previous = enhancedData[i - 1];
      
      // Calculate rates of change
      const timeDiv = (new Date(current.timestamp) - new Date(previous.timestamp)) / (1000 * 60 * 60); // hours
      
      if (timeDiv > 0) {
        current.humidity_rate = (parseFloat(current.humidity) - parseFloat(previous.humidity)) / timeDiv;
        current.temperature_rate = (parseFloat(current.temperature) - parseFloat(previous.temperature)) / timeDiv;
        current.pm25_rate = (parseFloat(current.pm25) - parseFloat(previous.pm25)) / timeDiv;
        current.pm10_rate = (parseFloat(current.pm10) - parseFloat(previous.pm10)) / timeDiv;
      }
      
      // Calculate moving averages (last 24 hours)
      if (i >= 24) {
        const last24 = enhancedData.slice(i - 23, i + 1);
        current.humidity_24h_avg = this.calculateMean(last24.map(r => parseFloat(r.humidity)));
        current.temperature_24h_avg = this.calculateMean(last24.map(r => parseFloat(r.temperature)));
        current.pm25_24h_avg = this.calculateMean(last24.map(r => parseFloat(r.pm25)));
        current.pm10_24h_avg = this.calculateMean(last24.map(r => parseFloat(r.pm10)));
      }
    }
    
    return enhancedData;
  }

  /**
   * Assess overall data quality
   */
  assessDataQuality(data) {
    if (!data || data.length === 0) {
      return { quality: 'poor', score: 0, issues: ['No data available'] };
    }

    const fields = ['humidity', 'temperature', 'pm25', 'pm10'];
    let totalScore = 0;
    const issues = [];
    
    fields.forEach(field => {
      const values = data.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
      const completeness = values.length / data.length;
      
      if (completeness < 0.5) {
        issues.push(`${field} has low completeness (${(completeness * 100).toFixed(1)}%)`);
      }
      
      totalScore += completeness * 25; // 25 points per field
    });
    
    // Check for time continuity
    const timeGaps = this.findTimeGaps(data);
    if (timeGaps.length > data.length * 0.1) {
      issues.push('Significant time gaps in data');
      totalScore -= 10;
    }
    
    let quality = 'poor';
    if (totalScore >= 80) quality = 'excellent';
    else if (totalScore >= 60) quality = 'good';
    else if (totalScore >= 40) quality = 'fair';
    
    return {
      quality,
      score: Math.max(0, Math.min(100, totalScore)),
      issues,
      completeness: totalScore / 100
    };
  }

  /**
   * Helper method to calculate statistics
   */
  calculateStatistics(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return { mean, variance, stdDev };
  }

  /**
   * Helper method to calculate mean
   */
  calculateMean(values) {
    const validValues = values.filter(v => !isNaN(v));
    return validValues.length > 0 ? validValues.reduce((sum, val) => sum + val, 0) / validValues.length : null;
  }

  /**
   * Find time gaps in the dataset
   */
  findTimeGaps(data) {
    const gaps = [];
    for (let i = 1; i < data.length; i++) {
      const timeDiff = new Date(data[i].timestamp) - new Date(data[i - 1].timestamp);
      if (timeDiff > this.config.timeSeriesInterval * 2) {
        gaps.push({
          start: data[i - 1].timestamp,
          end: data[i].timestamp,
          duration: timeDiff
        });
      }
    }
    return gaps;
  }

  /**
   * Forward fill missing values
   */
  forwardFillField(data, field) {
    let lastValid = null;
    data.forEach(record => {
      const value = parseFloat(record[field]);
      if (!isNaN(value)) {
        lastValid = value;
      } else if (lastValid !== null) {
        record[field] = lastValid;
      }
    });
  }

  /**
   * Backward fill missing values
   */
  backwardFillField(data, field) {
    let nextValid = null;
    for (let i = data.length - 1; i >= 0; i--) {
      const value = parseFloat(data[i][field]);
      if (!isNaN(value)) {
        nextValid = value;
      } else if (nextValid !== null) {
        data[i][field] = nextValid;
      }
    }
  }

  /**
   * Mean fill missing values
   */
  meanFillField(data, field) {
    const values = data.map(r => parseFloat(r[field])).filter(v => !isNaN(v));
    const mean = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
    
    data.forEach(record => {
      const value = parseFloat(record[field]);
      if (isNaN(value)) {
        record[field] = mean;
      }
    });
  }

  /**
   * Interpolate record at specific time
   */
  interpolateAtTime(data, targetTime) {
    // Find surrounding records
    let before = null;
    let after = null;
    
    data.forEach(record => {
      const recordTime = new Date(record.created_at || record.timestamp);
      if (recordTime <= targetTime && (!before || recordTime > new Date(before.timestamp))) {
        before = record;
      }
      if (recordTime >= targetTime && (!after || recordTime < new Date(after.timestamp))) {
        after = record;
      }
    });
    
    if (!before || !after) return null;
    
    const beforeTime = new Date(before.created_at || before.timestamp);
    const afterTime = new Date(after.created_at || after.timestamp);
    const ratio = (targetTime - beforeTime) / (afterTime - beforeTime);
    
    const fields = ['humidity', 'temperature', 'pm25', 'pm10'];
    const interpolated = {};
    
    fields.forEach(field => {
      const beforeVal = parseFloat(before[field]);
      const afterVal = parseFloat(after[field]);
      
      if (!isNaN(beforeVal) && !isNaN(afterVal)) {
        interpolated[field] = beforeVal + (afterVal - beforeVal) * ratio;
      } else if (!isNaN(beforeVal)) {
        interpolated[field] = beforeVal;
      } else if (!isNaN(afterVal)) {
        interpolated[field] = afterVal;
      }
    });
    
    return interpolated;
  }

  /**
   * Save processed data to file
   */
  async saveProcessedData(processedData, filename) {
    const dataDir = path.join(__dirname, '..', 'data', 'processed');
    
    // Ensure directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filepath = path.join(dataDir, filename);
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(processedData, null, 2));
      console.log(`Processed data saved to: ${filepath}`);
      return filepath;
    } catch (error) {
      throw new Error(`Failed to save processed data: ${error.message}`);
    }
  }
}

module.exports = DataPreprocessor;
