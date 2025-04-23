/**
 * CSV Data Service
 * Manages reading and filtering of CSV air quality data
 */
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const configService = require('./config-service');

// Import debug helper if available
let debug;
try {
  debug = require('../helpers/debug-helper');
} catch (err) {
  debug = {
    log: (msg, context) => console.log(`[${context}] ${msg}`),
    error: (msg, context) => console.error(`[${context}] ${msg}`)
  };
}

class CsvDataService {
  constructor() {
    this.config = configService.getConfig();
    this.dataPath = this.config.dataSources.defaultCsvPath;
    this.cachedData = null;
    this.lastReadTime = null;
    this.cacheValidityPeriod = 60000; // 1 minute
  }
  
  /**
   * Get all data from the CSV file
   * @returns {Promise<Array>} All data entries
   */
  async getAllData() {
    // Check if we have valid cached data
    if (this.cachedData && this.lastReadTime && (Date.now() - this.lastReadTime < this.cacheValidityPeriod)) {
      debug.log('Returning cached data', 'csv-data-service');
      return this.cachedData;
    }
    
    // Read all data from CSV
    const data = await this.readCsvFile(this.dataPath);
    
    // Update cache
    this.cachedData = data;
    this.lastReadTime = Date.now();
    
    return data;
  }
  
  /**
   * Get filtered data based on date range and time
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} Filtered data entries
   */
  async getFilteredData(filters = {}) {
    const allData = await this.getAllData();
    
    // If no filters provided, return all data
    if (!filters.startDate && !filters.endDate && !filters.startTime && !filters.endTime) {
      return allData;
    }
    
    return allData.filter(item => {
      if (!item.created_at) return false;
      
      const date = new Date(item.created_at);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = date.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
      
      // Check date range
      if (filters.startDate && dateStr < filters.startDate) return false;
      if (filters.endDate && dateStr > filters.endDate) return false;
      
      // Check time range
      if (filters.startTime && timeStr < filters.startTime) return false;
      if (filters.endTime && timeStr > filters.endTime) return false;
      
      return true;
    });
  }
  
  /**
   * Read data from a CSV file
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<Array>} Array of data objects
   */
  async readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        debug.error(`CSV file not found: ${filePath}`, 'csv-data-service');
        return resolve([]);
      }
      
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(this.normalizeDataItem(data)))
        .on('end', () => {
          debug.log(`Read ${results.length} records from ${filePath}`, 'csv-data-service');
          resolve(results);
        })
        .on('error', (error) => {
          debug.error(`Error reading CSV: ${error.message}`, 'csv-data-service');
          reject(error);
        });
    });
  }
  
  /**
   * Normalize data item to ensure consistent property names
   * @param {Object} item - Data item from CSV
   * @returns {Object} Normalized data item
   */
  normalizeDataItem(item) {
    const normalized = { ...item };
    
    // Ensure timestamp field is consistent
    if (!normalized.created_at && normalized.timestamp) {
      normalized.created_at = normalized.timestamp;
    }
    if (!normalized.timestamp && normalized.created_at) {
      normalized.timestamp = normalized.created_at;
    }
    
    // Ensure we have a valid created_at date
    if (normalized.created_at) {
      // Make sure it's a valid date format
      try {
        const date = new Date(normalized.created_at);
        if (isNaN(date.getTime())) {
          // If not a valid date, try to parse custom format
          // Assume formats like DD/MM/YYYY or MM/DD/YYYY
          if (normalized.created_at.includes('/')) {
            const parts = normalized.created_at.split('/');
            // Assume MM/DD/YYYY or DD/MM/YYYY based on values
            if (parseInt(parts[0]) > 12) {
              // DD/MM/YYYY
              normalized.created_at = `${parts[2]}-${parts[1]}-${parts[0]}`;
            } else {
              // MM/DD/YYYY
              normalized.created_at = `${parts[2]}-${parts[0]}-${parts[1]}`;
            }
          }
        }
      } catch (e) {
        debug.error(`Error normalizing date: ${e.message}`, 'csv-data-service');
      }
    }
    
    return normalized;
  }
  
  /**
   * Clear the data cache
   */
  clearCache() {
    this.cachedData = null;
    this.lastReadTime = null;
    debug.log('Data cache cleared', 'csv-data-service');
  }
}

module.exports = new CsvDataService();
