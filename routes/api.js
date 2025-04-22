/**
 * API Routes - Centralized management of all API endpoints with enhanced
 * error handling, caching, and performance optimization
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { PythonShell } = require('python-shell');
const NodeCache = require('node-cache');
const thingspeakService = require('../services/thingspeak-service');
const localDataService = require('../services/local-data-service');
const visualizationHelper = require('../helpers/visualization-helper');
const diagnosticHelper = require('../helpers/diagnostic-helper');
const ErrorHandler = require('../error-handler');

const router = express.Router();
const errorHandler = new ErrorHandler();
const apiCache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

// Determine data source (ThingSpeak or Local)
const useLocalData = process.env.USE_LOCAL_DATA === 'true';
const dataService = useLocalData ? localDataService : thingspeakService;
const dataPath = path.join(__dirname, '..', 'data', 'air_quality_data.csv');
const absoluteDataPath = 'C:\\Users\\burak\\Desktop\\iotprojects\\air-quality-monitering\\data\\air_quality_data.csv';

// Helper function for consistent responses
const sendResponse = (res, data, error = null) => {
  if (error) {
    // Log the error using the handler
    errorHandler.handleError(error, 'API Route', res.req)
      .then(errorResult => {
        res.status(error.status || 500).json({
          success: false,
          data: null,
          error: { message: errorResult.message, id: errorResult.errorId }
        });
      })
      .catch(loggingError => { // Fallback if error handler fails
        console.error("Error handler failed:", loggingError);
        res.status(500).json({
          success: false,
          data: null,
          error: { message: error.message || 'An internal server error occurred' }
        });
      });
  } else {
    res.json({ success: true, data: data, error: null });
  }   
};

// Middleware for caching API responses
const cacheMiddleware = (req, res, next) => {
  const cacheKey = req.originalUrl || req.url;
  if (apiCache.has(cacheKey)) {
    return res.json(apiCache.get(cacheKey));
  }
  
  res.sendResponse = res.json;
  res.json = (body) => {
    apiCache.set(cacheKey, body);
    res.sendResponse(body);
  };
  
  next();
};

// Helper for cached routes with consistent format
const cachedRoute = (name, handler, ttl = 300) => {
  return async (req, res) => {
    // Generate cache key with query params
    const queryString = Object.keys(req.query).sort().map(k => `${k}=${req.query[k]}`).join('&');
    const fullCacheKey = `${name}_${queryString}`;
    
    // Check cache first
    const cachedData = apiCache.get(fullCacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${fullCacheKey}`);
      return res.json({success: true, ...cachedData, fromCache: true});
    }
    
    try {
      // Get fresh data
      const result = await handler(req);
      console.log(`Caching result for ${fullCacheKey}`);
      apiCache.set(fullCacheKey, result, ttl);
      res.json(result);
    } catch (error) {
      console.error(`Error in ${name} route:`, error);
      res.status(500).json({
        success: false,
        error: error.message || `Error processing ${name} request`
      });
    }
  };
};

// Format response consistently
const formatResponse = (success, data, error = null) => {
  return {
    success,
    ...(data ? data : {}),
    ...(error ? { error } : {})
  };
};

// Direct visualization endpoints to surface the Python-generated images
router.get('/visualizations/standard', (req, res) => {
  console.log('Standard visualization route handler called');
  const { startDate, endDate } = req.query;
  
  try {
    // Run Python script - UPDATED to use python/analysis.py directly
    const options = {
      mode: 'text',  // CHANGE: Use text mode instead of JSON mode
      pythonPath: process.env.PYTHON_PATH || 'python',
      scriptPath: path.join(__dirname, '..', 'python'),
      args: [
        absoluteDataPath, 
        startDate || '', 
        endDate || ''
      ]
    };
    
    console.log('Running standard visualization analysis from python directory...');
    
    PythonShell.run('analysis.py', options)
      .then(results => {
        if (!results || results.length === 0) {
          throw new Error('No results from Python analysis');
        }
        //hello
        // CHANGE: Parse the last line as JSON (which contains the actual data)
        let jsonData = null;
        try {
          const lastLine = results[results.length - 1];
          jsonData = JSON.parse(lastLine);
          console.log('Successfully parsed Python analysis results');
        } catch (parseError) {
          console.error('Error parsing Python output as JSON:', parseError);
          console.log('Python output:', results);
          throw new Error('Failed to parse Python output');
        }
        
        // Return paths to the standard visualizations
        res.json({
          success: true,
          data: {
            timeSeries: '/images/time_series.png',
            pm25Trend: '/images/pm25_trend.png',
            stats: jsonData,
            timestamp: new Date().toISOString()
          }
        });
      })
      .catch(error => {
        console.error('Error running Python analysis:', error);
        res.status(500).json({
          success: false,
          error: `Error generating visualizations: ${error.message}`
        });
      });
  } catch (error) {
    console.error('Error in standard visualization endpoint:', error);
    res.status(500).json({
      success: false, 
      error: error.message
    });
  }
});

router.get('/visualizations/extended', (req, res) => {
  const { startDate, endDate } = req.query;
  
  try {
    // Run Python script with extended option - UPDATED to use analysis.py directly with extended flag
    const options = {
      mode: 'json',
      pythonPath: process.env.PYTHON_PATH || 'python',
      scriptPath: path.join(__dirname, '..', 'python'),
      args: [
        absoluteDataPath, 
        startDate || '', 
        endDate || '',
        '--extended'  // Add extended flag
      ]
    };
    
    console.log('Running extended visualization analysis from python directory...');
    
    PythonShell.run('analysis.py', options)
      .then(results => {
        if (!results || results.length === 0) {
          throw new Error('No results from Python extended analysis');
        }
        
        // Return paths to all available visualizations
        res.json({
          success: true,
          data: {
            timeSeries: '/images/time_series.png',
            pm25Trend: '/images/pm25_trend.png',
            heatmap: '/images/heatmap.png',
            histograms: '/images/histograms.png',
            scatterPlots: '/images/scatter_temperature_pm25.png',
            correlationHeatmap: '/images/correlation_heatmap.png',
            stats: results[0],
            timestamp: new Date().toISOString()
          }
        });
      })
      .catch(error => {
        console.error('Error running Python extended analysis:', error);
        res.status(500).json({
          success: false,
          error: `Error generating extended visualizations: ${error.message}`
        });
      });
  } catch (error) {
    console.error('Error in extended visualization endpoint:', error);
    res.status(500).json({
      success: false, 
      error: error.message
    });
  }
});

// API endpoint for visualizations
router.get('/visualizations/:type', async (req, res) => {
  const { type } = req.params;
  console.log(`Generic visualization route called with type: ${type}`);
  
  // Additional validation to prevent conflict with specific routes
  if (type === 'standard' || type === 'extended') {
    return res.status(400).json({
      success: false,
      error: `Use the specific /api/visualizations/${type} endpoint instead`
    });
  }
  
  const { startDate, endDate, sampling } = req.query;
  const cacheKey = `viz_${type}_${startDate}_${endDate}_${sampling}`;
  
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    console.log(`Generating visualization: ${type} with params:`, { startDate, endDate, sampling });
    const result = await visualizationHelper.generateVisualization(type, { startDate, endDate, sampling });
    
    if (!result.success) {
      // Check if this should use client-side fallback
      if (result.clientSide) {
        console.log(`Visualization failed with client-side fallback for ${type}`);
        return res.json({
          success: false,
          clientSide: true,
          error: result.error || { message: 'Visualization failed, trying client-side rendering' }
        });
      }
      
      // Standard error with error image
      console.log(`Visualization error for ${type}:`, result.error);
      return res.json({
        success: false,
        clientSide: false,
        data: {
          imagePath: result.data?.imagePath || '/images/error.png',
          description: result.data?.description || 'Error generating visualization'
        },
        error: result.error
      });
    }
    
    // Success case
    apiCache.set(cacheKey, result.data);
    sendResponse(res, result.data);
  } catch (error) {
    console.error(`Error in visualization endpoint (${type}):`, error);
    sendResponse(res, null, error);
  }
});

// API endpoint for basic analysis (average, max, min)
router.get('/analysis', async (req, res) => {
  const { startDate, endDate, quick, extended } = req.query;
  const cacheKey = `analysis_${startDate}_${endDate}_${quick}_${extended}`;

  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }

  try {
    let analysisResult;
    // Always use local analysis, never ThingSpeak's built-in analysis features
    if (quick === 'true') {
      // Use JavaScript-based quick analysis
      const dataResult = await dataService.getChannelData({ 
        results: 5000, // Fetch raw data points
        start: startDate, 
        end: endDate 
      });
      
      // Validate that we have proper data structure
      if (!dataResult || !dataResult.success || !dataResult.data || !Array.isArray(dataResult.data.data)) {
        console.warn('Invalid data structure received from dataService:', dataResult);
        analysisResult = { 
          average_pm25: 0, average_pm10: 0, max_pm25: 0, 
          max_pm10: 0, min_pm25: 0, min_pm10: 0, count: 0,
          source: 'local-js', // Mark that this was calculated locally
          dataError: true
        };
      } else {
        // Local analysis performed in JavaScript
        let pm25Sum = 0, pm10Sum = 0;
        let tempSum = 0, humiditySum = 0;
        let count = 0;
        let pm25Max = -Infinity, pm10Max = -Infinity;
        let pm25Min = Infinity, pm10Min = Infinity;
        
        // Make sure we're accessing the correct data array
        const dataArray = dataResult.data.data;
        
        dataArray.forEach(row => {
          // Robustly extract all possible field names with explicit type conversion
          const pm25 = parseFloat(row.pm25 || row.field3 || 0);
          const pm10 = parseFloat(row.pm10 || row.field4 || 0);
          const temp = parseFloat(row.temperature || row.field2 || 0);
          const humidity = parseFloat(row.humidity || row.field1 || 0);
          
          if (!isNaN(pm25) && !isNaN(pm10)) {
            pm25Sum += pm25;
            pm10Sum += pm10;
            pm25Max = Math.max(pm25Max, pm25);
            pm10Max = Math.max(pm10Max, pm10);
            pm25Min = Math.min(pm25Min, pm25);
            pm10Min = Math.min(pm10Min, pm10);
            count++;
          }
          
          // Track temperature and humidity separately as they might be missing in some records
          if (!isNaN(temp)) {
            tempSum += temp;
          }
          
          if (!isNaN(humidity)) {
            humiditySum += humidity;
          }
        });
        
        // Calculate results after processing all data locally
        analysisResult = {
          average_pm25: count > 0 ? pm25Sum / count : 0,
          average_pm10: count > 0 ? pm10Sum / count : 0,
          average_temperature: count > 0 ? tempSum / count : 0,
          average_humidity: count > 0 ? humiditySum / count : 0,
          max_pm25: count > 0 ? pm25Max : 0,
          max_pm10: count > 0 ? pm10Max : 0,
          min_pm25: count > 0 ? pm25Min : 0,
          min_pm10: count > 0 ? pm10Min : 0,
          count: count,
          source: 'local-js' // Mark that this was calculated locally
        };
        
        console.log('Analysis results calculated:', {
          avg_pm25: analysisResult.average_pm25,
          avg_pm10: analysisResult.average_pm10,
          count: count
        });
      }
    } else {
      // Use Python script for more robust local analysis
      const options = {
        mode: 'json',
        pythonPath: process.env.PYTHON_PATH || 'python',
        scriptPath: path.join(__dirname, '..', 'python'),
        args: [
          absoluteDataPath, 
          startDate || '', 
          endDate || '',
          // Add extended flag if requested
          ...(extended === 'true' ? ['--extended'] : [])
        ]
      };
      
      console.log(`Running analysis with options: ${JSON.stringify(options)}`);
      
      const results = await PythonShell.run('analysis.py', options);
      if (!results || results.length === 0 || results[0].error) {
        throw new Error(results[0]?.error || 'Python analysis script failed');
      }
      analysisResult = {
        ...results[0],
        source: 'local-python', // Mark that this was calculated locally
        extended: extended === 'true'
      };
    }
    apiCache.set(cacheKey, analysisResult);
    sendResponse(res, analysisResult);
  } catch (error) {
    console.error('Error in analysis endpoint:', error);
    sendResponse(res, null, error);
  }
});

// API endpoint for raw CSV data access (for client-side visualizations)
router.get('/csv-data', async (req, res) => {
  const { startDate, endDate } = req.query;
  const cacheKey = `csv_data_${startDate || 'all'}_${endDate || 'all'}`;
  
  if (apiCache.has(cacheKey)) {
    return res.json(apiCache.get(cacheKey));
  }
  
  try {
    // Try both possible CSV paths
    let dataPath = path.join(__dirname, '..', 'data', 'air_quality_data.csv');
    if (!fs.existsSync(dataPath)) {
      dataPath = path.join(__dirname, '..', 'data', 'feeds-data.csv');
      if (!fs.existsSync(dataPath)) {
        throw new Error("No CSV data files found");
      }
    }
    
    console.log(`Reading CSV data from: ${dataPath}`);
    const data = [];
    
    // Use streams for memory efficiency
    const parser = fs.createReadStream(dataPath).pipe(require('csv-parser')());
    
    // Parse start and end dates if provided
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Process the CSV data
    for await (const row of parser) {
      // Apply date filter if provided
      if (start || end) {
        const rowDate = new Date(row.created_at);
        if ((start && rowDate < start) || (end && rowDate > end)) {
          continue; // Skip rows outside date range
        }
      }
      
      // Map fields for consistency
      data.push({
        created_at: row.created_at,
        entry_id: row.entry_id || data.length + 1,
        humidity: parseFloat(row.humidity || row.field1),
        temperature: parseFloat(row.temperature || row.field2),
        pm25: parseFloat(row.pm25 || row.field3),
        pm10: parseFloat(row.pm10 || row.field4),
        // Also include the field names for compatibility
        field1: parseFloat(row.humidity || row.field1),
        field2: parseFloat(row.temperature || row.field2),
        field3: parseFloat(row.pm25 || row.field3),
        field4: parseFloat(row.pm10 || row.field4)
      });
    }
    
    const response = {
      data,
      count: data.length,
      source: 'csv',
      path: dataPath,
      timestamp: new Date().toISOString()
    };
    
    // Cache with appropriate TTL based on size
    const ttl = data.length > 1000 ? 1800 : 600; // 30 min for large data, 10 min for smaller
    apiCache.set(cacheKey, response, ttl);
    
    res.json(response);
  } catch (error) {
    console.error('Error reading CSV data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint for retrieving data
router.get('/data', async (req, res) => {
  const { limit, page } = req.query;
  const cacheKey = `data_limit_${limit}_page_${page}`;
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    const options = {
      results: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined
    };
    const data = await dataService.getChannelData(options);
    apiCache.set(cacheKey, data);
    sendResponse(res, data);
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// API endpoint for retrieving data by date range
router.get('/data/date', async (req, res) => {
  const { startDate, endDate, limit, page } = req.query;
  const cacheKey = `data_date_${startDate}_${endDate}_limit_${limit}_page_${page}`;
  
  if (!startDate || !endDate) {
    return sendResponse(res, null, { status: 400, message: 'startDate and endDate query parameters are required.' });
  }
  
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    const options = {
      start: startDate,
      end: endDate,
      results: limit ? parseInt(limit) : undefined,
      page: page ? parseInt(page) : undefined
    };
    const data = await dataService.getChannelData(options);
    apiCache.set(cacheKey, data);
    sendResponse(res, data);
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// API endpoint for retrieving data by time range (within a day)
router.get('/data/time', async (req, res) => {
  const { startTime, endTime, date } = req.query; // Optional date filter
  const cacheKey = `data_time_${startTime}_${endTime}_${date}`;
  
  if (!startTime || !endTime) {
    return sendResponse(res, null, { status: 400, message: 'startTime and endTime query parameters are required (HH:MM format).' });
  }
  
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    // Verify time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      console.error(`Invalid startTime parameter received: ${startTime}`);
      return res.status(400).json({
        success: false, 
        error: { message: 'Invalid or missing startTime parameter. Use HH:MM format.' }
      });
    }
    
    // If endTime is provided, or if it's invalid, use the same as start time
    const validEndTime = endTime && timeRegex.test(endTime) ? endTime : startTime;
    
    console.log(`Filtering data by time range: ${startTime} - ${validEndTime}`);
    
    // Get all data first
    const allData = await dataService.getChannelData({ results: 2000 });
    
    if (!allData || !allData.data) {
      return res.status(500).json({
        success: false, 
        error: { message: allData.error || 'Failed to fetch data' }
      });
    }
    
    // Filter by time
    const filteredData = {
      ...allData,
      data: (allData.data || []).filter(item => {
        try {
          // Add robust date parsing
          const itemDate = new Date(item.created_at);
          if (isNaN(itemDate.getTime())) {
            console.error(`Invalid date found in data: ${item.created_at}`);
            return false; // Skip invalid dates
          }
          
          const itemTime = `${itemDate.getHours().toString().padStart(2, '0')}:${itemDate.getMinutes().toString().padStart(2, '0')}`;
          
          // Simple string comparison works for HH:MM format
          return itemTime >= startTime && itemTime <= validEndTime;
        } catch (filterError) {
          console.error(`Error filtering item by time: ${filterError.message}`, item);
          return false; // Skip if filtering fails
        }
      })
    };
    
    // Add pagination info
    filteredData.pagination = { 
      ...filteredData.pagination,
      filteredCount: filteredData.data.length 
    };
    
    apiCache.set(cacheKey, filteredData);
    sendResponse(res, filteredData);
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// API endpoint for data source information
router.get('/data-source', async (req, res) => {
  const cacheKey = 'data_source_info';
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    let channelInfo;
    
    if (typeof thingspeakService.getChannelInfo === 'function') {
      console.log('Getting ThingSpeak channel info');
      channelInfo = await thingspeakService.getChannelInfo();
      console.log('Channel info retrieved:', channelInfo?.id || 'unknown');
    } else {
      console.error('ThingSpeak service not properly initialized');
      channelInfo = {
        name: 'ThingSpeak Channel',
        channelId: process.env.THINGSPEAK_CHANNEL_ID || '2863798', // Fallback to hardcoded channel ID if needed
        description: 'Air quality monitoring data',
        recordCount: 0,
        lastEntry: 0
      };
    }
    
    const info = await dataService.getDataSourceInfo(); // Assumes this function exists
    const responseData = { dataSource: info, meta: { timestamp: new Date().toISOString() } };
    apiCache.set(cacheKey, responseData);
    sendResponse(res, responseData);
  } catch (error) {
    // Provide a default structure even on error
    const errorInfo = {
      isOffline: true, // Indicate offline status on error
      error: error.message,
      name: useLocalData ? 'Local CSV' : 'ThingSpeak (Error)',
      channelId: useLocalData ? 'N/A' : process.env.THINGSPEAK_CHANNEL_ID || 'Unknown',
      recordCount: 'Unknown',
      lastEntryDate: 'Unknown',
      fieldMapping: dataService.getFieldMapping ? dataService.getFieldMapping() : {
        timestamp: 'created_at',
        humidity: 'field1',
        temperature: 'field2',
        pm25: 'field3',
        pm10: 'field4'
      }
    };
    sendResponse(res, { dataSource: errorInfo, meta: { timestamp: new Date().toISOString() } }, error); // Send error but include basic info
  }
});

// API endpoint for data validation
router.get('/validate', async (req, res) => {
  const cacheKey = 'data_validation';
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    const options = {
      mode: 'json',
      pythonPath: process.env.PYTHON_PATH || 'python',
      scriptPath: path.join(__dirname, '..', 'python'),
      args: [dataPath]
    };
    const results = await PythonShell.run('data_validator.py', options);
    if (!results || results.length === 0) {
      throw new Error('Python validation script returned no result');
    }
    const validationResult = results[0];
    apiCache.set(cacheKey, validationResult);
    sendResponse(res, validationResult);
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// API endpoint for real-time updates
router.get('/realtime', async (req, res) => {
  const { lastEntryId } = req.query;
  try {
    const updates = await dataService.getRealtimeUpdates(lastEntryId); // Assumes this function exists
    sendResponse(res, updates);
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// API endpoint for system health
router.get('/health', async (req, res) => {
  const cacheKey = 'system_health';
  if (apiCache.has(cacheKey)) {
    return sendResponse(res, apiCache.get(cacheKey));
  }
  
  try {
    // Check status and channel info
    const status = await thingspeakService.getChannelStatus();
    const channelInfo = await thingspeakService.getDataSourceInfo();
    
    // Calculate minutes since last update
    const lastUpdate = new Date(status?.channel?.updated_at || new Date());
    const minutesSinceUpdate = Math.round((new Date() - lastUpdate) / (1000 * 60));
    
    // Determine status level based on time
    let statusLevel = 'good';
    let message = 'System is operating normally';
    
    if (minutesSinceUpdate > 120) {
      statusLevel = 'critical';
      message = 'No updates received for over 2 hours';
    } else if (minutesSinceUpdate > 30) {
      statusLevel = 'warning';
      message = 'Delayed recent updates received';
    }
    
    const health = {
      status: statusLevel,
      message,
      lastUpdate: lastUpdate.toISOString(),
      minutesSinceUpdate,
      name: channelInfo?.name || 'Unknown',
      entryCount: parseInt(channelInfo?.recordCount || 0)
    };
    
    apiCache.set(cacheKey, { health }, 60); // Cache for 1 minute
    sendResponse(res, { health });
  } catch (error) {
    console.error('Error getting system health:', error);
    
    // Return degraded status on error
    const health = {
      status: 'error',
      message: 'Unable to connect to data source',
      lastUpdate: new Date().toISOString(),
      minutesSinceUpdate: 0,
      entryCount: 0
    };
    
    sendResponse(res, { health });
  }
});

// API endpoint to clear cache
router.post('/cache/clear', (req, res) => {
  try {
    const count = apiCache.flushAll();
    console.log(`Cleared ${count} cache entries.`);
    sendResponse(res, { message: `Successfully cleared ${count} cache entries.` });
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// API endpoint for API metrics (from api-monitor middleware)
router.get('/metrics', (req, res) => {
  try {
    const metrics = {
      requestCount: 0,
      cacheHits: apiCache.getStats().hits,
      cacheMisses: apiCache.getStats().misses,
      timestamp: new Date().toISOString()
    };
    sendResponse(res, metrics);
  } catch (error) {
    sendResponse(res, null, error);
  }
});

// Additional utility endpoints
router.get('/status', async (req, res) => {
  try {
    const status = await thingspeakService.getChannelStatus();
    sendResponse(res, { status });
  } catch (error) {
    console.error('Error fetching channel status:', error);
    sendResponse(res, null, error);
  }
});

// Check ThingSpeak API connectivity
router.get('/check-connection', async (req, res) => {
  try {
    console.log('API endpoint: Checking ThingSpeak connection');
    const available = await thingspeakService.checkThingspeakAvailability();
    
    // If available, clear the cache to fetch fresh data
    if (available) {
      console.log('ThingSpeak API is available, clearing cache');
      thingspeakService.clearCache();
    } else {
      console.log('ThingSpeak API is unavailable');
    }
    
    res.json({
      success: true,
      available: available,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking connection:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      available: false
    });
  }
});

// Add diagnostics endpoint
router.get('/diagnostics/thingspeak', async (req, res) => {
  try {
    console.log('Running ThingSpeak diagnostics');
    const results = await diagnosticHelper.testThingSpeakConnectivity(
      process.env.THINGSPEAK_CHANNEL_ID || '2863798', 
      process.env.THINGSPEAK_READ_API_KEY || 'RIXYDDDMXDBX9ALI'
    );
    res.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Diagnostic test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint to clear ThingSpeak cache
router.post('/cache/clear-thingspeak', async (req, res) => {
  const clearedItems = thingspeakService.clearCache();
  res.json({
    success: true,
    message: `Cleared ${clearedItems} items from ThingSpeak cache`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
