/**
 * Dependency Manager
 * Handles missing dependencies and provides fallbacks
 */
const fs = require('fs');
const path = require('path');

class DependencyManager {
    constructor() {
        this.missingModules = new Set();
        this.fallbacks = new Map();
        this.setupFallbacks();
    }

    /**
     * Setup fallback implementations for missing modules
     */
    setupFallbacks() {
        // Node-cache fallback
        this.fallbacks.set('node-cache', () => {
            return class FallbackCache {
                constructor(options = {}) {
                    this.cache = new Map();
                    this.ttl = options.stdTTL || 600;
                    this.checkPeriod = options.checkperiod || 60;
                    this.timers = new Map();
                }

                set(key, value, ttl = this.ttl) {
                    this.cache.set(key, value);
                    if (ttl > 0) {
                        if (this.timers.has(key)) {
                            clearTimeout(this.timers.get(key));
                        }
                        const timer = setTimeout(() => {
                            this.cache.delete(key);
                            this.timers.delete(key);
                        }, ttl * 1000);
                        this.timers.set(key, timer);
                    }
                    return true;
                }

                get(key) {
                    return this.cache.get(key);
                }

                del(key) {
                    if (this.timers.has(key)) {
                        clearTimeout(this.timers.get(key));
                        this.timers.delete(key);
                    }
                    return this.cache.delete(key);
                }

                has(key) {
                    return this.cache.has(key);
                }

                keys() {
                    return Array.from(this.cache.keys());
                }

                flush() {
                    this.timers.forEach(timer => clearTimeout(timer));
                    this.timers.clear();
                    this.cache.clear();
                }

                getStats() {
                    return {
                        keys: this.cache.size,
                        hits: 0,
                        misses: 0,
                        ksize: 0,
                        vsize: 0
                    };
                }
            };
        });

        // Socket.io fallback
        this.fallbacks.set('socket.io', () => {
            return {
                Server: class FallbackSocketIO {
                    constructor(server, options = {}) {
                        this.server = server;
                        this.options = options;
                        this.sockets = new Set();
                        console.log('⚠️  Using fallback Socket.IO implementation (WebSocket features disabled)');
                    }

                    on(event, callback) {
                        console.log(`Socket.IO fallback: ${event} event registered`);
                        return this;
                    }

                    emit(event, data) {
                        console.log(`Socket.IO fallback: Attempted to emit ${event}`);
                        return this;
                    }

                    close() {
                        console.log('Socket.IO fallback: Server closed');
                    }
                }
            };
        });

        // Express rate limit fallback
        this.fallbacks.set('express-rate-limit', () => {
            return (options = {}) => {
                console.log('⚠️  Using fallback rate limiter (no actual rate limiting)');
                return (req, res, next) => next();
            };
        });

        // Helmet fallback
        this.fallbacks.set('helmet', () => {
            return (options = {}) => {
                console.log('⚠️  Using fallback helmet (basic security headers only)');
                return (req, res, next) => {
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('X-Frame-Options', 'DENY');
                    res.setHeader('X-XSS-Protection', '1; mode=block');
                    next();
                };
            };
        });

        // Compression fallback
        this.fallbacks.set('compression', () => {
            return (options = {}) => {
                console.log('⚠️  Using fallback compression (no compression)');
                return (req, res, next) => next();
            };
        });

        // CORS fallback
        this.fallbacks.set('cors', () => {
            return (options = {}) => {
                console.log('⚠️  Using fallback CORS');
                return (req, res, next) => {
                    res.setHeader('Access-Control-Allow-Origin', options.origin || '*');
                    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                    if (req.method === 'OPTIONS') {
                        res.sendStatus(200);
                    } else {
                        next();
                    }
                };
            };
        });
    }

    /**
     * Safely require a module with fallback
     */
    safeRequire(moduleName, fallbackName = null) {
        try {
            return require(moduleName);
        } catch (error) {
            this.missingModules.add(moduleName);
            console.warn(`⚠️  Module '${moduleName}' not found: ${error.message}`);
            
            const fallbackKey = fallbackName || moduleName;
            if (this.fallbacks.has(fallbackKey)) {
                console.log(`🔄 Using fallback for '${moduleName}'`);
                return this.fallbacks.get(fallbackKey)();
            }
            
            console.error(`❌ No fallback available for '${moduleName}'`);
            throw new Error(`Required module '${moduleName}' not available and no fallback provided`);
        }
    }

    /**
     * Install missing dependencies
     */
    async installMissingDependencies() {
        if (this.missingModules.size === 0) {
            console.log('✅ No missing dependencies to install');
            return true;
        }

        console.log(`📦 Installing ${this.missingModules.size} missing dependencies...`);
        
        // Core dependencies mapping
        const dependencyMap = {
            'node-cache': 'node-cache',
            'socket.io': 'socket.io',
            'express-rate-limit': 'express-rate-limit',
            'helmet': 'helmet',
            'compression': 'compression',
            'cors': 'cors',
            'multer': 'multer',
            'bcrypt': 'bcrypt',
            'jsonwebtoken': 'jsonwebtoken',
            'validator': 'validator',
            'moment': 'moment',
            'lodash': 'lodash'
        };

        const toInstall = Array.from(this.missingModules)
            .filter(mod => dependencyMap[mod])
            .map(mod => dependencyMap[mod]);

        if (toInstall.length > 0) {
            try {
                const { spawn } = require('child_process');
                
                return new Promise((resolve, reject) => {
                    const npm = spawn('npm', ['install', '--save', ...toInstall], {
                        stdio: 'inherit',
                        cwd: process.cwd()
                    });

                    npm.on('close', (code) => {
                        if (code === 0) {
                            console.log('✅ Dependencies installed successfully');
                            this.missingModules.clear();
                            resolve(true);
                        } else {
                            console.error(`❌ npm install failed with code ${code}`);
                            reject(new Error(`Installation failed with code ${code}`));
                        }
                    });

                    npm.on('error', (error) => {
                        console.error('❌ Failed to start npm install:', error.message);
                        reject(error);
                    });
                });
            } catch (error) {
                console.error('❌ Could not install dependencies:', error.message);
                return false;
            }
        }

        return true;
    }

    /**
     * Check and report missing dependencies
     */
    checkDependencies() {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        
        if (!fs.existsSync(packageJsonPath)) {
            console.warn('⚠️  package.json not found');
            return { checked: false, missing: [], available: [] };
        }

        try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            const dependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies
            };

            const available = [];
            const missing = [];

            Object.keys(dependencies).forEach(dep => {
                try {
                    require.resolve(dep);
                    available.push(dep);
                } catch (error) {
                    missing.push(dep);
                    this.missingModules.add(dep);
                }
            });

            return { checked: true, missing, available };
        } catch (error) {
            console.error('❌ Error reading package.json:', error.message);
            return { checked: false, missing: [], available: [] };
        }
    }

    /**
     * Get status report
     */
    getStatus() {
        return {
            missingModules: Array.from(this.missingModules),
            availableFallbacks: Array.from(this.fallbacks.keys()),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = new DependencyManager();
