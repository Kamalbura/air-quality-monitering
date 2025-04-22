/**
 * API Monitor Middleware
 * Tracks API usage and provides monitoring capabilities
 */

// Store metrics in memory
const apiMetrics = {
  totalRequests: 0,
  pathCounts: {},
  errorCounts: {},
  responseTimeBuckets: {
    fast: 0,      // < 100ms
    medium: 0,    // 100ms - 1000ms
    slow: 0,      // 1s - 5s
    verySlow: 0   // > 5s
  },
  startTime: Date.now()
};

/**
 * Middleware function to monitor API requests
 */
function apiMonitor(req, res, next) {
  // Only track API routes
  if (!req.path.startsWith('/api')) {
    return next();
  }
  
  const startTime = Date.now();
  apiMetrics.totalRequests++;
  
  // Track requests by path
  const pathKey = `${req.method} ${req.path}`;
  apiMetrics.pathCounts[pathKey] = (apiMetrics.pathCounts[pathKey] || 0) + 1;
  
  // Track response time
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    // Categorize response time
    if (duration < 100) {
      apiMetrics.responseTimeBuckets.fast++;
    } else if (duration < 1000) {
      apiMetrics.responseTimeBuckets.medium++;
    } else if (duration < 5000) {
      apiMetrics.responseTimeBuckets.slow++;
    } else {
      apiMetrics.responseTimeBuckets.verySlow++;
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      const errorKey = `${res.statusCode} ${pathKey}`;
      apiMetrics.errorCounts[errorKey] = (apiMetrics.errorCounts[errorKey] || 0) + 1;
    }
  });
  
  next();
}

/**
 * Get current API metrics
 * @returns {Object} API metrics data
 */
function getApiMetrics() {
  return {
    ...apiMetrics,
    uptime: Math.floor((Date.now() - apiMetrics.startTime) / 1000),
    timestamp: new Date().toISOString()
  };
}

/**
 * Reset API metrics
 */
function resetApiMetrics() {
  apiMetrics.totalRequests = 0;
  apiMetrics.pathCounts = {};
  apiMetrics.errorCounts = {};
  apiMetrics.responseTimeBuckets = {
    fast: 0,
    medium: 0,
    slow: 0,
    verySlow: 0
  };
  apiMetrics.startTime = Date.now();
}

module.exports = {
  apiMonitor,
  getApiMetrics,
  resetApiMetrics
};
