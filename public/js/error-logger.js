/**
 * Error Logger Utility
 * Provides centralized error logging and debugging functionality
 */

const ErrorLogger = (function() {
    // Configuration
    let config = {
        logLevel: 'info', // 'debug', 'info', 'warn', 'error'
        enableConsole: true,
        enableToast: true,
        enableRemoteLogging: true,
        remoteEndpoint: '/api/log',
        maxLogEntries: 100
    };
    
    // Log storage
    let errorLog = [];
    let infoLog = [];
    
    // Log levels
    const LOG_LEVELS = {
        debug: 0,
        info: 1,
        warn: 2,
        error: 3
    };
    
    // Toast container reference
    let toastContainer;
    
    /**
     * Initialize the error logger
     * @param {Object} options - Configuration options
     */
    function init(options = {}) {
        config = { ...config, ...options };
        
        // Try to find or create toast container
        toastContainer = document.getElementById('toast-container');
        if (!toastContainer && config.enableToast) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
            toastContainer.style.zIndex = '1050';
            document.body.appendChild(toastContainer);
        }
        
        // Set up global error handler
        window.addEventListener('error', function(event) {
            logError('Uncaught Error', event.error || event.message);
            return false;
        });
        
        // Set up unhandled promise rejection handler
        window.addEventListener('unhandledrejection', function(event) {
            logError('Unhandled Promise Rejection', event.reason);
            return false;
        });
        
        // Set up API error interceptor if fetch is being used
        if (window.fetch) {
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                try {
                    const response = await originalFetch(...args);
                    // Monitor for API errors
                    if (!response.ok && response.status >= 400) {
                        const requestUrl = args[0] instanceof Request ? args[0].url : args[0];
                        logWarning(`API Error (${response.status})`, `${response.statusText} - ${requestUrl}`);
                    }
                    return response;
                } catch (error) {
                    // Log network errors
                    const requestUrl = args[0] instanceof Request ? args[0].url : args[0];
                    logError(`Network Error`, `Failed to fetch ${requestUrl}: ${error.message}`);
                    throw error;  // Rethrow so original error handling still works
                }
            };
        }
        
        log('ErrorLogger initialized', 'debug');
    }
    
    /**
     * Log a message at the specified level
     * @param {string} message - Log message
     * @param {string} level - Log level ('debug', 'info', 'warn', 'error')
     * @param {Object} details - Additional details
     */
    function log(message, level = 'info', details = {}) {
        if (!shouldLog(level)) return;
        
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            details,
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        // Store logs based on level
        if (level === 'error') {
            errorLog.unshift(logEntry);
            if (errorLog.length > config.maxLogEntries) {
                errorLog.pop();
            }
        } else {
            infoLog.unshift(logEntry);
            if (infoLog.length > config.maxLogEntries) {
                infoLog.pop();
            }
        }
        
        // Console logging
        if (config.enableConsole) {
            const consoleMethod = level === 'error' ? 'error' : 
                                level === 'warn' ? 'warn' : 
                                level === 'debug' ? 'debug' : 'log';
            
            console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] ${message}`, details);
        }
        
        // Remote logging
        if (config.enableRemoteLogging && level !== 'debug') {
            sendToRemote(logEntry);
        }
        
        return logEntry;
    }
    
    /**
     * Log an error
     * @param {string} message - Error message
     * @param {Error|string} error - Error object or message
     */
    function logError(message, error) {
        const errorObj = error instanceof Error ? error : new Error(error?.toString() || message);
        const details = {
            name: errorObj.name,
            message: errorObj.message,
            stack: errorObj.stack,
            timestamp: new Date().toISOString()
        };
        
        log(message, 'error', details);
        
        // Show toast for errors if enabled
        if (config.enableToast && toastContainer) {
            showErrorToast(message, errorObj);
        }
        
        return details;
    }
    
    /**
     * Log a warning
     * @param {string} message - Warning message
     * @param {Object|string} details - Additional details
     */
    function logWarning(message, details) {
        return log(message, 'warn', details);
    }
    
    /**
     * Log info
     * @param {string} message - Info message
     * @param {Object|string} details - Additional details
     */
    function logInfo(message, details) {
        return log(message, 'info', details);
    }
    
    /**
     * Log debug message
     * @param {string} message - Debug message
     * @param {Object|string} details - Additional details
     */
    function logDebug(message, details) {
        return log(message, 'debug', details);
    }
    
    /**
     * Check if a message at the given level should be logged
     * @param {string} level - Log level to check
     * @returns {boolean} Whether the message should be logged
     */
    function shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel];
    }
    
    /**
     * Send a log entry to the remote endpoint
     * @param {Object} entry - Log entry to send
     */
    function sendToRemote(entry) {
        try {
            fetch(config.remoteEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry),
                // Don't let this request trigger more error logging
                keepalive: true,
                mode: 'no-cors'
            }).catch(e => console.error('Failed to send log to remote:', e));
        } catch (e) {
            // Silently fail - we don't want errors in error logging
        }
    }
    
    /**
     * Show an error toast notification
     * @param {string} title - Toast title
     * @param {Error|string} error - Error object or message
     */
    function showErrorToast(title, error) {
        if (!toastContainer) return;
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        const toastId = `toast-${Date.now()}`;
        
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-danger text-white">
                    <strong class="me-auto">${title}</strong>
                    <small>${new Date().toLocaleTimeString()}</small>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    <p>${errorMessage}</p>
                    <details>
                        <summary>Technical Details</summary>
                        <pre class="small text-muted mt-2">${error instanceof Error ? error.stack : 'No stack trace available'}</pre>
                    </details>
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        if (window.bootstrap && window.bootstrap.Toast) {
            const toast = new window.bootstrap.Toast(document.getElementById(toastId));
            toast.show();
        }
    }
    
    /**
     * Show a regular toast notification
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Toast type ('primary', 'success', 'warning', 'danger', etc.)
     */
    function showToast(title, message, type = 'primary') {
        if (!toastContainer) return;
        
        const toastId = `toast-${Date.now()}`;
        
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-${type} text-white">
                    <strong class="me-auto">${title}</strong>
                    <small>${new Date().toLocaleTimeString()}</small>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        if (window.bootstrap && window.bootstrap.Toast) {
            const toast = new window.bootstrap.Toast(document.getElementById(toastId));
            toast.show();
        }
    }
    
    /**
     * Get all logs
     * @returns {Object} All logs, separated by level
     */
    function getLogs() {
        return {
            error: errorLog,
            info: infoLog
        };
    }
    
    /**
     * Clear logs
     * @param {string} level - Log level to clear ('error', 'info', 'all')
     */
    function clearLogs(level = 'all') {
        if (level === 'error' || level === 'all') {
            errorLog = [];
        }
        if (level === 'info' || level === 'all') {
            infoLog = [];
        }
    }
    
    /**
     * Set the log level
     * @param {string} level - New log level
     */
    function setLogLevel(level) {
        if (LOG_LEVELS[level] !== undefined) {
            config.logLevel = level;
            log(`Log level set to ${level}`, 'debug');
        }
    }
    
    /**
     * Create a rich error object for API errors
     * @param {Error|Object|string} error - Error object, response, or message
     * @returns {Object} Formatted error details
     */
    function formatApiError(error) {
        const result = {
            message: 'An unexpected error occurred',
            details: null,
            statusCode: null,
            retry: false,
            isOffline: false
        };
        
        try {
            // Handle different types of errors
            if (!navigator.onLine) {
                result.message = 'You are currently offline. Please check your internet connection.';
                result.isOffline = true;
                result.retry = true;
                result.details = 'Browser reports no internet connection';
            } else if (error instanceof TypeError && error.message.includes('NetworkError')) {
                result.message = 'Network error. Please check your internet connection.';
                result.retry = true;
                result.details = error.message;
            } else if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                result.message = 'Could not connect to the server. Please try again later.';
                result.retry = true;
                result.details = error.message;
            } else if (error.status === 401 || error.statusCode === 401) {
                result.message = 'Authentication error. Please login again.';
                result.statusCode = 401;
                result.details = 'Unauthorized request';
            } else if (error.status === 403 || error.statusCode === 403) {
                result.message = 'You do not have permission to access this resource.';
                result.statusCode = 403;
                result.details = 'Forbidden';
            } else if (error.status === 404 || error.statusCode === 404) {
                result.message = 'The requested resource was not found.';
                result.statusCode = 404;
                result.details = 'Not found';
            } else if (error.status === 500 || error.statusCode === 500) {
                result.message = 'Server error. Please try again later.';
                result.statusCode = 500;
                result.retry = true;
                result.details = 'Internal server error';
            } else if (error.status >= 500 || error.statusCode >= 500) {
                result.message = 'Server error. Please try again later.';
                result.statusCode = error.status || error.statusCode;
                result.retry = true;
                result.details = error.statusText || 'Server error';
            } else if (error.message) {
                result.message = error.message;
                result.details = error.stack;
            } else if (typeof error === 'string') {
                result.message = error;
                result.details = 'No additional details';
            } else if (error.error) {
                // Handle error wrapped in an object
                result.message = error.error.message || error.error;
                result.details = error.error.stack || JSON.stringify(error);
            } else {
                // Try to extract useful info from the error object
                result.message = JSON.stringify(error).substring(0, 100);
                result.details = JSON.stringify(error);
            }
        } catch (e) {
            result.message = 'Error processing error details';
            result.details = 'Error in error handler: ' + e.message;
        }
        
        return result;
    }
    
    // Public API
    return {
        init,
        log,
        logError,
        logWarning,
        logInfo,
        logDebug,
        showToast,
        getLogs,
        clearLogs,
        setLogLevel,
        formatApiError,
        debug: logDebug,
        info: logInfo,
        warn: logWarning,
        error: logError
    };
})();

// Auto-initialize with default settings
document.addEventListener('DOMContentLoaded', function() {
    ErrorLogger.init();
});

// Make it available globally
window.ErrorLogger = ErrorLogger;
