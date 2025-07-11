/**
 * API Cache Service
 * Provides caching functionality for API responses and data
 */
const NodeCache = require('node-cache');

class ApiCacheService {
    constructor() {
        // Main cache with 1 hour default TTL
        this.cache = new NodeCache({
            stdTTL: 3600, // 1 hour default
            checkperiod: 300, // Check for expired keys every 5 minutes
            deleteOnExpire: true,
            useClones: false
        });

        // Quick cache for frequently accessed data (5 minutes TTL)
        this.quickCache = new NodeCache({
            stdTTL: 300,
            checkperiod: 60,
            deleteOnExpire: true,
            useClones: false
        });

        // Long-term cache for static data (24 hours TTL)
        this.longTermCache = new NodeCache({
            stdTTL: 86400, // 24 hours
            checkperiod: 3600, // Check every hour
            deleteOnExpire: true,
            useClones: false
        });

        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };

        // Set up event listeners
        this.setupEventListeners();
    }

    /**
     * Set up cache event listeners for statistics
     */
    setupEventListeners() {
        [this.cache, this.quickCache, this.longTermCache].forEach(cache => {
            cache.on('set', (key, value) => {
                this.stats.sets++;
            });

            cache.on('del', (key, value) => {
                this.stats.deletes++;
            });

            cache.on('expired', (key, value) => {
                this.stats.deletes++;
            });

            cache.on('error', (err) => {
                this.stats.errors++;
                console.error('Cache error:', err);
            });
        });
    }

    /**
     * Get value from cache
     */
    get(key, cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            const value = cache.get(key);
            
            if (value !== undefined) {
                this.stats.hits++;
                return value;
            } else {
                this.stats.misses++;
                return null;
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Set value in cache
     */
    set(key, value, ttl = null, cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            
            if (ttl) {
                return cache.set(key, value, ttl);
            } else {
                return cache.set(key, value);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache set error:', error);
            return false;
        }
    }

    /**
     * Delete value from cache
     */
    del(key, cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            return cache.del(key);
        } catch (error) {
            this.stats.errors++;
            console.error('Cache delete error:', error);
            return false;
        }
    }

    /**
     * Check if key exists in cache
     */
    has(key, cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            return cache.has(key);
        } catch (error) {
            this.stats.errors++;
            return false;
        }
    }

    /**
     * Get multiple values from cache
     */
    mget(keys, cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            const result = cache.mget(keys);
            
            // Update stats
            Object.keys(result).forEach(key => {
                if (result[key] !== undefined) {
                    this.stats.hits++;
                } else {
                    this.stats.misses++;
                }
            });
            
            return result;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache mget error:', error);
            return {};
        }
    }

    /**
     * Set multiple values in cache
     */
    mset(keyValuePairs, ttl = null, cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            
            if (ttl) {
                return cache.mset(keyValuePairs, ttl);
            } else {
                return cache.mset(keyValuePairs);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache mset error:', error);
            return false;
        }
    }

    /**
     * Get cache instance by type
     */
    getCache(type) {
        switch (type) {
            case 'quick':
                return this.quickCache;
            case 'long':
                return this.longTermCache;
            case 'main':
            default:
                return this.cache;
        }
    }

    /**
     * Clear all caches
     */
    flushAll() {
        try {
            this.cache.flushAll();
            this.quickCache.flushAll();
            this.longTermCache.flushAll();
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache flush error:', error);
            return false;
        }
    }

    /**
     * Clear specific cache
     */
    flush(cacheType = 'main') {
        try {
            const cache = this.getCache(cacheType);
            cache.flushAll();
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache flush error:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const mainStats = this.cache.getStats();
        const quickStats = this.quickCache.getStats();
        const longStats = this.longTermCache.getStats();

        return {
            ...this.stats,
            hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
            caches: {
                main: {
                    keys: mainStats.keys,
                    ksize: mainStats.ksize,
                    vsize: mainStats.vsize
                },
                quick: {
                    keys: quickStats.keys,
                    ksize: quickStats.ksize,
                    vsize: quickStats.vsize
                },
                long: {
                    keys: longStats.keys,
                    ksize: longStats.ksize,
                    vsize: longStats.vsize
                }
            },
            totalKeys: mainStats.keys + quickStats.keys + longStats.keys
        };
    }

    /**
     * Get or set pattern - fetch from cache or compute and cache
     */
    async getOrSet(key, fetchFunction, ttl = null, cacheType = 'main') {
        try {
            // Try to get from cache first
            const cached = this.get(key, cacheType);
            if (cached !== null) {
                return cached;
            }

            // Not in cache, compute the value
            const value = await fetchFunction();
            
            // Cache the result
            this.set(key, value, ttl, cacheType);
            
            return value;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache getOrSet error:', error);
            throw error;
        }
    }

    /**
     * Cache data with automatic expiration based on data type
     */
    cacheData(key, data, dataType = 'general') {
        const ttlMap = {
            'sensor-reading': 300,      // 5 minutes
            'thingspeak-data': 600,     // 10 minutes
            'analytics': 1800,          // 30 minutes
            'config': 3600,             // 1 hour
            'static': 86400,            // 24 hours
            'general': 3600             // 1 hour default
        };

        const cacheTypeMap = {
            'sensor-reading': 'quick',
            'thingspeak-data': 'quick',
            'analytics': 'main',
            'config': 'long',
            'static': 'long',
            'general': 'main'
        };

        const ttl = ttlMap[dataType] || ttlMap.general;
        const cacheType = cacheTypeMap[dataType] || cacheTypeMap.general;

        return this.set(key, data, ttl, cacheType);
    }

    /**
     * Generate cache key from parameters
     */
    generateKey(prefix, ...params) {
        return `${prefix}:${params.map(p => 
            typeof p === 'object' ? JSON.stringify(p) : String(p)
        ).join(':')}`;
    }

    /**
     * Cache with tags for group invalidation
     */
    setWithTags(key, value, tags = [], ttl = null, cacheType = 'main') {
        const success = this.set(key, value, ttl, cacheType);
        
        if (success && tags.length > 0) {
            // Store tag mappings
            tags.forEach(tag => {
                const tagKey = `tag:${tag}`;
                const taggedKeys = this.get(tagKey, cacheType) || [];
                if (!taggedKeys.includes(key)) {
                    taggedKeys.push(key);
                    this.set(tagKey, taggedKeys, ttl, cacheType);
                }
            });
        }
        
        return success;
    }

    /**
     * Invalidate all keys with specific tag
     */
    invalidateByTag(tag, cacheType = 'main') {
        const tagKey = `tag:${tag}`;
        const taggedKeys = this.get(tagKey, cacheType) || [];
        
        let invalidated = 0;
        taggedKeys.forEach(key => {
            if (this.del(key, cacheType)) {
                invalidated++;
            }
        });
        
        // Remove the tag mapping
        this.del(tagKey, cacheType);
        
        return invalidated;
    }
}

module.exports = new ApiCacheService();
