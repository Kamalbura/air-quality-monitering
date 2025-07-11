/**
 * Application State Manager
 * Enhanced centralized state management with event system, caching, and health monitoring
 */
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class AppState extends EventEmitter {
    constructor() {
        super();
        
        // Core data storage
        this.latestData = [];
        this.historicalData = [];
        this.services = new Map();
        this.config = {};
        
        // State tracking
        this.state = {
            initialized: false,
            startTime: Date.now(),
            lastUpdate: null,
            updateCount: 0,
            errors: [],
            performance: {
                avgResponseTime: 0,
                totalRequests: 0,
                errorRate: 0,
                requestHistory: []
            },
            dataQuality: {
                completeness: 0,
                accuracy: 0,
                consistency: 0,
                timeliness: 0
            }
        };
        
        // Enhanced caching system
        this.cache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
        
        // Event listeners setup
        this.setupEventHandlers();
        
        // Health check intervals
        this.healthCheckInterval = null;
        this.dataQualityInterval = null;
        this.performanceInterval = null;
        this.startHealthMonitoring();
        
        // Graceful shutdown handler
        this.setupGracefulShutdown();
    }

    /**
     * Initialize the app state
     */
    async initialize() {
        try {
            console.log('🔧 Initializing App State Manager...');
            
            // Validate required services
            this.validateServices();
            
            // Initialize data structures
            this.initializeDataStructures();
            
            this.state.initialized = true;
            this.emit('initialized');
            
            console.log('✅ App State Manager initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize App State:', error);
            this.emit('error', error);
            return false;
        }
    }

    /**
     * Set latest data with validation and events
     */
    setLatestData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Latest data must be an array');
        }
        
        const previousCount = this.latestData.length;
        this.latestData = data.map(item => ({
            ...item,
            receivedAt: new Date().toISOString()
        }));
        
        this.state.lastUpdate = Date.now();
        this.state.updateCount++;
        
        this.emit('dataUpdate', {
            type: 'latest',
            data: this.latestData,
            previousCount,
            newCount: this.latestData.length
        });
    }

    /**
     * Get latest data with optional filtering
     */
    getLatestData(filter = null) {
        if (!filter) return this.latestData;
        
        return this.latestData.filter(filter);
    }

    /**
     * Set historical data with memory management
     */
    setHistoricalData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Historical data must be an array');
        }
        
        // Implement memory management (keep last 10,000 records)
        const maxRecords = 10000;
        if (data.length > maxRecords) {
            this.historicalData = data.slice(-maxRecords);
            console.log(`⚠️  Historical data truncated to ${maxRecords} records`);
        } else {
            this.historicalData = data;
        }
        
        this.emit('historicalDataUpdate', {
            count: this.historicalData.length,
            truncated: data.length > maxRecords
        });
    }

    /**
     * Get historical data with pagination and filtering
     */
    getHistoricalData(options = {}) {
        const {
            limit = null,
            offset = 0,
            filter = null,
            timeRange = null
        } = options;
        
        let data = this.historicalData;
        
        // Apply time range filter
        if (timeRange) {
            const { start, end } = timeRange;
            data = data.filter(item => {
                const timestamp = new Date(item.timestamp);
                return timestamp >= start && timestamp <= end;
            });
        }
        
        // Apply custom filter
        if (filter && typeof filter === 'function') {
            data = data.filter(filter);
        }
        
        // Apply pagination
        if (limit) {
            data = data.slice(offset, offset + limit);
        }
        
        return data;
    }

    /**
     * Add historical data with deduplication
     */
    addHistoricalData(data) {
        const dataArray = Array.isArray(data) ? data : [data];
        
        // Add timestamp if missing
        const processedData = dataArray.map(item => ({
            ...item,
            timestamp: item.timestamp || new Date().toISOString(),
            id: item.id || this.generateId()
        }));
        
        // Deduplicate based on timestamp and values
        const existingIds = new Set(this.historicalData.map(item => item.id));
        const newData = processedData.filter(item => !existingIds.has(item.id));
        
        if (newData.length > 0) {
            this.historicalData.push(...newData);
            
            // Sort by timestamp
            this.historicalData.sort((a, b) => 
                new Date(a.timestamp) - new Date(b.timestamp)
            );
            
            this.emit('dataAdded', {
                added: newData.length,
                total: this.historicalData.length
            });
        }
    }

    /**
     * Enhanced service registration with health checks
     */
    registerService(name, service, options = {}) {
        if (!name || !service) {
            throw new Error('Service name and instance are required');
        }
        
        const serviceConfig = {
            instance: service,
            registeredAt: Date.now(),
            lastHealthCheck: null,
            healthy: true,
            ...options
        };
        
        this.services.set(name, serviceConfig);
        this.emit('serviceRegistered', { name, service: serviceConfig });
        
        console.log(`🔧 Service registered: ${name}`);
    }

    /**
     * Get service with health check
     */
    getService(name) {
        const serviceConfig = this.services.get(name);
        if (!serviceConfig) {
            throw new Error(`Service '${name}' not found`);
        }
        
        return serviceConfig.instance;
    }

    /**
     * Get all services with status
     */
    getServices() {
        const services = {};
        for (const [name, config] of this.services.entries()) {
            services[name] = {
                healthy: config.healthy,
                registeredAt: config.registeredAt,
                lastHealthCheck: config.lastHealthCheck
            };
        }
        return services;
    }

    /**
     * Enhanced configuration management
     */
    setConfig(config) {
        this.config = {
            ...this.config,
            ...config,
            updatedAt: Date.now()
        };
        
        this.emit('configUpdated', this.config);
    }

    /**
     * Get configuration with optional path
     */
    getConfig(path = null) {
        if (!path) return this.config;
        
        return path.split('.').reduce((obj, key) => obj?.[key], this.config);
    }

    /**
     * Update data function registration
     */
    setUpdateDataFunction(fn) {
        if (typeof fn !== 'function') {
            throw new Error('Update data function must be a function');
        }
        
        this.updateDataFunction = fn;
        this.emit('updateFunctionRegistered');
    }

    /**
     * Trigger data update with error handling
     */
    async triggerDataUpdate() {
        if (!this.updateDataFunction) {
            throw new Error('Data update function not registered');
        }
        
        try {
            this.emit('updateStarted');
            const result = await this.updateDataFunction();
            this.emit('updateCompleted', result);
            return result;
        } catch (error) {
            this.addError(error);
            this.emit('updateFailed', error);
            throw error;
        }
    }

    /**
     * Enhanced application statistics
     */
    getAppStats() {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        return {
            // Data statistics
            data: {
                latestCount: this.latestData.length,
                historicalCount: this.historicalData.length,
                lastUpdate: this.state.lastUpdate,
                updateCount: this.state.updateCount
            },
            
            // System statistics
            system: {
                uptime: uptime,
                startTime: this.state.startTime,
                initialized: this.state.initialized,
                memoryUsage: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    external: Math.round(memoryUsage.external / 1024 / 1024)
                }
            },
            
            // Service statistics
            services: {
                total: this.services.size,
                healthy: Array.from(this.services.values()).filter(s => s.healthy).length,
                list: Array.from(this.services.keys())
            },
            
            // Performance statistics
            performance: this.state.performance,
            
            // Error statistics
            errors: {
                total: this.state.errors.length,
                recent: this.state.errors.slice(-5)
            }
        };
    }

    /**
     * Add error to tracking
     */
    addError(error) {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            timestamp: Date.now(),
            id: this.generateId()
        };
        
        this.state.errors.push(errorInfo);
        
        // Keep only last 100 errors
        if (this.state.errors.length > 100) {
            this.state.errors = this.state.errors.slice(-100);
        }
        
        this.emit('error', errorInfo);
    }

    /**
     * Clear old data based on retention policy
     */
    clearOldData(retentionDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
        
        const beforeCount = this.historicalData.length;
        this.historicalData = this.historicalData.filter(item => 
            new Date(item.timestamp) > cutoffDate
        );
        
        const removedCount = beforeCount - this.historicalData.length;
        if (removedCount > 0) {
            console.log(`🧹 Cleared ${removedCount} old records (${retentionDays}+ days)`);
            this.emit('dataCleared', { removedCount, retentionDays });
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        this.on('error', (error) => {
            console.error('App State Error:', error);
        });
        
        this.on('dataUpdate', () => {
            this.updatePerformanceStats();
        });
    }

    /**
     * Start health monitoring
     */
    startHealthMonitoring() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Every 30 seconds
    }

    /**
     * Perform health check on services
     */
    async performHealthCheck() {
        for (const [name, config] of this.services.entries()) {
            try {
                if (config.instance.healthCheck && typeof config.instance.healthCheck === 'function') {
                    const isHealthy = await config.instance.healthCheck();
                    config.healthy = isHealthy;
                } else {
                    config.healthy = true; // Assume healthy if no health check method
                }
                config.lastHealthCheck = Date.now();
            } catch (error) {
                config.healthy = false;
                console.warn(`Health check failed for service ${name}:`, error.message);
            }
        }
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats() {
        this.state.performance.totalRequests++;
        // Additional performance tracking logic can be added here
    }

    /**
     * Generate unique ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Validate required services
     */
    validateServices() {
        const requiredServices = ['thingspeakService', 'dataProcessing'];
        const missing = requiredServices.filter(service => !this.services.has(service));
        
        if (missing.length > 0) {
            console.warn(`⚠️  Missing required services: ${missing.join(', ')}`);
        }
    }

    /**
     * Initialize data structures
     */
    initializeDataStructures() {
        if (!Array.isArray(this.latestData)) this.latestData = [];
        if (!Array.isArray(this.historicalData)) this.historicalData = [];
        if (typeof this.config !== 'object') this.config = {};
    }

    /**
     * Cleanup and destroy
     */
    destroy() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.removeAllListeners();
        this.services.clear();
        this.latestData = [];
        this.historicalData = [];
        this.config = {};
        
        console.log('🧹 App State Manager destroyed');
    }

    /**
     * Enhanced caching with TTL and tags
     */
    setCache(key, value, ttl = 300000, tags = []) {
        const expiry = Date.now() + ttl;
        this.cache.set(key, {
            value,
            expiry,
            tags: Array.isArray(tags) ? tags : [tags],
            createdAt: Date.now()
        });
    }

    /**
     * Get cached value with expiry check
     */
    getCache(key) {
        const cached = this.cache.get(key);
        if (!cached) {
            this.cacheStats.misses++;
            return null;
        }

        if (Date.now() > cached.expiry) {
            this.cache.delete(key);
            this.cacheStats.evictions++;
            this.cacheStats.misses++;
            return null;
        }

        this.cacheStats.hits++;
        return cached.value;
    }

    /**
     * Invalidate cache by tags
     */
    invalidateCache(tags = []) {
        const tagsArray = Array.isArray(tags) ? tags : [tags];
        let evicted = 0;

        for (const [key, cached] of this.cache.entries()) {
            if (cached.tags.some(tag => tagsArray.includes(tag))) {
                this.cache.delete(key);
                evicted++;
            }
        }

        this.cacheStats.evictions += evicted;
        this.emit('cacheInvalidated', { tags: tagsArray, evicted });
    }

    /**
     * Cache cleanup - remove expired entries
     */
    cleanupCache() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiry) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        this.cacheStats.evictions += cleaned;
        if (cleaned > 0) {
            this.emit('cacheCleanup', { cleaned });
        }
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            ...this.cacheStats,
            size: this.cache.size,
            hitRate: this.cacheStats.hits + this.cacheStats.misses > 0 
                ? (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) * 100).toFixed(2)
                : 0
        };
    }

    /**
     * Start data quality monitoring
     */
    startDataQualityMonitoring() {
        this.dataQualityInterval = setInterval(() => {
            this.assessDataQuality();
        }, 300000); // Every 5 minutes
    }

    /**
     * Assess data quality metrics
     */
    assessDataQuality() {
        try {
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            // Completeness: check if we have recent data
            const recentData = this.historicalData.filter(item => 
                new Date(item.timestamp).getTime() > oneHourAgo
            );
            
            const completeness = Math.min(100, (recentData.length / 60) * 100); // Expect 1 per minute
            
            // Timeliness: check data freshness
            const timeliness = this.latestData.length > 0 
                ? Math.max(0, 100 - ((now - new Date(this.latestData[this.latestData.length - 1].receivedAt).getTime()) / 60000))
                : 0;

            // Accuracy: check for valid values (not null, within expected ranges)
            const validData = recentData.filter(item => 
                item.temperature != null && 
                item.humidity != null &&
                item.temperature > -50 && item.temperature < 80 &&
                item.humidity >= 0 && item.humidity <= 100
            );
            
            const accuracy = recentData.length > 0 
                ? (validData.length / recentData.length) * 100 
                : 0;

            // Consistency: check for reasonable variance
            const consistency = this.calculateConsistency(recentData);

            this.state.dataQuality = {
                completeness: Math.round(completeness),
                accuracy: Math.round(accuracy),
                consistency: Math.round(consistency),
                timeliness: Math.round(timeliness),
                lastAssessed: Date.now()
            };

            this.emit('dataQualityUpdate', this.state.dataQuality);
        } catch (error) {
            this.addError(error);
        }
    }

    /**
     * Calculate data consistency score
     */
    calculateConsistency(data) {
        if (data.length < 2) return 100;

        let tempVariance = 0;
        let humidityVariance = 0;
        let validPairs = 0;

        for (let i = 1; i < data.length; i++) {
            const prev = data[i - 1];
            const curr = data[i];

            if (prev.temperature != null && curr.temperature != null) {
                tempVariance += Math.abs(curr.temperature - prev.temperature);
                validPairs++;
            }

            if (prev.humidity != null && curr.humidity != null) {
                humidityVariance += Math.abs(curr.humidity - prev.humidity);
            }
        }

        if (validPairs === 0) return 0;

        const avgTempVariance = tempVariance / validPairs;
        const avgHumidityVariance = humidityVariance / validPairs;

        // Consider consistent if changes are reasonable
        const tempConsistency = Math.max(0, 100 - (avgTempVariance * 5));
        const humidityConsistency = Math.max(0, 100 - (avgHumidityVariance * 2));

        return (tempConsistency + humidityConsistency) / 2;
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        this.performanceInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 60000); // Every minute
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        const history = this.state.performance.requestHistory;
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Remove old entries
        this.state.performance.requestHistory = history.filter(entry => entry.timestamp > oneMinuteAgo);

        // Calculate metrics
        const recentRequests = this.state.performance.requestHistory;
        if (recentRequests.length > 0) {
            const totalTime = recentRequests.reduce((sum, req) => sum + (req.responseTime || 0), 0);
            this.state.performance.avgResponseTime = Math.round(totalTime / recentRequests.length);
            
            const errors = recentRequests.filter(req => req.error);
            this.state.performance.errorRate = Math.round((errors.length / recentRequests.length) * 100);
        }

        this.emit('performanceUpdate', this.state.performance);
    }

    /**
     * Record API request for performance tracking
     */
    recordRequest(responseTime, error = false) {
        this.state.performance.totalRequests++;
        this.state.performance.requestHistory.push({
            timestamp: Date.now(),
            responseTime,
            error
        });

        // Keep only last 1000 requests
        if (this.state.performance.requestHistory.length > 1000) {
            this.state.performance.requestHistory = this.state.performance.requestHistory.slice(-1000);
        }
    }

    /**
     * Save state to disk for persistence
     */
    async saveState() {
        try {
            const stateDir = path.join(__dirname, '..', 'data', 'state');
            await fs.mkdir(stateDir, { recursive: true });

            const stateData = {
                config: this.config,
                state: this.state,
                latestDataCount: this.latestData.length,
                historicalDataCount: this.historicalData.length,
                services: Array.from(this.services.keys()),
                savedAt: Date.now()
            };

            await fs.writeFile(
                path.join(stateDir, 'app-state.json'),
                JSON.stringify(stateData, null, 2)
            );

            this.emit('stateSaved', { size: JSON.stringify(stateData).length });
        } catch (error) {
            this.addError(error);
        }
    }

    /**
     * Load state from disk
     */
    async loadState() {
        try {
            const statePath = path.join(__dirname, '..', 'data', 'state', 'app-state.json');
            const stateData = JSON.parse(await fs.readFile(statePath, 'utf8'));

            if (stateData.config) {
                this.config = { ...this.config, ...stateData.config };
            }

            if (stateData.state) {
                this.state = { ...this.state, ...stateData.state };
                this.state.lastLoad = Date.now();
            }

            this.emit('stateLoaded', { 
                services: stateData.services,
                dataCount: stateData.historicalDataCount 
            });

            console.log('✅ App state loaded successfully');
            return true;
        } catch (error) {
            console.log('ℹ️  No previous state found, starting fresh');
            return false;
        }
    }

    /**
     * Setup graceful shutdown handlers
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n📤 Received ${signal}, performing graceful shutdown...`);
            
            try {
                // Save current state
                await this.saveState();
                
                // Clear intervals
                if (this.healthCheckInterval) clearInterval(this.healthCheckInterval);
                if (this.dataQualityInterval) clearInterval(this.dataQualityInterval);
                if (this.performanceInterval) clearInterval(this.performanceInterval);
                
                // Emit shutdown event for services to cleanup
                this.emit('shutdown');
                
                console.log('✅ Graceful shutdown completed');
                process.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart
    }
}

module.exports = new AppState();
