/**
 * Connection Checker - Monitors backend connectivity
 * Provides reliable connection status information and auto-reconnect functionality
 */

const ConnectionChecker = (function() {
    // Private variables
    const STATUS = {
        UNKNOWN: 'unknown',
        CHECKING: 'checking',
        CONNECTED: 'connected',
        DISCONNECTED: 'disconnected',
        LIMITED: 'limited'  // Connected but with limitations
    };
    
    const config = {
        checkInterval: 30000,  // 30 seconds
        pingEndpoint: '/api/ping',
        maxRetries: 3,
        retryDelay: 5000       // 5 seconds
    };
    
    let status = STATUS.UNKNOWN;
    let checkTimer = null;
    let retryCount = 0;
    let statusChangeCallbacks = [];
    
    /**
     * Start checking backend connectivity
     */
    function start() {
        if (checkTimer) {
            clearInterval(checkTimer);
        }
        
        // Immediate check
        checkConnection();
        
        // Schedule regular checks
        checkTimer = setInterval(checkConnection, config.checkInterval);
        
        // Also check when online status changes
        window.addEventListener('online', handleOnlineStatusChange);
        window.addEventListener('offline', handleOnlineStatusChange);
        
        return this;
    }
    
    /**
     * Stop checking backend connectivity
     */
    function stop() {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        
        window.removeEventListener('online', handleOnlineStatusChange);
        window.removeEventListener('offline', handleOnlineStatusChange);
        
        return this;
    }
    
    /**
     * Handle browser online/offline status changes
     */
    function handleOnlineStatusChange(event) {
        if (event.type === 'offline') {
            updateStatus(STATUS.DISCONNECTED);
            if (checkTimer) {
                clearInterval(checkTimer);
                checkTimer = null;
            }
        } else {
            // If we're back online, check connection and restart timer
            checkConnection();
            if (!checkTimer) {
                checkTimer = setInterval(checkConnection, config.checkInterval);
            }
        }
    }
    
    /**
     * Check backend connection by sending a ping request
     */
    async function checkConnection() {
        if (!navigator.onLine) {
            updateStatus(STATUS.DISCONNECTED);
            return false;
        }
        
        updateStatus(STATUS.CHECKING);
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch(config.pingEndpoint, {
                method: 'GET',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                // If we get a successful response, reset retry count and update status
                retryCount = 0;
                updateStatus(STATUS.CONNECTED);
                return true;
            } else {
                handleConnectionFailure();
                return false;
            }
        } catch (error) {
            console.log('Connection check error:', error.name === 'AbortError' ? 'Timeout' : error.message);
            handleConnectionFailure();
            return false;
        }
    }
    
    /**
     * Handle connection failures with retry logic
     */
    function handleConnectionFailure() {
        retryCount++;
        
        if (retryCount <= config.maxRetries) {
            console.log(`Connection retry ${retryCount} of ${config.maxRetries} in ${config.retryDelay}ms`);
            updateStatus(STATUS.LIMITED);
            
            // Retry after delay
            setTimeout(checkConnection, config.retryDelay);
        } else {
            console.log('Connection retries exhausted');
            updateStatus(STATUS.DISCONNECTED);
        }
    }
    
    /**
     * Update connection status and trigger callbacks
     * @param {string} newStatus - New connection status
     */
    function updateStatus(newStatus) {
        if (newStatus !== status) {
            const oldStatus = status;
            status = newStatus;
            
            // Trigger callbacks
            statusChangeCallbacks.forEach(callback => {
                try {
                    callback(status, oldStatus);
                } catch (err) {
                    console.error('Error in connection status change callback:', err);
                }
            });
        }
    }
    
    /**
     * Get current connection status
     * @returns {string} Current status
     */
    function getStatus() {
        return status;
    }
    
    /**
     * Check if backend is connected
     * @returns {boolean} True if connected or limited
     */
    function isConnected() {
        return status === STATUS.CONNECTED || status === STATUS.LIMITED;
    }
    
    /**
     * Force a connection check immediately
     * @returns {Promise<boolean>} Promise resolving to connection status
     */
    function checkNow() {
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = setInterval(checkConnection, config.checkInterval);
        }
        
        return checkConnection();
    }
    
    /**
     * Add connection status change callback
     * @param {Function} callback - Function to call on status change
     */
    function onStatusChange(callback) {
        if (typeof callback === 'function' && !statusChangeCallbacks.includes(callback)) {
            statusChangeCallbacks.push(callback);
        }
        
        return this;
    }
    
    /**
     * Remove connection status change callback
     * @param {Function} callback - Function to remove
     */
    function offStatusChange(callback) {
        const index = statusChangeCallbacks.indexOf(callback);
        if (index !== -1) {
            statusChangeCallbacks.splice(index, 1);
        }
        
        return this;
    }
    
    /**
     * Configure the connection checker
     * @param {Object} options - Configuration options
     */
    function configure(options) {
        Object.assign(config, options);
        return this;
    }
    
    // Return public API
    return {
        start,
        stop,
        getStatus,
        isConnected,
        checkNow,
        onStatusChange,
        offStatusChange,
        configure,
        STATUS
    };
})();

// Auto-start connection checker when script loads
ConnectionChecker.start();
