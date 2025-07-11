/**
 * Air Quality Monitoring System - Main Server
 * Consolidated and properly structured server implementation
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');

// Import dependency manager and route consolidator
const dependencyManager = require('./services/dependency-manager');
const routeConsolidator = require('./services/route-consolidator');

// Use dependency manager for safe imports
const cors = dependencyManager.safeRequire('cors');
const helmet = dependencyManager.safeRequire('helmet');
const compression = dependencyManager.safeRequire('compression');
const { Server: SocketIOServer } = dependencyManager.safeRequire('socket.io');

// Import core services
const appState = require('./services/app-state');
const thingspeakService = require('./services/thingspeak-service');
const dataProcessingService = require('./services/data-processing-service');
const ErrorHandler = require('./error-handler');

// Create error handler instance
const errorHandler = new ErrorHandler();

// Import middleware with fallback
let apiMonitor;
try {
    apiMonitor = require('./middleware/api-monitor').apiMonitor;
} catch (error) {
    console.warn('⚠️  API Monitor middleware not available, using fallback');
    apiMonitor = (req, res, next) => next();
}

// Configuration
const THINGSPEAK_CONFIG = require('./config/thingspeak-consolidated');

class AirQualityServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        
        // Initialize Socket.IO with fallback
        try {
            this.io = new SocketIOServer(this.server, {
                cors: {
                    origin: "*",
                    methods: ["GET", "POST"]
                }
            });
        } catch (error) {
            console.warn('⚠️  WebSocket functionality disabled - Socket.IO not available');
            this.io = null;
        }
        
        this.PORT = process.env.PORT || 3000;
        
        // Data update intervals
        this.dataUpdateInterval = null;
        this.isRunning = false;
        
        // Dependency check on startup
        this.checkAndInstallDependencies();
    }

    /**
     * Check and install missing dependencies
     */
    async checkAndInstallDependencies() {
        console.log('🔍 Checking dependencies...');
        
        const depStatus = dependencyManager.checkDependencies();
        if (depStatus.missing.length > 0) {
            console.warn(`⚠️  Missing ${depStatus.missing.length} dependencies:`, depStatus.missing);
            
            if (process.env.AUTO_INSTALL_DEPS !== 'false') {
                try {
                    await dependencyManager.installMissingDependencies();
                } catch (error) {
                    console.warn('⚠️  Could not auto-install dependencies:', error.message);
                    console.log('💡 Please run: npm install');
                }
            }
        } else {
            console.log('✅ All dependencies available');
        }
    }

    /**
     * Initialize the server with all middleware and services
     */
    async initialize() {
        console.log('🚀 Initializing Air Quality Monitoring Server...');
        
        try {
            // Initialize app state first
            await this.initializeAppState();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Initialize services
            await this.initializeServices();
            
            // Setup routes using route consolidator
            this.setupRoutes();
            
            // Setup WebSocket handlers
            this.setupWebSocket();
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Create required directories
            await this.createRequiredDirectories();
            
            console.log('✅ Server initialization complete');
            return true;
        } catch (error) {
            console.error('❌ Server initialization failed:', error);
            await errorHandler.handleError(error, 'ServerInitialization');
            return false;
        }
    }

    /**
     * Initialize application state
     */
    async initializeAppState() {
        console.log('🔧 Initializing application state...');
        
        // Set configuration
        appState.setConfig(THINGSPEAK_CONFIG);
        
        // Try to load previous state
        await appState.loadState();
        
        // Initialize the state
        await appState.initialize();
        
        // Start monitoring services
        appState.startDataQualityMonitoring();
        appState.startPerformanceMonitoring();
        
        console.log('✅ Application state initialized');
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        console.log('🔧 Setting up middleware...');
        
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:"],
                    fontSrc: ["'self'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"]
                }
            }
        }));
        
        // Performance middleware
        this.app.use(compression());
        
        // CORS
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            credentials: true
        }));
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Static files
        this.app.use(express.static(path.join(__dirname, 'public'), {
            maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
            etag: true
        }));
        
        // API monitoring
        this.app.use(apiMonitor);
        
        // View engine
        this.app.set('view engine', 'ejs');
        this.app.set('views', path.join(__dirname, 'views'));
        
        console.log('✅ Middleware setup complete');
    }

    /**
     * Initialize all services
     */
    async initializeServices() {
        console.log('🔧 Initializing services...');
        
        try {
            // Register services with app state
            appState.registerService('thingspeakService', thingspeakService, {
                healthCheck: () => thingspeakService.testConnection()
            });
            
            appState.registerService('dataProcessingService', dataProcessingService, {
                healthCheck: () => Promise.resolve(true)
            });
            
            appState.registerService('errorHandler', errorHandler, {
                healthCheck: () => Promise.resolve(true)
            });
            
            // Test ThingSpeak connection
            const connectionTest = await thingspeakService.testConnection();
            if (connectionTest.success) {
                console.log('✅ ThingSpeak service connected');
            } else {
                console.warn('⚠️  ThingSpeak service connection failed');
            }
            
            // Set up data update function
            appState.setUpdateDataFunction(async () => {
                return await this.updateData();
            });
            
            console.log('✅ Services initialized');
        } catch (error) {
            console.error('❌ Service initialization failed:', error);
            throw error;
        }
    }    /**
     * Setup all routes using the route consolidator
     */
    setupRoutes() {
        console.log('🔧 Setting up routes...');
        
        try {
            // Use route consolidator for centralized route management
            const routesRegistered = routeConsolidator.registerRoutes(this.app);
            
            if (routesRegistered) {
                console.log('✅ Routes setup complete via consolidator');
            } else {
                console.warn('⚠️  Route consolidator failed, setting up fallback routes');
                this.setupFallbackRoutes();
            }
            
        } catch (error) {
            console.error('❌ Route setup failed:', error.message);
            console.log('🔄 Setting up minimal fallback routes...');
            this.setupFallbackRoutes();
        }
    }

    /**
     * Setup minimal fallback routes if consolidator fails
     */
    setupFallbackRoutes() {
        // Basic API routes with error handling
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Air Quality Monitoring API',
                version: '2.0.0',
                status: 'operational',
                timestamp: new Date().toISOString()
            });
        });
        
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
                services: {
                    thingspeak: 'unknown',
                    dataProcessing: 'unknown',
                    appState: 'operational'
                }
            });
        });
        
        this.app.get('/api/latest', async (req, res) => {
            try {
                const latest = appState.getLatestData();
                res.json({
                    success: true,
                    data: latest,
                    count: latest.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Basic home page
        this.app.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Air Quality Monitor</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
                        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        h1 { color: #333; text-align: center; }
                        .status { text-align: center; margin: 20px 0; padding: 15px; background: #d4edda; border-radius: 5px; }
                        .nav { display: flex; gap: 20px; justify-content: center; margin: 30px 0; flex-wrap: wrap; }
                        .nav a { padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
                        .nav a:hover { background: #0056b3; }
                        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🌬️ Air Quality Monitoring System</h1>
                        <div class="status">
                            <p>✅ Server is running in minimal mode</p>
                            <p>Server uptime: ${Math.floor(process.uptime())} seconds</p>
                        </div>
                        <div class="warning">
                            <strong>⚠️  Notice:</strong> Running with minimal routes due to missing components. Some features may be unavailable.
                        </div>
                        <div class="nav">
                            <a href="/api">API Info</a>
                            <a href="/api/health">Health Check</a>
                            <a href="/api/latest">Latest Data</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        });
        
        console.log('✅ Fallback routes setup complete');
    }

    /**
     * Setup web page routes
     */
    setupWebRoutes() {
        const pkg = require('./package.json');
        
        // Main dashboard
        this.app.get('/', (req, res) => {
            res.render('dashboard', { 
                title: 'Air Quality Monitoring Dashboard',
                version: pkg.version || '1.0.0'
            });
        });
        
        // Status page
        this.app.get('/status', (req, res) => {
            res.render('status', {
                title: 'System Status',
                version: pkg.version || '1.0.0'
            });
        });
        
        // Configuration page
        this.app.get('/config', (req, res) => {
            res.render('config', {
                title: 'Configuration',
                version: pkg.version || '1.0.0'
            });
        });
        
        // ThingSpeak info page
        this.app.get('/thingspeak-info', (req, res) => {
            res.render('thingspeak-info', {
                title: 'ThingSpeak Information',
                version: pkg.version || '1.0.0'
            });
        });
        
        // LSTM dashboard
        this.app.get('/lstm', (req, res) => {
            res.render('lstm-dashboard', {
                title: 'LSTM Predictions',
                version: pkg.version || '1.0.0'
            });
        });
        
        // Analytics page
        this.app.get('/analytics', (req, res) => {
            res.render('analytics', {
                title: 'Data Analytics',
                version: pkg.version || '1.0.0'
            });
        });
    }    /**
     * Setup WebSocket connections
     */
    setupWebSocket() {
        if (!this.io) {
            console.log('⚠️  WebSocket functionality disabled - Socket.IO not available');
            return;
        }
        
        console.log('🔧 Setting up WebSocket connections...');
        
        this.io.on('connection', (socket) => {
            console.log(`📡 Client connected: ${socket.id}`);
            
            // Send current data to new client
            const latestData = appState.getLatestData();
            if (latestData.length > 0) {
                socket.emit('dataUpdate', {
                    type: 'latest',
                    data: latestData[latestData.length - 1],
                    timestamp: new Date().toISOString()
                });
            }
            
            // Handle data requests
            socket.on('requestData', (options) => {
                try {
                    const data = appState.getHistoricalData(options);
                    socket.emit('dataResponse', {
                        success: true,
                        data: data,
                        count: data.length
                    });
                } catch (error) {
                    socket.emit('dataResponse', {
                        success: false,
                        error: error.message
                    });
                }
            });
            
            // Handle manual refresh requests
            socket.on('refreshData', async () => {
                try {
                    await this.updateData();
                    socket.emit('refreshComplete', { success: true });
                } catch (error) {
                    socket.emit('refreshComplete', { 
                        success: false, 
                        error: error.message 
                    });
                }
            });
            
            socket.on('disconnect', () => {
                console.log(`📡 Client disconnected: ${socket.id}`);
            });
        });
        
        // Listen for app state events and broadcast to clients
        appState.on('dataUpdate', (data) => {
            if (this.io) {
                this.io.emit('dataUpdate', data);
            }
        });
        
        appState.on('dataQualityUpdate', (quality) => {
            if (this.io) {
                this.io.emit('dataQualityUpdate', quality);
            }
        });
        
        appState.on('performanceUpdate', (performance) => {
            if (this.io) {
                this.io.emit('performanceUpdate', performance);
            }
        });
        
        console.log('✅ WebSocket setup complete');
    }

    /**
     * Setup error handling
     */
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res, next) => {
            res.status(404).render('error', {
                title: '404 - Page Not Found',
                message: `The page ${req.path} was not found.`,
                statusCode: 404
            });
        });
        
        // Global error handler
        this.app.use(async (err, req, res, next) => {
            console.error('Express Error:', err);
            
            try {
                const errorResult = await errorHandler.handleError(err, 'Express', {
                    url: req.url,
                    method: req.method,
                    ip: req.ip
                });
                
                // Record the error in app state
                appState.addError(err);
                
                if (req.xhr || req.headers.accept?.includes('application/json')) {
                    // API request
                    res.status(err.status || 500).json({
                        success: false,
                        error: errorResult.message,
                        errorId: errorResult.errorId,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    // Web request
                    res.status(err.status || 500).render('error', {
                        title: 'Error',
                        message: errorResult.message,
                        errorId: errorResult.errorId,
                        statusCode: err.status || 500
                    });
                }
            } catch (handlerError) {
                console.error('Error handler failed:', handlerError);
                res.status(500).json({
                    success: false,
                    error: 'An unexpected error occurred',
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    /**
     * Create required directories
     */
    async createRequiredDirectories() {
        const directories = [
            'data',
            'data/exports',
            'data/uploads',
            'data/state',
            'logs'
        ];
        
        for (const dir of directories) {
            try {
                const fs = require('fs').promises;
                await fs.mkdir(path.join(__dirname, dir), { recursive: true });
            } catch (error) {
                console.warn(`Warning: Could not create directory ${dir}:`, error.message);
            }
        }
    }

    /**
     * Update data from ThingSpeak
     */
    async updateData() {
        const startTime = Date.now();
        
        try {
            console.log('🔄 Updating data from ThingSpeak...');
              // Fetch latest data
            const latestResponse = await thingspeakService.getLatestFeed();
            if (latestResponse.success && latestResponse.data) {
                appState.setLatestData([latestResponse.data]);
                console.log('✅ Latest data updated');
            }
            
            // Fetch historical data (last 100 records)
            const historicalResponse = await thingspeakService.getChannelData({ results: 100 });
            if (historicalResponse.success && historicalResponse.data) {
                const processedData = dataProcessingService.processThingSpeakData(historicalResponse.data);
                appState.setHistoricalData(processedData);
                console.log(`✅ Historical data updated (${processedData.length} records)`);
            }
            
            // Record performance
            const responseTime = Date.now() - startTime;
            appState.recordRequest(responseTime, false);
            
            return {
                success: true,
                latestCount: appState.getLatestData().length,
                historicalCount: appState.getHistoricalData().length,
                responseTime
            };
            
        } catch (error) {
            console.error('❌ Data update failed:', error);
            
            // Record error
            const responseTime = Date.now() - startTime;
            appState.recordRequest(responseTime, true);
            appState.addError(error);
            
            await errorHandler.handleError(error, 'DataUpdate');
            throw error;
        }
    }

    /**
     * Start the server
     */
    async start() {
        try {
            const initialized = await this.initialize();
            if (!initialized) {
                throw new Error('Server initialization failed');
            }
            
            this.server.listen(this.PORT, () => {
                this.isRunning = true;
                
                console.log('🎉 Air Quality Monitoring Server Started!');
                console.log('='.repeat(50));
                console.log(`🚀 Server running on port ${this.PORT}`);
                console.log(`📊 Dashboard: http://localhost:${this.PORT}/`);
                console.log(`🔧 API Base: http://localhost:${this.PORT}/api`);
                console.log(`📡 WebSocket: ws://localhost:${this.PORT}`);
                console.log('='.repeat(50));
                console.log('📋 Available endpoints:');
                console.log('  📊 GET / - Main Dashboard');
                console.log('  📈 GET /status - System Status');
                console.log('  ⚙️  GET /config - Configuration');
                console.log('  🔗 GET /thingspeak-info - ThingSpeak Info');
                console.log('  🤖 GET /lstm - LSTM Predictions');
                console.log('  📊 GET /analytics - Data Analytics');
                console.log('  🔗 GET /api/health - Health Check');
                console.log('  📊 GET /api/latest - Latest Data');
                console.log('  📈 GET /api/historical - Historical Data');
                console.log('  ⚙️  GET /api/config - Configuration API');
                console.log('='.repeat(50));
                
                // Start data updates
                this.startDataUpdates();
                
                // Perform initial data update
                this.updateData().catch(error => {
                    console.warn('⚠️  Initial data update failed:', error.message);
                });
            });
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    /**
     * Start periodic data updates
     */
    startDataUpdates() {
        const updateInterval = THINGSPEAK_CONFIG.SETTINGS?.UPDATE_INTERVAL || 60000;
        
        this.dataUpdateInterval = setInterval(async () => {
            try {
                await this.updateData();
            } catch (error) {
                console.error('⚠️  Scheduled data update failed:', error.message);
            }
        }, updateInterval);
        
        console.log(`🔄 Data updates scheduled every ${updateInterval / 1000} seconds`);
    }

    /**
     * Stop the server gracefully
     */
    async stop() {
        console.log('🛑 Stopping server gracefully...');
        
        this.isRunning = false;
        
        // Clear intervals
        if (this.dataUpdateInterval) {
            clearInterval(this.dataUpdateInterval);
        }
        
        // Close server
        return new Promise((resolve) => {
            this.server.close(() => {
                console.log('✅ Server stopped');
                resolve();
            });
        });
    }
}

// Create and start server
const server = new AirQualityServer();

// Graceful shutdown handling
process.on('SIGINT', async () => {
    console.log('\n📤 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n📤 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    errorHandler.handleError(new Error(`Unhandled Rejection: ${reason}`), 'UnhandledRejection')
        .catch(console.error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    errorHandler.handleError(error, 'UncaughtException')
        .then(() => process.exit(1))
        .catch(() => process.exit(1));
});

// Start the server
if (require.main === module) {
    server.start();
}

module.exports = { AirQualityServer, server };
