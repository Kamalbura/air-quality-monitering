// Load environment variables first
require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Import middleware
const { apiMonitor } = require('./middleware/api-monitor');

// Import services
const pythonBackend = require('./services/python-backend-service');
const apiCache = require('./services/api-cache-service');
const dataProcessing = require('./services/data-processing-service');
const thingspeakService = require('./services/thingspeak-service');
const errorHandler = require('./error-handler');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use(express.static(path.join(__dirname, 'public'), {
  index: false
}));
app.use(apiMonitor);

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Initialize application
async function initializeApp() {
  console.log('🚀 Initializing Air Quality Monitoring Server...');
  
  // Create necessary directories
  await createRequiredDirectories();
  
  // Initialize services
  await initializeServices();
  
  // Setup routes
  setupRoutes();
  
  // Setup error handling
  setupErrorHandling();
}

// Create necessary directories
async function createRequiredDirectories() {
  const fs = require('fs');
  
  const requiredDirs = [
    path.join(__dirname, 'data'),
    path.join(__dirname, 'public', 'images'),
    path.join(__dirname, 'logs'),
    path.join(__dirname, 'config'),
    path.join(__dirname, 'dump'),
    path.join(__dirname, 'python-backend', 'models'),
    path.join(__dirname, 'python-backend', 'data'),
    path.join(__dirname, 'python-backend', 'logs')
  ];

  for (const dir of requiredDirs) {
    try {
      if (!fs.existsSync(dir)) {
        console.log(`Creating directory: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch (err) {
      console.error(`Failed to create directory ${dir}:`, err.message);
    }
  }
}

// Initialize all services
async function initializeServices() {
  console.log('🔧 Initializing services...');
  
  // Start Python backend
  try {
    await pythonBackend.start();
  } catch (error) {
    console.warn('Python backend failed to start:', error.message);
  }
  
  // Load historical data
  try {
    const historicalData = await dataProcessing.loadHistoricalData();
    console.log(`📊 Loaded ${historicalData.length} historical records`);
  } catch (error) {
    console.error('Failed to load historical data:', error.message);
  }
}

// Setup all routes
function setupRoutes() {
  // Import route modules
  const apiRoutes = require('./routes/api');
  const thingspeakApiRoutes = require('./routes/api/thingspeak');
  const dataRoutes = require('./routes/data');
  const dashboardRoutes = require('./routes/dashboard');

  // API Routes
  app.use('/api', apiRoutes);
  app.use('/api/thingspeak', thingspeakApiRoutes);
  app.use('/api/data', dataRoutes);
  app.use('/dashboard', dashboardRoutes);

  // Dashboard routes
  app.get('/', (req, res) => {
    res.render('dashboard', { 
      version: require('./package.json').version || '1.0.0'
    });
  });

  app.get('/status', (req, res) => {
    res.render('status');
  });

  app.get('/thingspeak-info', (req, res) => {
    res.render('thingspeak-info');
  });

  app.get('/config', (req, res) => {
    res.render('config', { 
      version: require('./package.json').version || '1.0.0'
    });
  });

  app.get('/lstm', (req, res) => {
    res.render('lstm-dashboard', { 
      version: require('./package.json').version || '1.0.0'
    });
  });
}

// Setup error handling
function setupErrorHandling() {
  // Custom 404 handler
  app.use((req, res, next) => {
    res.status(404).render('error', { 
      title: '404 - Not Found',
      message: `The page ${req.path} was not found.` 
    });
  });

  // Global error handler
  app.use(async (err, req, res, next) => {
    try {
      const errorResult = await errorHandler.handleError(err, 'Express', req);
      res.status(err.status || 500).render('error', {
        title: 'Error',
        message: errorResult.message,
        errorId: errorResult.errorId
      });
    } catch (handlerError) {
      console.error('Error handler failed:', handlerError);
      res.status(500).render('error', {
        title: 'Error',
        message: 'An unexpected error occurred'
      });
    }
  });
}
        // Configuration
const THINGSPEAK_CONFIG = require('./config/thingspeak-consolidated');

// Services
const thingspeakService = require('./services/thingspeak-service');
const thingspeakIntegration = require('./services/thingspeak-integration');

// Routes
const apiRoutes = require('./routes/api');
const thingspeakApiRoutes = require('./routes/api/thingspeak');
const dataRoutes = require('./routes/data');
const dashboardRoutes = require('./routes/dashboard');

// API Routes
app.use('/api', apiRoutes);
app.use('/api/thingspeak', thingspeakApiRoutes);
app.use('/api/data', dataRoutes);
app.use('/dashboard', dashboardRoutes);

// Dashboard routes
app.get('/', (req, res) => {
  res.render('dashboard', { 
    version: require('./package.json').version || '1.0.0'
  });
});

app.get('/status', (req, res) => {
  res.render('status');
});

// ThingSpeak info page
app.get('/thingspeak-info', (req, res) => {
  res.render('thingspeak-info');
});

// Add or update the route for the configuration page
app.get('/config', (req, res) => {
  res.render('config', { 
    version: require('./package.json').version || '1.0.0'
  });
});

// LSTM dashboard page route
app.get('/lstm', (req, res) => {
  res.render('lstm-dashboard', { 
    version: require('./package.json').version || '1.0.0'
  });
});
        } catch (error) {
            health.thingspeak.connection = 'error';
            health.thingspeak.error = error.message;
        }

        const statusCode = health.thingspeak.connection === 'connected' ? 200 : 503;
        res.status(statusCode).json(health);

    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API metrics endpoint
app.get('/api/metrics', (req, res) => {
    try {
        const { getApiMetrics } = require('./middleware/api-monitor');
        const metrics = getApiMetrics();
        
        res.json({
            success: true,
            metrics: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting API metrics:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Dashboard routes
app.get('/', (req, res) => {
  res.render('dashboard', { 
    version: require('./package.json').version || '1.0.0'
  });
});

app.get('/status', (req, res) => {
  res.render('status');
});

// ThingSpeak info page
app.get('/thingspeak-info', (req, res) => {
  res.render('thingspeak-info');
});

// Add or update the route for the configuration page
app.get('/config', (req, res) => {
  res.render('config', { 
    version: require('./package.json').version || '1.0.0'
  });
});

// LSTM dashboard page route
app.get('/lstm', (req, res) => {
  res.render('lstm-dashboard', { 
    version: require('./package.json').version || '1.0.0'
  });
});

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  const pythonStatus = pythonBackend.getStatus();
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      thingspeak: thingspeakService.config.channelId ? 'configured' : 'not configured',
      pythonBackend: pythonStatus.running ? 'running' : 'stopped',
      cache: apiCache.getStats()
    },
    pythonBackend: pythonStatus
  });
});

// Custom 404 handler
app.use((req, res, next) => {
  res.status(404).render('error', { 
    title: '404 - Not Found',
    message: `The page ${req.path} was not found.` 
  });
});

// Error handler
app.use((err, req, res, next) => {
  errorHandler.handleError(err, 'Express', req)
    .then(errorResult => {
      res.status(err.status || 500).render('error', {
        title: 'Error',
        message: errorResult.message,
        errorId: errorResult.errorId
      });
    });
});

// Data storage
let latestData = [];
let historicalData = [];

// Helper function to fetch data from ThingSpeak
async function fetchThingSpeakData(results = 100) {
    try {
        const url = `${THINGSPEAK_CONFIG.BASE_URL}/${THINGSPEAK_CONFIG.CHANNEL_ID}/feeds.json`;
        const params = {
            api_key: THINGSPEAK_CONFIG.API_KEY,
            results: results
        };

        console.log('🔄 Fetching data from ThingSpeak...');
        console.log('URL:', url);
        
        const response = await axios.get(url, { params });
        
        if (response.data && response.data.feeds) {
            console.log(`✅ Fetched ${response.data.feeds.length} records from ThingSpeak`);
            return response.data.feeds;
        } else {
            console.log('⚠️ No feeds data in response');
            return [];
        }
    } catch (error) {
        console.error('❌ Error fetching ThingSpeak data:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
        return [];
    }
}

// Helper function to process and clean data
function processData(rawData) {
    return rawData.map(entry => {
        const processedEntry = {
            timestamp: new Date(entry.created_at),
            temperature: parseFloat(entry.field2) || 0,
            humidity: parseFloat(entry.field1) || 0,
            pm25: parseFloat(entry.field3) || 0,
            pm10: parseFloat(entry.field4) || 0,
            latitude: parseFloat(entry.latitude) || null,
            longitude: parseFloat(entry.longitude) || null
        };

        // Data validation and cleaning
        if (processedEntry.humidity > 100) processedEntry.humidity = 100;
        if (processedEntry.humidity < 0) processedEntry.humidity = 0;
        if (processedEntry.temperature < -50) processedEntry.temperature = -50;
        if (processedEntry.temperature > 60) processedEntry.temperature = 60;
        if (processedEntry.pm25 < 0) processedEntry.pm25 = 0;
        if (processedEntry.pm10 < 0) processedEntry.pm10 = 0;

        return processedEntry;
    }).filter(entry => 
        !isNaN(entry.temperature) && 
        !isNaN(entry.humidity) && 
        !isNaN(entry.pm25) && 
        !isNaN(entry.pm10)
    );
}

// Load historical data from CSV
async function loadHistoricalData() {
    return new Promise((resolve) => {
        const data = [];
        const csvPath = path.join(__dirname, 'data', 'feeds.csv');
        
        if (!fs.existsSync(csvPath)) {
            console.log('⚠️ CSV file not found, starting with empty historical data');
            resolve([]);
            return;
        }

        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                try {
                    const processedRow = {
                        timestamp: new Date(row.created_at),
                        temperature: parseFloat(row.field2) || 0,
                        humidity: parseFloat(row.field1) || 0,
                        pm25: parseFloat(row.field3) || 0,
                        pm10: parseFloat(row.field4) || 0
                    };
                    
                    if (!isNaN(processedRow.temperature) && 
                        !isNaN(processedRow.humidity) && 
                        !isNaN(processedRow.pm25) && 
                        !isNaN(processedRow.pm10)) {
                        data.push(processedRow);
                    }
                } catch (error) {
                    console.log('Skipping invalid row:', row);
                }
            })
            .on('end', () => {
                console.log(`📊 Loaded ${data.length} historical records from CSV`);
                resolve(data.sort((a, b) => a.timestamp - b.timestamp));
            });
    });
}

// Save data to CSV
async function saveDataToCsv(data) {
    const csvPath = path.join(__dirname, 'data', 'feeds_updated.csv');
    
    if (!fs.existsSync(path.dirname(csvPath))) {
        fs.mkdirSync(path.dirname(csvPath), { recursive: true });
    }

    const csvWriter = createCsvWriter({
        path: csvPath,
        header: [
            { id: 'timestamp', title: 'created_at' },
            { id: 'humidity', title: 'field1' },
            { id: 'temperature', title: 'field2' },
            { id: 'pm25', title: 'field3' },
            { id: 'pm10', title: 'field4' }
        ]
    });

    try {
        await csvWriter.writeRecords(data);
        console.log(`💾 Saved ${data.length} records to CSV`);
    } catch (error) {
        console.error('❌ Error saving to CSV:', error);
    }
}

// API Routes

// Get latest data
app.get('/api/latest', (req, res) => {
    if (latestData.length > 0) {
        const latest = latestData[latestData.length - 1];
        res.json({
            success: true,
            data: latest,
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(404).json({
            success: false,
            message: 'No data available'
        });
    }
});

// Get historical data with optional filtering
app.get('/api/historical', (req, res) => {
    let data = [...historicalData];
    
    // Apply filters
    const { hours, limit } = req.query;
    
    if (hours) {
        const hoursAgo = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);
        data = data.filter(entry => entry.timestamp >= hoursAgo);
    }
    
    if (limit) {
        data = data.slice(-parseInt(limit));
    }
    
    res.json({
        success: true,
        data: data,
        count: data.length
    });
});

// Get data statistics
app.get('/api/stats', (req, res) => {
    if (historicalData.length === 0) {
        return res.status(404).json({
            success: false,
            message: 'No data available for statistics'
        });
    }

    const calculateStats = (values) => {
        const valid = values.filter(v => !isNaN(v) && v !== null);
        if (valid.length === 0) return { min: 0, max: 0, avg: 0, count: 0 };
        
        return {
            min: Math.min(...valid),
            max: Math.max(...valid),
            avg: valid.reduce((a, b) => a + b, 0) / valid.length,
            count: valid.length
        };
    };

    const recentData = historicalData.slice(-100); // Last 100 readings
    
    const stats = {
        temperature: calculateStats(recentData.map(d => d.temperature)),
        humidity: calculateStats(recentData.map(d => d.humidity)),
        pm25: calculateStats(recentData.map(d => d.pm25)),
        pm10: calculateStats(recentData.map(d => d.pm10)),
        totalRecords: historicalData.length,
        lastUpdated: latestData.length > 0 ? latestData[latestData.length - 1].timestamp : null
    };

    res.json({
        success: true,
        stats: stats
    });
});

// Force refresh data from ThingSpeak
app.post('/api/refresh', async (req, res) => {
    try {
        console.log('🔄 Manual refresh requested...');
        await updateData();
        res.json({
            success: true,
            message: 'Data refreshed successfully',
            dataCount: latestData.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error refreshing data',
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        dataCount: historicalData.length,
        lastUpdate: latestData.length > 0 ? latestData[latestData.length - 1].timestamp : null
    });
});

// Serve the main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Main data update function
async function updateData() {
    try {
        // Fetch fresh data from ThingSpeak
        const rawData = await fetchThingSpeakData(200);
        
        if (rawData.length > 0) {
            // Process the data
            const processedData = processData(rawData);
            
            // Update latest data
            latestData = processedData;
            
            // Merge with historical data (remove duplicates)
            const existingTimestamps = new Set(historicalData.map(d => d.timestamp.getTime()));
            const newData = processedData.filter(d => !existingTimestamps.has(d.timestamp.getTime()));
            
            if (newData.length > 0) {
                historicalData = [...historicalData, ...newData]
                    .sort((a, b) => a.timestamp - b.timestamp);
                
                // Keep only last 10000 records to prevent memory issues
                if (historicalData.length > 10000) {
                    historicalData = historicalData.slice(-10000);
                }
                
                console.log(`📈 Added ${newData.length} new records. Total: ${historicalData.length}`);
                
                // Save updated data
                await saveDataToCsv(historicalData);
            } else {
                console.log('📊 No new data to add');
            }
        } else {
            console.log('⚠️ No data received from ThingSpeak');
        }
    } catch (error) {
        console.error('❌ Error updating data:', error);
    }
}

// Initialize server
async function initializeServer() {
    console.log('🚀 Initializing Air Quality Monitoring Server...');
    
    // Load historical data
    historicalData = await loadHistoricalData();
    
    // Initial data fetch
    await updateData();
    
    // Set up periodic data updates (every 5 minutes)
    setInterval(updateData, 5 * 60 * 1000);
}

// Error handling
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('SIGINT signal received: shutting down gracefully');
    try {
        await pythonBackend.stop();
        console.log('Python backend stopped successfully');
    } catch (error) {
        console.error('Error stopping Python backend:', error.message);
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: shutting down gracefully');
    try {
        await pythonBackend.stop();
        console.log('Python backend stopped successfully');
    } catch (error) {
        console.error('Error stopping Python backend:', error.message);
    }
    process.exit(0);
});

// Start the server
app.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 View dashboard at http://localhost:${PORT}/`);
    console.log(`🔧 API endpoints:`);
    console.log(`  - GET /api/latest - Latest readings`);
    console.log(`  - GET /api/historical - Historical data`);
    console.log(`  - GET /api/stats - Data statistics`);
    console.log(`  - POST /api/refresh - Manual refresh`);
    console.log(`  - GET /api/health - Health check`);
    
    // Log ThingSpeak configuration
    console.log('📡 ThingSpeak Configuration:');
    console.log(`- Channel ID: ${thingspeakService.config.channelId}`);
    console.log(`- Read API Key: ${thingspeakService.config.readApiKey ? '***' + thingspeakService.config.readApiKey.slice(-4) : 'Not configured'}`);
    
    // Initialize Python backend
    await initializePythonBackend();
});