/**
 * Route Consolidation Module
 * Centralized route registration and management for the Air Quality Monitoring System
 */
const express = require('express');
const path = require('path');

class RouteConsolidator {
    constructor() {
        this.registeredRoutes = new Map();
        this.healthChecks = new Map();
    }

    /**
     * Register all routes with the Express app
     * @param {Express} app - Express application instance
     */
    registerRoutes(app) {
        try {
            // API Routes
            this.registerAPIRoutes(app);
            
            // Web Routes (HTML pages)
            this.registerWebRoutes(app);
            
            // Static file serving
            this.registerStaticRoutes(app);
            
            // Health check and diagnostics
            this.registerDiagnosticRoutes(app);
            
            console.log('✅ All routes registered successfully');
            return true;
        } catch (error) {
            console.error('❌ Route registration failed:', error.message);
            return false;
        }
    }

    /**
     * Register API routes
     */
    registerAPIRoutes(app) {
        // Load route modules safely
        const routes = this.loadRouteModules([
            { path: '../routes/api-consolidated', prefix: '/api' },
            { path: '../routes/data-routes', prefix: '/api/data' },
            { path: '../routes/config-routes', prefix: '/api/config' },
            { path: '../routes/diagnostics-routes', prefix: '/api/diagnostics' }
        ]);

        routes.forEach(({ router, prefix, name }) => {
            if (router) {
                app.use(prefix, router);
                this.registeredRoutes.set(prefix, { name, loaded: true });
                console.log(`✅ Registered API route: ${prefix}`);
            } else {
                console.warn(`⚠️  Failed to load route: ${name}`);
                this.registeredRoutes.set(prefix, { name, loaded: false });
            }
        });

        // Additional API endpoints
        this.registerCoreAPIEndpoints(app);
    }

    /**
     * Register web (HTML) routes
     */
    registerWebRoutes(app) {
        try {
            const webRouter = require('../routes/web');
            app.use('/', webRouter);
            this.registeredRoutes.set('/', { name: 'web', loaded: true });
            console.log('✅ Registered web routes');
        } catch (error) {
            console.warn('⚠️  Web routes not available:', error.message);
            this.registerFallbackWebRoutes(app);
        }
    }

    /**
     * Register static file routes
     */
    registerStaticRoutes(app) {
        // Public static files
        app.use('/public', express.static(path.join(__dirname, '..', 'public')));
        app.use('/data', express.static(path.join(__dirname, '..', 'data')));
        app.use('/uploads', express.static(path.join(__dirname, '..', 'data', 'uploads')));
        
        // Legacy static routes for compatibility
        app.use('/css', express.static(path.join(__dirname, '..', 'public', 'css')));
        app.use('/js', express.static(path.join(__dirname, '..', 'public', 'js')));
        app.use('/images', express.static(path.join(__dirname, '..', 'public', 'images')));
        
        console.log('✅ Registered static file routes');
    }

    /**
     * Register diagnostic and health check routes
     */
    registerDiagnosticRoutes(app) {
        // System health endpoint
        app.get('/health', (req, res) => {
            const health = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                routes: Object.fromEntries(this.registeredRoutes),
                services: this.getServiceStatus()
            };
            res.json(health);
        });

        // Route discovery endpoint
        app.get('/routes', (req, res) => {
            const routes = Array.from(this.registeredRoutes.entries()).map(([path, info]) => ({
                path,
                ...info
            }));
            res.json({ routes });
        });

        // System info endpoint
        app.get('/system/info', (req, res) => {
            res.json({
                node_version: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                pid: process.pid
            });
        });

        console.log('✅ Registered diagnostic routes');
    }

    /**
     * Register core API endpoints
     */
    registerCoreAPIEndpoints(app) {
        // Basic API info
        app.get('/api', (req, res) => {
            res.json({
                name: 'Air Quality Monitoring API',
                version: '2.0.0',
                endpoints: Array.from(this.registeredRoutes.keys()).filter(k => k.startsWith('/api')),
                timestamp: new Date().toISOString()
            });
        });

        // API status endpoint
        app.get('/api/status', (req, res) => {
            res.json({
                status: 'operational',
                services: this.getServiceStatus(),
                timestamp: new Date().toISOString()
            });
        });
    }

    /**
     * Register fallback web routes if main web router fails
     */
    registerFallbackWebRoutes(app) {
        // Basic home page
        app.get('/', (req, res) => {
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
                        .nav { display: flex; gap: 20px; justify-content: center; margin: 30px 0; }
                        .nav a { padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
                        .nav a:hover { background: #0056b3; }
                        .status { text-align: center; margin: 20px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>🌬️ Air Quality Monitoring System</h1>
                        <div class="status">
                            <p>✅ Server is running</p>
                        </div>
                        <div class="nav">
                            <a href="/api">API Info</a>
                            <a href="/health">Health Check</a>
                            <a href="/routes">Route Map</a>
                            <a href="/api/data/latest">Latest Data</a>
                        </div>
                    </div>
                </body>
                </html>
            `);
        });

        console.log('✅ Registered fallback web routes');
    }

    /**
     * Load route modules safely
     */
    loadRouteModules(routeConfigs) {
        return routeConfigs.map(config => {
            try {
                const router = require(config.path);
                return {
                    router,
                    prefix: config.prefix,
                    name: config.name || config.path.split('/').pop()
                };
            } catch (error) {
                console.warn(`⚠️  Could not load route ${config.path}:`, error.message);
                return {
                    router: null,
                    prefix: config.prefix,
                    name: config.name || config.path.split('/').pop()
                };
            }
        });
    }

    /**
     * Get service status for health checks
     */
    getServiceStatus() {
        const services = {};
        
        // Check ThingSpeak service
        try {
            const thingSpeakService = require('../services/thingspeak-service');
            services.thingspeak = { status: 'available', lastCheck: new Date().toISOString() };
        } catch (error) {
            services.thingspeak = { status: 'unavailable', error: error.message };
        }

        // Check data processing service
        try {
            const dataProcessingService = require('../services/data-processing-service');
            services.dataProcessing = { status: 'available', lastCheck: new Date().toISOString() };
        } catch (error) {
            services.dataProcessing = { status: 'unavailable', error: error.message };
        }

        // Check app state service
        try {
            const appState = require('../services/app-state');
            services.appState = { 
                status: 'available', 
                lastCheck: new Date().toISOString(),
                cacheSize: appState.getCacheStats?.()?.size || 'unknown'
            };
        } catch (error) {
            services.appState = { status: 'unavailable', error: error.message };
        }

        return services;
    }

    /**
     * Get registered routes summary
     */
    getRoutesSummary() {
        return Array.from(this.registeredRoutes.entries()).map(([path, info]) => ({
            path,
            name: info.name,
            loaded: info.loaded,
            status: info.loaded ? 'active' : 'failed'
        }));
    }
}

module.exports = new RouteConsolidator();
