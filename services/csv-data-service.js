/**
 * CSV Data Service - Read and process data from local CSV files
 */
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const debug = require('../helpers/debug-helper');

class CsvDataService {
  constructor() {
    this.defaultCsvPath = path.join(__dirname, '..', 'data', 'feeds.csv');
  }

  /**
   * Read data from the default CSV file
   * @param {Object} options - Options for data fetching
   * @returns {Promise<Array>} Array of data records
   */
  async getDefaultCsvData(options = {}) {
    const { limit = 1000, offset = 0 } = options;
    try {
      const results = await this.readCsvFile(this.defaultCsvPath);
      
      // Sort by timestamp (assuming there's a created_at field)
      results.sort((a, b) => {
        const dateA = new Date(a.created_at || a.timestamp);
        const dateB = new Date(b.created_at || b.timestamp);
        return dateB - dateA; // Most recent first
      });
      
      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit);
      
      return {
        success: true,
        data: paginatedResults,
        count: results.length,
        source: 'local-csv'
      };
    } catch (error) {
      debug.log(`Error reading CSV file: ${error.message}`, 'csv-data-service');
      return {
        success: false,
        error: `Failed to read CSV data: ${error.message}`,
        data: []
      };
    }
  }

  /**
   * Read and parse a CSV file
   * @param {string} filePath - Path to the CSV file
   * @returns {Promise<Array>} Array of data objects
   */
  readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`CSV file not found: ${filePath}`));
      }
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Convert numeric fields from strings to numbers
          Object.keys(data).forEach(key => {
            const value = data[key];
            if (!isNaN(value) && value !== '') {
              data[key] = parseFloat(value);
            }
          });
          
          results.push(data);
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
  
  /**
   * Check if the default CSV file exists
   * @returns {boolean} True if file exists
   */
  doesDefaultFileExist() {
    return fs.existsSync(this.defaultCsvPath);
  }
  
  /**
   * Get information about the CSV file
   * @returns {Object} File information
   */
  getCsvFileInfo() {
    try {
      const stats = fs.statSync(this.defaultCsvPath);
      return {
        exists: true,
        path: this.defaultCsvPath,
        size: stats.size,
        modified: stats.mtime,
        created: stats.birthtime
      };
    } catch (error) {
      return {
        exists: false,
        path: this.defaultCsvPath,
        error: error.message
      };
    }
  }
}

module.exports = new CsvDataService();
