/**
 * Helper for generating visualizations with secure file handling
 * Improved with better memory management and error handling
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const debugHelper = require('./debug-helper');
const jsVisualization = require('./js-visualization-helper');

// Create a more limited cache with TTL to prevent memory leaks
const LRU = require('lru-cache');
const visualizationCache = new LRU({
  max: 50,                    // Store max 50 visualizations
  maxAge: 1000 * 60 * 30,     // Items expire after 30 minutes  
  updateAgeOnGet: true,       // Reset TTL when accessed
  dispose: (key, value) => {  // Clean up image files when removed from cache
    try {
      if (value && value.imagePath) {
        const fullPath = path.join(__dirname, '..', 'public', value.imagePath);
        if (fs.existsSync(fullPath) && 
            fullPath.includes('temp_') && 
            !fullPath.includes('error.png')) {
          fs.unlinkSync(fullPath);
          debugHelper.log(`Removed cached visualization: ${fullPath}`, 'visualization-cache');
        }
      }
    } catch (e) {
      console.error('Error cleaning up visualization:', e);
    }
  }
});

/**
 * Generate a secure temporary file path with sanitization
 * @param {string} prefix - File prefix
 * @param {string} extension - File extension
 * @returns {string} Temporary file path
 */
function generateTempFilePath(prefix, extension) {
  // Sanitize inputs
  const safePrefix = prefix.replace(/[^a-z0-9_-]/gi, '_').substring(0, 20);
  const safeExt = extension.replace(/[^a-z0-9]/gi, '').substring(0, 10);
  
  const randomString = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  return path.join(os.tmpdir(), `${safePrefix}_${timestamp}_${randomString}.${safeExt}`);
}

/**
 * Ensure directory exists before writing files
 * @param {string} directory - Directory path
 */
function ensureDirectoryExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
}

/**
 * Ensure error image exists or create a placeholder
 * @returns {string} Path to error image
 */
function ensureErrorImageExists() {
  const errorImagePath = path.join(__dirname, '..', 'public', 'images', 'error.png');
  const errorImageWebPath = '/images/error.png';
  
  // Ensure directory exists first
  ensureDirectoryExists(path.dirname(errorImagePath));
  
  // Check if error image exists, create a simple one if not
  if (!fs.existsSync(errorImagePath)) {
    try {
      // Try to copy a default error image if it exists
      const defaultErrorImage = path.join(__dirname, '..', 'public', 'images', 'default_error.png');
      if (fs.existsSync(defaultErrorImage)) {
        fs.copyFileSync(defaultErrorImage, errorImagePath);
      } else {
        // Create a placeholder error image file - future improvement: generate a proper image
        fs.writeFileSync(errorImagePath, 'ERROR_IMAGE_PLACEHOLDER');
      }
      console.log('Created error image:', errorImagePath);
    } catch (err) {
      console.error('Failed to create error image:', err);
    }
  }
  
  return errorImageWebPath;
}

/**
 * Visualization Helper that now uses JavaScript instead of Python
 */
let useJavaScript = true;

/**
 * Initialize the visualization helper
 * @param {Object} options - Configuration options
 */
function initialize(options = {}) {
  if (options.forcePython === true) {
    useJavaScript = false;
  } else if (options.forceJavaScript === true) {
    useJavaScript = true;
  } else {
    // By default, prefer JavaScript implementation
    useJavaScript = true;
  }
  
  debugHelper.info(`Visualization helper initialized: using ${useJavaScript ? 'JavaScript' : 'Python'} implementation`, 'visualization-helper');
}

/**
 * Toggle between JavaScript and Python implementations
 * @param {boolean} useJS - Whether to use JavaScript implementation
 * @returns {boolean} Current setting after toggle
 */
function setImplementation(useJS) {
  useJavaScript = (useJS === true);
  debugHelper.info(`Switched to ${useJavaScript ? 'JavaScript' : 'Python'} implementation`, 'visualization-helper');
  return useJavaScript;
}

/**
 * Create time series visualization
 * @param {Array} data - Air quality data
 * @param {Object} options - Visualization options
 * @returns {Promise<Object>} Visualization result
 */
async function createTimeSeriesVisualization(data, options = {}) {
  if (useJavaScript) {
    debugHelper.debug('Creating time series visualization with JavaScript implementation', 'visualization-helper');
    return jsVisualization.createTimeSeriesVisualization(data, options);
  } else {
    debugHelper.debug('Creating time series visualization with Python implementation', 'visualization-helper');
    return createVisualizationWithPython('time_series', data, options);
  }
}

/**
 * Create PM2.5 trend visualization
 * @param {Array} data - Air quality data
 * @param {Object} options - Visualization options
 * @returns {Promise<Object>} Visualization result
 */
async function createPM25TrendVisualization(data, options = {}) {
  if (useJavaScript) {
    debugHelper.debug('Creating PM2.5 trend visualization with JavaScript implementation', 'visualization-helper');
    return jsVisualization.createPM25TrendVisualization(data, options);
  } else {
    debugHelper.debug('Creating PM2.5 trend visualization with Python implementation', 'visualization-helper');
    return createVisualizationWithPython('pm25_trend', data, options);
  }
}

/**
 * Create correlation matrix visualization
 * @param {Array} data - Air quality data
 * @param {Object} options - Visualization options
 * @returns {Promise<Object>} Visualization result
 */
async function createCorrelationVisualization(data, options = {}) {
  if (useJavaScript) {
    debugHelper.debug('Creating correlation visualization with JavaScript implementation', 'visualization-helper');
    return jsVisualization.createCorrelationVisualization(data, options);
  } else {
    debugHelper.debug('Creating correlation visualization with Python implementation', 'visualization-helper');
    return createVisualizationWithPython('correlation', data, options);
  }
}

/**
 * Create daily pattern visualization
 * @param {Array} data - Air quality data
 * @param {Object} options - Visualization options
 * @returns {Promise<Object>} Visualization result
 */
async function createDailyPatternVisualization(data, options = {}) {
  if (useJavaScript) {
    debugHelper.debug('Creating daily pattern visualization with JavaScript implementation', 'visualization-helper');
    return jsVisualization.createDailyPatternVisualization(data, options);
  } else {
    debugHelper.debug('Creating daily pattern visualization with Python implementation', 'visualization-helper');
    return createVisualizationWithPython('daily_pattern', data, options);
  }
}

/**
 * Legacy method to create visualizations using Python
 * @param {string} vizType - Type of visualization
 * @param {Array} data - Air quality data
 * @param {Object} options - Visualization options
 * @returns {Promise<Object>} Visualization result
 */
async function createVisualizationWithPython(vizType, data, options = {}) {
  debugHelper.warn('Using deprecated Python visualization method', 'visualization-helper');
  
  try {
    // We'll return the JavaScript implementation result anyway since Python is being phased out
    switch (vizType) {
      case 'time_series':
        return jsVisualization.createTimeSeriesVisualization(data, options);
      case 'pm25_trend':
        return jsVisualization.createPM25TrendVisualization(data, options);
      case 'correlation':
        return jsVisualization.createCorrelationVisualization(data, options);
      case 'daily_pattern':
        return jsVisualization.createDailyPatternVisualization(data, options);
      default:
        throw new Error(`Unknown visualization type: ${vizType}`);
    }
  } catch (error) {
    console.error(`Error creating ${vizType} visualization:`, error);
    debugHelper.error(`Failed to create ${vizType} visualization: ${error.message}`, 'visualization-helper');
    
    const errorImagePath = await jsVisualization.generateErrorImage(error.message);
    
    return {
      error: true,
      message: error.message,
      imagePath: errorImagePath,
      description: `Error generating visualization: ${error.message}`
    };
  }
}

/**
 * Clear visualization cache
 * @returns {Object} Result of clearing cache
 */
function clearVisualizationCache() {
  return jsVisualization.clearVisualizationCache();
}

/**
 * Get current implementation information
 * @returns {Object} Information about which implementation is being used
 */
function getImplementationInfo() {
  return {
    useJavaScript,
    method: useJavaScript ? 'JavaScript (Chart.js)' : 'Python (Matplotlib)',
    capabilities: [
      'time_series',
      'pm25_trend',
      'correlation',
      'daily_pattern'
    ]
  };
}

/**
 * Clear visualization cache
 */
function clearCache() {
  const cacheSize = visualizationCache.itemCount;
  visualizationCache.reset();
  return { cleared: true, items: cacheSize };
}

module.exports = {
  initialize,
  setImplementation,
  createTimeSeriesVisualization,
  createPM25TrendVisualization,
  createCorrelationVisualization,
  createDailyPatternVisualization,
  clearVisualizationCache,
  getImplementationInfo,
  ensureErrorImageExists,
  clearCache
};
