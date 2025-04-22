/**
 * Local Data Service
 * Provides methods for reading and processing local CSV data files
 */
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const moment = require('moment');
const debug = require('../helpers/debug-helper');

// Path to data file
const DATA_FILE_PATH = path.join(__dirname, '..', 'data', 'feeds.csv');

/**
 * Read data from CSV file
 * @returns {Promise<Array>} Array of data objects
 */
async function readDataFile() {
  return new Promise((resolve, reject) => {
    const results = [];
    
    if (!fs.existsSync(DATA_FILE_PATH)) {
      debug.log(`Data file not found: ${DATA_FILE_PATH}`, 'local-data-service');
      return reject(new Error(`Data file not found: ${DATA_FILE_PATH}`));
    }
    
    fs.createReadStream(DATA_FILE_PATH)
      .pipe(csv())
      .on('data', (data) => {
        // Parse the CSV data and handle potential missing fields
        const parsedData = {
          created_at: data.created_at,
          entry_id: data.entry_id,
          field1: data.field1 || data.humidity,
          field2: data.field2 || data.temperature,
          field3: data.field3 || data.pm25,
          field4: data.field4 || data.pm10,
          humidity: data.humidity || data.field1,
          temperature: data.temperature || data.field2,
          pm25: data.pm25 || data.field3,
          pm10: data.pm10 || data.field4,
          latitude: data.latitude,
          longitude: data.longitude,
          elevation: data.elevation,
          status: data.status
        };
        results.push(parsedData);
      })
      .on('end', () => {
        debug.log(`Successfully read ${results.length} records from CSV file`, 'local-data-service');
        resolve(results);
      })
      .on('error', (error) => {
        debug.log(`Error reading CSV file: ${error.message}`, 'local-data-service');
        reject(error);
      });
  });
}

/**
 * Get the latest data point
 * @returns {Promise<Object>} The latest data point
 */
async function getLatestData() {
  try {
    const data = await readDataFile();
    if (data.length === 0) {
      return null;
    }
    
    // Sort by entry_id in descending order and return the first item
    const sortedData = data.sort((a, b) => parseInt(b.entry_id) - parseInt(a.entry_id));
    return sortedData[0];
  } catch (error) {
    debug.log(`Error getting latest data: ${error.message}`, 'local-data-service');
    throw error;
  }
}

/**
 * Get recent data points
 * @param {number} days - Number of days to look back
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of recent data points
 */
async function getRecentData(days = 1, limit = 100) {
  try {
    const data = await readDataFile();
    if (data.length === 0) {
      return [];
    }
    
    // Calculate the date threshold
    const now = moment();
    const threshold = moment().subtract(days, 'days');
    
    // Filter the data by date and sort by entry_id in descending order
    let filteredData = data
      .filter(item => {
        const itemDate = moment(item.created_at);
        return itemDate.isValid() && itemDate.isAfter(threshold);
      })
      .sort((a, b) => parseInt(b.entry_id) - parseInt(a.entry_id));
    
    // Apply limit
    if (limit && filteredData.length > limit) {
      filteredData = filteredData.slice(0, limit);
    }
    
    return filteredData;
  } catch (error) {
    debug.log(`Error getting recent data: ${error.message}`, 'local-data-service');
    throw error;
  }
}

/**
 * Get data within a date range
 * @param {string} startDate - Start date in ISO format
 * @param {string} endDate - End date in ISO format
 * @returns {Promise<Array>} Array of data points within the date range
 */
async function getData(startDate = null, endDate = null) {
  try {
    const data = await readDataFile();
    if (data.length === 0) {
      return [];
    }
    
    if (!startDate && !endDate) {
      // Return all data
      return data.sort((a, b) => parseInt(a.entry_id) - parseInt(b.entry_id));
    }
    
    const startMoment = startDate ? moment(startDate) : moment(0); // Beginning of time if no start date
    const endMoment = endDate ? moment(endDate) : moment();        // Current time if no end date
    
    // Filter the data by date range and sort by entry_id
    const filteredData = data
      .filter(item => {
        const itemDate = moment(item.created_at);
        return itemDate.isValid() && 
               itemDate.isSameOrAfter(startMoment) && 
               itemDate.isSameOrBefore(endMoment);
      })
      .sort((a, b) => parseInt(a.entry_id) - parseInt(b.entry_id));
    
    return filteredData;
  } catch (error) {
    debug.log(`Error getting data: ${error.message}`, 'local-data-service');
    throw error;
  }
}

module.exports = {
  readDataFile,
  getLatestData,
  getRecentData,
  getData
};
