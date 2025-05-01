/**
 * Error Handler - Standardized error handling for the Air Quality Monitoring System
 * Provides consistent error display and error recovery options
 */

const ErrorHandler = (function() {
    // Error types with corresponding bootstrap classes and icons
    const errorTypes = {
        NETWORK: {
            class: 'danger',
            icon: 'wifi-off',
            title: 'Network Error',
            defaultMessage: 'Unable to connect to remote service',
            recoveryOptions: ['retry', 'offline']
        },
        DATA: {
            class: 'warning',
            icon: 'exclamation-triangle-fill',
            title: 'Data Error',
            defaultMessage: 'Error processing data',
            recoveryOptions: ['fallback', 'cache']
        },
        API: {
            class: 'danger',
            icon: 'server',
            title: 'API Error',
            defaultMessage: 'Error communicating with external API',
            recoveryOptions: ['retry', 'fallback']
        },
        CONFIG: {
            class: 'warning',
            icon: 'gear-fill',
            title: 'Configuration Error',
            defaultMessage: 'Invalid or missing configuration',
            recoveryOptions: ['defaults']
        },
        THINGSPEAK: {
            class: 'danger',
            icon: 'cloud-slash',
            title: 'ThingSpeak Error',
            defaultMessage: 'Error communicating with ThingSpeak',
            recoveryOptions: ['retry', 'local_data']
        },
        VISUALIZATION: {
            class: 'info',
            icon: 'graph-down',
            title: 'Visualization Error',
            defaultMessage: 'Error generating visualization',
            recoveryOptions: ['fallback', 'client_viz']
        },
        SYSTEM: {
            class: 'danger',
            icon: 'x-octagon-fill',
            title: 'System Error',
            defaultMessage: 'Internal system error',
            recoveryOptions: ['restart']
        },
        UNKNOWN: {
            class: 'secondary',
            icon: 'question-circle',
            title: 'Unknown Error',
            defaultMessage: 'An unexpected error occurred',
            recoveryOptions: []
        },
        // Legacy mappings for backward compatibility
        data: {
            class: 'warning',
            icon: 'exclamation-triangle-fill',
            title: 'Data Error',
            defaultMessage: 'Error processing data',
            recoveryOptions: ['fallback', 'cache']
        },
        connection: {
            class: 'danger',
            icon: 'wifi-off',
            title: 'Connection Error',
            defaultMessage: 'Connection failed',
            recoveryOptions: ['retry', 'offline']
        },
        visualization: {
            class: 'info',
            icon: 'graph-down',
            title: 'Visualization Error',
            defaultMessage: 'Error generating visualization',
            recoveryOptions: ['fallback', 'client_viz']
        },
        validation: {
            class: 'warning',
            icon: 'exclamation-circle',
            title: 'Validation Error',
            defaultMessage: 'Invalid data provided',
            recoveryOptions: []
        },
        api: {
            class: 'danger',
            icon: 'server',
            title: 'API Error',
            defaultMessage: 'API request failed',
            recoveryOptions: ['retry']
        },
        auth: {
            class: 'danger',
            icon: 'lock-fill',
            title: 'Authentication Error',
            defaultMessage: 'Authentication failed',
            recoveryOptions: ['reauthenticate']
        },
        default: {
            class: 'secondary',
            icon: 'question-circle',
            title: 'Unknown Error',
            defaultMessage: 'An unexpected error occurred',
            recoveryOptions: []
        }
    };

    /**
     * Recovery functions for different error types
     */
    const recoveryHandlers = {
        retry: function(options = {}) {
            if (typeof options.retryFn === 'function') {
                return options.retryFn();
            }
            return false;
        },
        
        offline: function(options = {}) {
            if (typeof options.offlineFn === 'function') {
                return options.offlineFn();
            } else if (typeof ConnectionChecker !== 'undefined') {
                // Default implementation using ConnectionChecker if available
                ConnectionChecker.switchToOfflineMode();
                return true;
            }
            return false;
        },
        
        fallback: function(options = {}) {
            if (typeof options.fallbackFn === 'function') {
                return options.fallbackFn();
            }
            return false;
        },
        
        cache: function(options = {}) {
            if (typeof options.cacheFn === 'function') {
                return options.cacheFn();
            } else {
                // Try to use data from localStorage cache
                return tryLoadFromCache(options.cacheKey || 'data_cache');
            }
        },
        
        local_data: function(options = {}) {
            if (typeof options.localDataFn === 'function') {
                return options.localDataFn();
            } else {
                // Redirect to local data view
                window.location.href = '/data-sources?mode=local';
                return true;
            }
        },
        
        client_viz: function(options = {}) {
            if (typeof options.clientVizFn === 'function') {
                return options.clientVizFn();
            } else if (window.FallbackViz) {
                // Use fallback visualization if available
                return true;
            }
            return false;
        },
        
        defaults: function(options = {}) {
            if (typeof options.defaultsFn === 'function') {
                return options.defaultsFn();
            } else {
                // Try to reset configuration to defaults
                fetch('/api/config/reset', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'}
                }).then(response => {
                    if (response.ok) {
                        window.location.reload();
                        return true;
                    }
                    return false;
                }).catch(() => false);
            }
            return false;
        },
        
        restart: function() {
            // Simple page reload
            window.location.reload();
            return true;
        },
        
        reauthenticate: function(options = {}) {
            if (typeof options.reauthFn === 'function') {
                return options.reauthFn();
            }
            return false;
        }
    };
    
    /**
     * Attempt to load data from localStorage cache
     * @param {string} key - Cache key
     * @returns {boolean} Success status
     */
    function tryLoadFromCache(key) {
        try {
            const cachedData = localStorage.getItem(key);
            if (cachedData) {
                const data = JSON.parse(cachedData);
                if (data && data.timestamp && data.data) {
                    // Check if cache is not too old (24 hours)
                    const now = Date.now();
                    const cacheTime = new Date(data.timestamp).getTime();
                    if (now - cacheTime < 24 * 60 * 60 * 1000) {
                        // Cache is valid, process it
                        if (typeof window.processCachedData === 'function') {
                            window.processCachedData(data.data);
                            return true;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error loading from cache:', e);
        }
        return false;
    }
    
    /**
     * Create HTML for an error message
     * @param {string} message - Error message
     * @param {string} type - Error type ('NETWORK', 'DATA', 'API', etc)
     * @param {Object} options - Additional options (retryFn, helpLink, recoveryOptions, etc)
     * @returns {string} HTML string
     */
    function createErrorHTML(message, type = 'default', options = {}) {
        const errorConfig = errorTypes[type] || errorTypes.default;
        const hasAction = options.retryFn || options.helpLink || (options.recoveryOptions && options.recoveryOptions.length > 0);
        
        let html = `
            <div class="alert alert-${errorConfig.class} d-flex align-items-center" role="alert">
                <i class="bi bi-${errorConfig.icon} me-2 flex-shrink-0"></i>
                <div class="flex-grow-1">
                    <h5 class="alert-heading">${options.title || errorConfig.title}</h5>
                    <p class="mb-${hasAction ? '3' : '0'}">${message}</p>`;
        
        // Add action buttons if needed
        if (hasAction) {
            html += `<div class="d-flex gap-2">`;
            
            // Add standard retry button
            if (options.retryFn) {
                html += `<button type="button" id="error-retry-btn" class="btn btn-sm btn-${errorConfig.class}">
                    <i class="bi bi-arrow-repeat me-1"></i> Retry
                </button>`;
            }
            
            // Add recovery option buttons
            const recoveryOptions = options.recoveryOptions || errorConfig.recoveryOptions || [];
            recoveryOptions.forEach(option => {
                // Skip retry button if already added
                if (option === 'retry' && options.retryFn) return;
                
                // Only add supported recovery options
                if (recoveryHandlers[option]) {
                    const optionLabels = {
                        retry: 'Retry',
                        offline: 'Work Offline',
                        fallback: 'Use Fallback',
                        cache: 'Use Cached Data',
                        local_data: 'Use Local Data',
                        client_viz: 'Simple View',
                        defaults: 'Reset to Defaults',
                        restart: 'Refresh Page',
                        reauthenticate: 'Re-login'
                    };
                    
                    const optionIcons = {
                        retry: 'arrow-repeat',
                        offline: 'cloud-slash',
                        fallback: 'arrow-left-right',
                        cache: 'clock-history',
                        local_data: 'hdd',
                        client_viz: 'bar-chart',
                        defaults: 'arrow-counterclockwise',
                        restart: 'bootstrap-reboot',
                        reauthenticate: 'key'
                    };
                    
                    html += `<button type="button" id="recovery-${option}-btn" class="btn btn-sm btn-outline-${errorConfig.class}">
                        <i class="bi bi-${optionIcons[option] || 'gear'} me-1"></i> ${optionLabels[option] || option}
                    </button>`;
                }
            });
            
            // Add help link
            if (options.helpLink) {
                html += `<a href="${options.helpLink}" target="_blank" class="btn btn-sm btn-outline-${errorConfig.class}">
                    <i class="bi bi-question-circle me-1"></i> Help
                </a>`;
            }
            
            html += `</div>`;
            
            // Add error details if available
            if (options.errorId || options.details) {
                html += `<details class="mt-3 small">
                    <summary>Error Details</summary>
                    <div class="mt-2">
                        ${options.errorId ? `<div>Error ID: ${options.errorId}</div>` : ''}
                        ${options.details ? `<div>${options.details}</div>` : ''}
                        ${options.timestamp ? `<div>Time: ${new Date(options.timestamp).toLocaleString()}</div>` : ''}
                    </div>
                </details>`;
            }
        }
        
        html += `
                </div>
            </div>`;
        
        return html;
    }
    
    /**
     * Display an error in a container
     * @param {string|Element} container - Container selector or element
     * @param {string} message - Error message
     * @param {string} type - Error type ('NETWORK', 'DATA', 'API', etc)
     * @param {Object} options - Additional options (retryFn, helpLink, recoveryOptions, etc)
     */
    function showError(container, message, type = 'default', options = {}) {
        const element = typeof container === 'string' ? document.querySelector(container) : container;
        if (!element) return false;
        
        element.innerHTML = createErrorHTML(message, type, options);
        
        // Attach retry function if provided
        if (options.retryFn) {
            const retryBtn = element.querySelector('#error-retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', options.retryFn);
            }
        }
        
        // Attach recovery option handlers
        const recoveryOptions = options.recoveryOptions || (errorTypes[type] ? errorTypes[type].recoveryOptions : []);
        if (recoveryOptions && recoveryOptions.length > 0) {
            recoveryOptions.forEach(option => {
                if (recoveryHandlers[option]) {
                    const btn = element.querySelector(`#recovery-${option}-btn`);
                    if (btn) {
                        btn.addEventListener('click', () => {
                            recoveryHandlers[option](options);
                        });
                    }
                }
            });
        }
        
        return true;
    }
    
    /**
     * Create a toast notification for an error
     * @param {string} message - Error message
     * @param {string} type - Error type ('NETWORK', 'DATA', 'API', etc)
     * @param {Object} options - Additional options (autoHide, delay, etc)
     */
    function showErrorToast(message, type = 'default', options = {}) {
        const errorConfig = errorTypes[type] || errorTypes.default;
        const toastContainer = document.getElementById('toast-container');
        
        if (!toastContainer) return false;
        
        const toastId = `toast-${Date.now()}`;
        const autohide = options.autoHide !== false;
        const delay = options.delay || 5000;
        
        const toastHTML = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-autohide="${autohide}" data-bs-delay="${delay}">
                <div class="toast-header bg-${errorConfig.class} text-white">
                    <i class="bi bi-${errorConfig.icon} me-2"></i>
                    <strong class="me-auto">${options.title || errorConfig.title}</strong>
                    <small>${new Date().toLocaleTimeString()}</small>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                    ${options.details ? `<details class="mt-2"><summary>Details</summary><small class="text-muted">${options.details}</small></details>` : ''}
                    ${options.errorId ? `<div class="mt-2 small text-muted">Error ID: ${options.errorId}</div>` : ''}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        
        // Clean up after hiding
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
        
        toast.show();
        return true;
    }
    
    /**
     * Format API errors for display
     * @param {Error|Object} error - Error object or response from API
     * @returns {Object} Formatted error with message and details
     */
    function formatApiError(error) {
        // Check for our enhanced server error response format
        if (error && typeof error === 'object' && error.errorType) {
            return {
                message: error.message || errorTypes[error.errorType]?.defaultMessage || 'An error occurred',
                details: error.typeName ? `${error.typeName} (${error.errorId || 'No ID'})` : 'No additional details',
                errorId: error.errorId || null,
                errorType: error.errorType,
                timestamp: error.timestamp,
                recoveryOptions: error.recoveryOptions || []
            };
        }
        
        // If it's an Error object
        if (error instanceof Error) {
            return {
                message: 'Failed to communicate with the server',
                details: error.message
            };
        }
        
        // If it's an API response object with error info
        if (error && typeof error === 'object') {
            if (error.error) {
                return {
                    message: 'The server reported an error',
                    details: error.error
                };
            }
            
            // HTTP error responses
            if (error.status) {
                const statusMessages = {
                    400: 'Bad request - The request was malformed',
                    401: 'Unauthorized - Authentication required',
                    403: 'Forbidden - You don\'t have permission',
                    404: 'Not found - The requested resource doesn\'t exist',
                    500: 'Server error - Something went wrong on the server',
                    502: 'Bad gateway - The server received an invalid response',
                    503: 'Service unavailable - The server is temporarily unavailable',
                    504: 'Gateway timeout - The server took too long to respond'
                };
                
                return {
                    message: statusMessages[error.status] || `Error ${error.status}`,
                    details: error.statusText || 'Unknown error'
                };
            }
        }
        
        // Default for unknown errors
        return {
            message: 'An unknown error occurred',
            details: 'No additional details available'
        };
    }
    
    /**
     * Handle fetch request errors
     * @param {Promise} fetchPromise - The fetch promise
     * @param {Object} options - Options for error handling
     * @returns {Promise} Promise that handles common errors
     */
    async function handleFetchErrors(fetchPromise, options = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || 30000);
            
            const response = await fetchPromise({
                signal: controller.signal,
                ...options
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorData = {
                    status: response.status,
                    statusText: response.statusText,
                    message: `HTTP error ${response.status}`
                };
                
                // Try to parse JSON response for more details
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const jsonData = await response.json();
                        // Check for our enhanced error format
                        if (jsonData.errorId) {
                            errorData = {
                                ...jsonData,
                                status: response.status,
                                statusText: response.statusText
                            };
                        } else if (jsonData.error) {
                            errorData.message = jsonData.error;
                            errorData.details = jsonData.details || null;
                        }
                    } catch (e) {
                        // Failed to parse JSON, use default error data
                    }
                }
                
                throw errorData;
            }
            
            // Try to parse as JSON, but handle non-JSON responses gracefully
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            
            // For non-JSON responses
            return {
                success: true,
                data: await response.text()
            };
            
        } catch (error) {
            if (error.name === 'AbortError') {
                throw {
                    errorType: 'NETWORK',
                    typeName: 'Request Timeout',
                    status: 408,
                    statusText: 'Request timeout',
                    message: 'The request took too long to complete',
                    recoveryOptions: ['retry', 'offline']
                };
            }
            
            // Offline detection
            if (!navigator.onLine) {
                throw {
                    errorType: 'NETWORK',
                    typeName: 'Network Offline',
                    status: 0,
                    statusText: 'No internet connection',
                    message: 'Please check your network connection',
                    recoveryOptions: ['retry', 'offline', 'cache']
                };
            }
            
            throw error;
        }
    }
    
    /**
     * Get recovery options based on error type and context
     * @param {string} errorType - Type of error
     * @param {string} context - Context where error occurred
     * @returns {Array} Array of recovery option names
     */
    function getRecoveryOptions(errorType, context) {
        const errorTypeConfig = errorTypes[errorType] || errorTypes.default;
        let options = [...errorTypeConfig.recoveryOptions];
        
        // Add context-specific recovery options
        if (context === 'visualization') {
            if (!options.includes('client_viz')) {
                options.push('client_viz');
            }
        } else if (context === 'thingspeak' || context.includes('data')) {
            if (!options.includes('local_data')) {
                options.push('local_data');
            }
        }
        
        return options;
    }
    
    return {
        showError,
        showErrorToast,
        formatApiError,
        handleFetchErrors,
        getRecoveryOptions,
        errorTypes,
        recoveryHandlers
    };
})();

// Make it available globally
window.ErrorHandler = ErrorHandler;
