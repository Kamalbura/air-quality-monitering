require('dotenv').config(); // Make sure this is at the top to load environment variables

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const NodeCache = require('node-cache');
const thingspeakService = require('./services/thingspeak-service');
const { apiMonitor } = require('./middleware/api-monitor');
const apiRoutes = require('./routes/api');
const thingspeakRoutes = require('./routes/api/thingspeak');
const ErrorHandler = require('./error-handler');
const debugHelper = require('./helpers/debug-helper');

// Initialize error handler
const errorHandler = new ErrorHandler();

// Configure cache with 10 minute TTL
const apiCache = new NodeCache({ stdTTL: 600 });
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Change the static file handling to ignore index.html
app.use(express.static(path.join(__dirname, 'public'), {
  index: false  // Don't serve index.html automatically
}));
app.use(apiMonitor); // API monitoring middleware

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Create necessary directories if they don't exist
const requiredDirs = [
  path.join(__dirname, 'data'),
  path.join(__dirname, 'public', 'images'),
  path.join(__dirname, 'logs'),
  path.join(__dirname, 'config'),
  path.join(__dirname, 'dump') // Add the dump directory to required directories
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

// Routes
app.use('/api', apiRoutes);
app.use('/api/thingspeak', thingspeakRoutes); // Register dedicated ThingSpeak routes

// Add route to serve CSV files directly
app.use('/data', express.static(path.join(__dirname, 'data')));

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString() 
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`View dashboard at http://localhost:${PORT}/`);
  
  // Log ThingSpeak configuration
  console.log('ThingSpeak Configuration:');
  console.log(`- Channel ID: ${thingspeakService.config.channelId}`);
  console.log(`- Read API Key: ${thingspeakService.config.readApiKey ? '***' + thingspeakService.config.readApiKey.slice(-4) : 'Not configured'}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: shutting down gracefully');
  // Perform any cleanup operations here
  process.exit(0);
});