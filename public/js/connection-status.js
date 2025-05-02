/**
 * Air Quality Monitoring System - Connection Status Management
 * Centralized connection status functionality to eliminate code duplication
 */

// Create a global ConnectionStatusManager object
const ConnectionStatusManager = (function() {
    // Status types
    const STATUS_TYPES = {
        CONNECTED: 'connected',
        DISCONNECTED: 'disconnected',
        WARNING: 'warning',
        ERROR: 'error',
        LOADING: 'loading'
    };
    
    /**
     * Update the status indicator and message in the UI
     * @param {string} status - One of: 'connected', 'disconnected', 'warning', 'error', or 'loading'
     * @param {string} message - Status message to display
     */
    function updateStatus(status, message) {
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
        
        // Dispatch a custom event for other components to listen to
        document.dispatchEvent(new CustomEvent('connectionstatuschange', { 
            detail: { status, message }
        }));
    }
    
    /**
     * Check if we have a connection to API endpoints
     * @returns {Promise<boolean>} True if connected, false otherwise
     */
    async function checkConnection() {
        try {
            const response = await fetch('/api/health/ping', { 
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' }
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.success === true;
            }
            return false;
        } catch (error) {
            console.error('Connection check failed:', error);
            return false;
        }
    }
    
    /**
     * Initialize periodic connection checking
     * @param {number} interval - Check interval in milliseconds
     */
    function startConnectionMonitoring(interval = 30000) {
        // Check immediately
        performConnectionCheck();
        
        // Then check periodically
        setInterval(performConnectionCheck, interval);
    }
    
    /**
     * Perform a connection check and update status accordingly
     */
    async function performConnectionCheck() {
        const isConnected = await checkConnection();
        
        if (isConnected) {
            updateStatus(STATUS_TYPES.CONNECTED, 'Connected');
        } else {
            updateStatus(STATUS_TYPES.DISCONNECTED, 'Disconnected');
        }
    }
    
    /**
     * Set status to warning with a custom message
     * @param {string} message - Warning message
     */
    function setWarning(message) {
        updateStatus(STATUS_TYPES.WARNING, message);
    }
    
    /**
     * Set status to error with a custom message
     * @param {string} message - Error message
     */
    function setError(message) {
        updateStatus(STATUS_TYPES.ERROR, message);
    }
    
    /**
     * Set status to loading with a custom message
     * @param {string} message - Loading message
     */
    function setLoading(message = 'Loading...') {
        updateStatus(STATUS_TYPES.LOADING, message);
    }
    
    /**
     * Set status to connected with a custom message
     * @param {string} message - Success message
     */
    function setConnected(message = 'Connected') {
        updateStatus(STATUS_TYPES.CONNECTED, message);
    }
    
    /**
     * Initialize connection status functionality
     */
    function init() {
        // Setup initial state
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                setLoading('Checking connection...');
                startConnectionMonitoring();
            });
        } else {
            setLoading('Checking connection...');
            startConnectionMonitoring();
        }
    }
    
    // Public API
    return {
        updateStatus,
        checkConnection,
        startConnectionMonitoring,
        setWarning,
        setError,
        setLoading,
        setConnected,
        init,
        STATUS_TYPES
    };
})();

// Initialize the connection status manager
ConnectionStatusManager.init();