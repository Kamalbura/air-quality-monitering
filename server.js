require('dotenv').config(); // Make sure this is at the top to load environment variables

const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { PythonShell } = require('python-shell');
const NodeCache = require('node-cache');
const thingspeakService = require('./services/thingspeak-service');
const { apiMonitor } = require('./middleware/api-monitor');
const apiRoutes = require('./routes/api');
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

// Check if Python is available - properly fixed version
let pythonAvailable = false;
function checkPython() {
  try {
    // Create a temporary script file for Python to execute
    const tempScriptPath = path.join(__dirname, 'python', 'check_python.py');
    if (!fs.existsSync(path.dirname(tempScriptPath))) {
      fs.mkdirSync(path.dirname(tempScriptPath), { recursive: true });
    }
    
    // Write a simple Python script that prints a test message
    fs.writeFileSync(tempScriptPath, 'print("Python OK")\n');
    
    const options = {
      mode: 'text',
      pythonPath: 'python',
      scriptPath: path.dirname(tempScriptPath)
    };
    
    PythonShell.run(path.basename(tempScriptPath), options)
      .then(results => {
        if (results && results.length > 0 && results[0].includes('Python OK')) {
          console.log('Python is available: Visualization features enabled');
          pythonAvailable = true;
        } else {
          console.warn('Python check returned unexpected result - visualization may be limited');
        }
        
        // Clean up the temporary script
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (err) {
          // Ignore cleanup errors
        }
      })
      .catch(err => {
        console.warn('Python not available: Visualization features will be limited');
        console.warn(err.message);
        
        // Clean up the temporary script
        try {
          fs.unlinkSync(tempScriptPath);
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
      });
  } catch (error) {
    console.warn('Python not available: Visualization features will be limited');
    console.warn(error.message);
  }
}

// Call the Python check function
checkPython();

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

// Routes
app.use('/api', apiRoutes);

// Add route to serve CSV files directly
app.use('/data', express.static(path.join(__dirname, 'data')));

// Dashboard routes
app.get('/', (req, res) => {
  res.render('dashboard', { 
    pythonAvailable: pythonAvailable,
    version: require('./package.json').version || '1.0.0'
  });
});

app.get('/status', (req, res) => {
  res.render('status', {
    pythonAvailable: pythonAvailable
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
        message: errorResult.message || err.message || 'An error occurred',
        errorId: errorResult.errorId
      });
    })
    .catch(handlerError => {
      console.error('Error handler failed:', handlerError);
      res.status(500).render('error', {
        title: 'System Error',
        message: err.message || 'A system error occurred'
      });
    });
});

// Fix the port selection logic with correct port increment
function findAvailablePort(startPort) {
  let port = startPort;

  const tryPort = (portToTry) => {
    console.log(`Attempting to start server on port ${portToTry}...`);

    const server = app.listen(portToTry)
      .on('listening', () => {
        console.log(`Server running on http://localhost:${portToTry}`);
        console.log(`Dashboard available at http://localhost:${portToTry}`);
        console.log(`System status at http://localhost:${portToTry}/status`);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
          console.log('Shutting down server gracefully...');
          server.close(() => {
            console.log('Server stopped');
            process.exit(0);
          });

          // Force exit if graceful shutdown takes too long
          setTimeout(() => {
            console.error('Forcing server shutdown');
            process.exit(1);
          }, 10000); // 10 seconds
        });
      })
      .on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Fix: Add 1 to port, not 10001
          const nextPort = portToTry + 1;
          console.log(`Port ${portToTry} is already in use, trying ${nextPort}...`);
          // Close and retry with the next port
          tryPort(nextPort);
        } else {
          console.error('Failed to start server:', err.message);
          process.exit(1); // Exit if the error is not related to port usage
        }
      });
  };

  tryPort(port);
}

// Start the server with automatic port selection
findAvailablePort(PORT);

module.exports = app;