/**
 * Local data service that serves as fallback when ThingSpeak is unavailable
 * With improved memory efficiency for large files
 */
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const NodeCache = require('node-cache');
const readline = require('readline');
const { Transform } = require('stream');

// Configure cache with limits
const localCache = new NodeCache({
  stdTTL: 600,      // 10 minute TTL
  checkperiod: 120, // Check every 2 minutes
  maxKeys: 500      // Limit cache size to prevent memory issues
});

// Update to use the absolute standard path
const DEFAULT_DATA_PATH = 'C:\\Users\\burak\\Desktop\\iotprojects\\air-quality-monitering\\data\\air_quality_data.csv';
const RELATIVE_DATA_PATH = path.join(__dirname, '..', 'data', 'air_quality_data.csv');
const FEEDS_DATA_PATH = path.join(__dirname, '..', 'data', 'feeds-data.csv');

/**
 * Get data path based on availability with security checks
 * @returns {string} Path to the data file
 */
function getDataPath() {
  // First try the absolute path
  if (fs.existsSync(DEFAULT_DATA_PATH)) {
    console.log(`Using absolute data path: ${DEFAULT_DATA_PATH}`);
    return DEFAULT_DATA_PATH;
  }
  
  // Then try the relative path
  if (fs.existsSync(RELATIVE_DATA_PATH)) {
    console.log(`Using relative data path: ${RELATIVE_DATA_PATH}`);
    return RELATIVE_DATA_PATH;
  }
  
  // Finally try the feeds data path
  if (fs.existsSync(FEEDS_DATA_PATH)) {
    console.log(`Using feeds data path: ${FEEDS_DATA_PATH}`);
    return FEEDS_DATA_PATH;
  }
  
  throw new Error('No local data file available at any expected location');
}

/**
 * Count lines in a file efficiently
 * @param {string} filePath - Path to the file
 * @returns {Promise<number>} - Number of lines
 */
async function countFileLines(filePath) {
  return new Promise((resolve, reject) => {
    let lineCount = 0;
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', reject);
    
    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity
    });
    
    rl.on('line', () => lineCount++);
    rl.on('close', () => resolve(lineCount - 1)); // Subtract header
    rl.on('error', reject);
  });
}

/**
 * Get channel data from local CSV file with optimized memory usage
 * @param {Object} options - Options for data retrieval
 * @returns {Promise<Object>} Data object
 */
async function getChannelData(options = {}) {
  const {
    results = 100,
    start = null,
    end = null,
    page = 1
  } = options;
  
  const cacheKey = `local_data_${results}_${start || ''}_${end || ''}_${page}`;
  const cachedData = localCache.get(cacheKey);
  
  if (cachedData) {
    return {
      ...cachedData,
      fromCache: true,
      source: 'local'
    };
  }
  
  try {
    const dataPath = getDataPath();
    
    // Get total records count efficiently
    let totalRecords = localCache.get('total_records');
    if (!totalRecords) {
      totalRecords = await countFileLines(dataPath);
      localCache.set('total_records', totalRecords, 3600); // Cache for an hour
    }
    
    // Calculate pagination
    const offset = (page - 1) * results;
    const limit = results;
    
    const data = [];
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    
    // Create a transform stream to filter and limit records
    let currentIndex = 0;
    let inRange = false;
    
    // Process with streams for memory efficiency
    await new Promise((resolve, reject) => {
      const dataStream = fs.createReadStream(dataPath)
        .pipe(csv())
        .pipe(new Transform({
          objectMode: true,
          transform(row, encoding, callback) {
            currentIndex++;
            
            // Skip if before offset
            if (currentIndex <= offset) {
              return callback();
            }
            
            // Stop if we've reached the limit
            if (data.length >= limit) {
              return callback();
            }
            
            // Date filtering
            let withinDateRange = true;
            if (startDate || endDate) {
              const rowDate = new Date(row.created_at);
              if (!isNaN(rowDate.getTime())) {
                withinDateRange = 
                  (!startDate || rowDate >= startDate) && 
                  (!endDate || rowDate <= endDate);
              }
            }
            
            if (withinDateRange) {
              // Add to results with consistent field mapping
              data.push({
                created_at: row.created_at,
                entry_id: row.entry_id || currentIndex,
                field1: row.field1 || row.humidity || '',
                field2: row.field2 || row.temperature || '',
                field3: row.field3 || row.pm25 || '',
                field4: row.field4 || row.pm10 || '',
                // Also include the named fields for consistency
                humidity: row.humidity || row.field1 || '',
                temperature: row.temperature || row.field2 || '',
                pm25: row.pm25 || row.field3 || '',
                pm10: row.pm10 || row.field4 || ''
              });
            }
            
            callback();
          }
        }));
      
      dataStream.on('finish', resolve);
      dataStream.on('error', reject);
    });
    
    // Create response object
    const response = {
      data,
      pagination: {
        total: totalRecords,
        totalPages: Math.ceil(totalRecords / results),
        currentPage: page,
        limit: results,
        filteredCount: data.length
      },
      timestamp: new Date().toISOString(),
      source: 'local'
    };
    
    // Cache with TTL based on result size
    const ttl = data.length > 500 ? 1200 : 600; // 20 or 10 minutes
    localCache.set(cacheKey, response, ttl);
    return response;
  } catch (error) {
    console.error('Error reading local data:', error);
    throw new Error(`Failed to read local data: ${error.message}`);
  }
}

/**
 * Get channel info from local data
 * @returns {Promise<Object>} Channel info
 */
async function getChannelInfo() {
  const cacheKey = 'local_channel_info';
  const cachedInfo = localCache.get(cacheKey);
  
  if (cachedInfo) {
    return cachedInfo;
  }
  
  try {
    const dataPath = getDataPath();
    const stats = fs.statSync(dataPath);
    
    // Get first and last entry dates
    const data = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(dataPath)
        .pipe(csv())
        .on('data', (row) => {
          data.push(row);
          if (data.length >= 10) {
            this.destroy(); // Stop after 10 records
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });
    
    // Get total record count
    let totalRecords = localCache.get('total_records');
    if (!totalRecords) {
      totalRecords = await countFileLines(dataPath);
      localCache.set('total_records', totalRecords, 3600); // Cache for an hour
    }
    
    // Create channel info
    const channelInfo = {
      id: 'local',
      channelId: 'local',
      name: 'Local CSV Data',
      description: `Data from local file: ${path.basename(dataPath)}`,
      last_entry_id: totalRecords,
      created_at: stats.birthtime.toISOString(),
      updated_at: stats.mtime.toISOString(),
      field1: 'Humidity',
      field2: 'Temperature',
      field3: 'PM2.5',
      field4: 'PM10',
      fieldMapping: {
        timestamp: 'created_at',
        humidity: 'field1',
        temperature: 'field2',
        pm25: 'field3',
        pm10: 'field4'
      },
      isLocal: true
    };
    
    localCache.set(cacheKey, channelInfo);
    return channelInfo;
  } catch (error) {
    console.error('Error getting local channel info:', error);
    throw new Error(`Failed to get local channel info: ${error.message}`);
  }
}

/**
 * Get realtime updates from local data
 * @param {string|number} lastEntryId - Last entry ID client has
 * @returns {Promise<Object>} - New entries data
 */
async function getRealtimeUpdates(lastEntryId = 0) {
  const parsedLastId = parseInt(lastEntryId, 10) || 0;
  
  try {
    const dataPath = getDataPath();
    const lastRecords = [];
    
    // Get the latest 50 records (can adjust this number)
    await new Promise((resolve, reject) => {
      fs.createReadStream(dataPath)
        .pipe(csv())
        .on('data', (row) => {
          const entryId = parseInt(row.entry_id, 10) || 0;
          if (entryId > parsedLastId) {
            lastRecords.push({
              created_at: row.created_at,
              entry_id: entryId,
              humidity: row.humidity || row.field1,
              temperature: row.temperature || row.field2,
              pm25: row.pm25 || row.field3,
              pm10: row.pm10 || row.field4,
              field1: row.field1 || row.humidity,
              field2: row.field2 || row.temperature,
              field3: row.field3 || row.pm25,
              field4: row.field4 || row.pm10
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    // Sort by entry_id to ensure correct order
    lastRecords.sort((a, b) => a.entry_id - b.entry_id);
    
    // Limit to newest 50 records
    const newestRecords = lastRecords.slice(0, 50);
    
    return {
      success: true,
      newEntries: newestRecords.length,
      feeds: newestRecords,
      channel: { 
        last_entry_id: newestRecords.length > 0 ? 
          newestRecords[newestRecords.length - 1].entry_id : 
          parsedLastId 
      }
    };
  } catch (error) {
    console.error('Error fetching local realtime updates:', error);
    return {
      success: false,
      error: error.message,
      newEntries: 0,
      feeds: []
    };
  }
}

// Add function to clear cache
function clearCache() {
  const keysCount = localCache.keys().length;
  localCache.flushAll();
  return keysCount;
}

module.exports = {
  getChannelData,
  getChannelInfo,
  getRealtimeUpdates,
  clearCache  // Export clear cache function
};
