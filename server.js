require('dotenv').config(); // Make sure this is at the top to load environment variables

/**
 * Main application server for Air Quality Monitoring System
 */
const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const fs = require('fs');
const NodeCache = require('node-cache');
const thingspeakService = require('./services/thingspeak-service');
const { apiMonitor } = require('./middleware/api-monitor');
const apiRoutes = require('./routes/api');
const ErrorHandler = require('./error-handler');
const debugHelper = require('./helpers/debug-helper');
const csvDataService = require('./services/csv-data-service');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create error handler instance
const errorHandler = new ErrorHandler();

// Configure cache with 10 minute TTL
const apiCache = new NodeCache({ stdTTL: 600 });

// Basic security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"]
    }
  }
}));

// Enable CORS
app.use(cors());

// Compress responses
app.use(compression());

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  index: false  // Don't serve index.html automatically
}));

// API monitoring middleware
app.use(apiMonitor);

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Create necessary directories if they don't exist
const requiredDirs = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'public', 'images'),
  path.join(__dirname, 'logs')
];

requiredDirs.forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err.message);
    // Don't exit - continue with startup and handle missing directories gracefully
  }
});

// API routes
app.use('/api', apiRoutes);

// Add route to serve CSV files directly
app.use('/data', express.static(path.join(__dirname, 'data')));

// Main dashboard route
app.get('/', (req, res) => {
  res.render('dashboard', { 
    version: require('./package.json').version || '1.0.0'
  });
});

// Status page
app.get('/status', (req, res) => {
  res.render('status', { title: 'System Status' });
});

// ThingSpeak Info page
app.get('/thingspeak-info', (req, res) => {
  res.render('thingspeak-info', { title: 'ThingSpeak Information' });
});

// Data sources info route
app.get('/data-sources', async (req, res) => {
  try {
    // Check CSV file availability
    const csvInfo = csvDataService.getCsvFileInfo();
    
    res.render('data-sources', { 
      title: 'Data Sources',
      csvInfo: csvInfo
    });
  } catch (error) {
    const errorResponse = await errorHandler.handleError(error, 'Data Sources Page', req);
    res.status(500).render('error', {
      title: 'Error',
      message: 'Failed to load data sources information',
      errorId: errorResponse.errorId
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString() 
  });
});

// Error handling middleware
app.use(async (err, req, res, next) => {
  const errorResponse = await errorHandler.handleError(err, 'Express', req);
  
  // Render error page for HTML requests
  if (req.accepts('html')) {
    return res.status(err.status || 500).render('error', {
      title: 'Error',
      message: err.message || 'An unexpected error occurred',
      errorId: errorResponse.errorId
    });
  }
  
  // Return JSON for API requests
  return res.status(err.status || 500).json(errorResponse);
});

// Handle 404
app.use(async (req, res) => {
  if (req.accepts('html')) {
    return res.status(404).render('error', {
      title: 'Page Not Found',
      message: 'The requested page does not exist.'
    });
  }
  
  return res.status(404).json({ 
    error: true, 
    message: 'Resource not found' 
  });
});

// Check if data directory and CSV file exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  debugHelper.log('Creating data directory...', 'server');
  fs.mkdirSync(dataDir, { recursive: true });
}

// Check if feeds.csv exists
const csvExists = csvDataService.doesDefaultFileExist();
debugHelper.log(`CSV data file exists: ${csvExists}`, 'server');

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Data source: ${csvExists ? 'Local CSV file available' : 'Will use ThingSpeak API'}`);
  console.log(`View dashboard at http://localhost:${PORT}/`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: shutting down gracefully');
  // Perform any cleanup operations here
  process.exit(0);
});