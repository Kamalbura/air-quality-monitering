/**
 * Error Handler - Standardized error handling for the Air Quality Monitoring System
 * Provides consistent error display and error recovery options
 */

const ErrorHandler = (function() {
    // Error types with corresponding bootstrap classes and icons
    const errorTypes = {
        data: {
            class: 'warning',
            icon: 'exclamation-triangle-fill',
            title: 'Data Error'
        },
        connection: {
            class: 'danger',
            icon: 'wifi-off',
            title: 'Connection Error'
        },
        visualization: {
            class: 'info',
            icon: 'graph-down',
            title: 'Visualization Error'
        },
        validation: {
            class: 'warning',
            icon: 'exclamation-circle',
            title: 'Validation Error'
        },
        api: {
            class: 'danger',
            icon: 'server',
            title: 'API Error'
        },
        auth: {
            class: 'danger',
            icon: 'lock-fill',
            title: 'Authentication Error'
        },
        default: {
            class: 'secondary',
            icon: 'question-circle',
            title: 'Unknown Error'
        }
    };
    
    /**
     * Create HTML for an error message
     * @param {string} message - Error message
     * @param {string} type - Error type ('data', 'connection', 'visualization', etc)
     * @param {Object} options - Additional options (retryFn, helpLink, etc)
     * @returns {string} HTML string
     */
    function createErrorHTML(message, type = 'default', options = {}) {
        const errorConfig = errorTypes[type] || errorTypes.default;
        const hasAction = options.retryFn || options.helpLink;
        
        let html = `
            <div class="alert alert-${errorConfig.class} d-flex align-items-center" role="alert">
                <i class="bi bi-${errorConfig.icon} me-2 flex-shrink-0"></i>
                <div class="flex-grow-1">
                    <h5 class="alert-heading">${options.title || errorConfig.title}</h5>
                    <p class="mb-${hasAction ? '3' : '0'}">${message}</p>`;
        
        // Add action buttons if needed
        if (hasAction) {
            html += `<div class="d-flex gap-2">`;
            
            if (options.retryFn) {
                html += `<button type="button" id="error-retry-btn" class="btn btn-sm btn-${errorConfig.class}">
                    <i class="bi bi-arrow-repeat me-1"></i> Retry
                </button>`;
            }
            
            if (options.helpLink) {
                html += `<a href="${options.helpLink}" target="_blank" class="btn btn-sm btn-outline-${errorConfig.class}">
                    <i class="bi bi-question-circle me-1"></i> Help
                </a>`;
            }
            
            html += `</div>`;
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
     * @param {string} type - Error type ('data', 'connection', 'visualization', etc)
     * @param {Object} options - Additional options (retryFn, helpLink, etc)
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
        
        return true;
    }
    
    /**
     * Create a toast notification for an error
     * @param {string} message - Error message
     * @param {string} type - Error type ('data', 'connection', 'visualization', etc)
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
                throw {
                    status: response.status,
                    statusText: response.statusText,
                    message: `HTTP error ${response.status}`
                };
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw {
                    status: 408,
                    statusText: 'Request timeout',
                    message: 'The request took too long to complete'
                };
            }
            
            // Offline detection
            if (!navigator.onLine) {
                throw {
                    status: 0,
                    statusText: 'No internet connection',
                    message: 'Please check your network connection'
                };
            }
            
            throw error;
        }
    }
    
    return {
        showError,
        showErrorToast,
        formatApiError,
        handleFetchErrors,
        errorTypes
    };
})();

// Make it available globally
window.ErrorHandler = ErrorHandler;
