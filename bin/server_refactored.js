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

// Configuration
const THINGSPEAK_CONFIG = require('./config/thingspeak-consolidated');

// Application state
let latestData = [];
let historicalData = [];

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
    historicalData = await dataProcessing.loadHistoricalData();
    console.log(`📊 Loaded ${historicalData.length} historical records`);
  } catch (error) {
    console.error('Failed to load historical data:', error.message);
  }
  
  // Initial data fetch
  await updateData();
  
  // Set up periodic data updates (every 5 minutes)
  setInterval(updateData, 5 * 60 * 1000);
}

// Main data update function
async function updateData() {
  try {
    // Fetch fresh data from ThingSpeak
    const rawData = await thingspeakService.fetchData(200);
    
    if (rawData.length > 0) {
      // Process the data
      const processedData = dataProcessing.processThingSpeakData(rawData);
      
      // Update latest data
      latestData = processedData;
      
      // Merge with historical data
      historicalData = dataProcessing.mergeData(historicalData, processedData);
      
      console.log(`📈 Updated data. Total records: ${historicalData.length}`);
      
      // Save updated data
      await dataProcessing.saveDataToCsv(historicalData);
    } else {
      console.log('⚠️ No data received from ThingSpeak');
    }
  } catch (error) {
    console.error('❌ Error updating data:', error);
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

  // Simple API endpoints (will be consolidated with route modules later)
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

  app.get('/api/historical', (req, res) => {
    const { hours, limit } = req.query;
    const data = dataProcessing.filterByTimeRange(historicalData, hours, limit);
    
    res.json({
      success: true,
      data: data,
      count: data.length
    });
  });

  app.get('/api/stats', (req, res) => {
    if (historicalData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data available for statistics'
      });
    }

    const stats = dataProcessing.calculateStatistics(historicalData, true);
    stats.lastUpdated = latestData.length > 0 ? latestData[latestData.length - 1].timestamp : null;

    res.json({
      success: true,
      stats: stats
    });
  });

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

  app.get('/api/health', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        services: {
          thingspeak: thingspeakService.config?.channelId ? 'configured' : 'not configured',
          pythonBackend: pythonBackend.getStatus().running ? 'running' : 'stopped',
          cache: apiCache.getStats()
        },
        dataCount: historicalData.length,
        lastUpdate: latestData.length > 0 ? latestData[latestData.length - 1].timestamp : null
      };

      // Test ThingSpeak connection
      try {
        const connectionTest = await thingspeakService.testConnection();
        health.services.thingspeak = connectionTest.success ? 'connected' : 'failed';
      } catch (error) {
        health.services.thingspeak = 'error';
        health.services.thingspeakError = error.message;
      }

      const statusCode = health.services.thingspeak === 'connected' ? 200 : 503;
      res.status(statusCode).json(health);

    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get('/api/config', (req, res) => {
    try {
      const config = {
        thingspeak: {
          channelId: THINGSPEAK_CONFIG.CHANNEL?.ID,
          readApiKey: THINGSPEAK_CONFIG.API?.READ_KEY,
          updateInterval: THINGSPEAK_CONFIG.SETTINGS?.UPDATE_INTERVAL,
          fieldsMapping: THINGSPEAK_CONFIG.FIELDS
        },
        app: {
          name: 'Air Quality Monitoring System',
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting configuration:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

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

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
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
  console.log(`  - GET /api/config - Configuration`);
  console.log(`  - GET /api/metrics - API metrics`);
  
  // Initialize the application
  await initializeApp();
  
  console.log('✅ Server initialization complete');
});
