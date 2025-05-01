/**
 * ThingSpeak Connection Helper
 * Provides utilities for connecting to ThingSpeak API from the client side
 */

const ThingSpeakHelper = (function() {
    // Configuration - will be updated dynamically from the server
    const config = {
        apiBase: '/api/thingspeak',
        channelId: null,
        publicUrl: null
    };
    
    // Connection status
    let connectionStatus = {
        online: false,
        lastChecked: null,
        lastSuccess: null,
        error: null
    };
    
    /**
     * Initialize the helper with server configuration
     */
    async function init() {
        try {
            const response = await fetch('/api/thingspeak/config');
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            const serverConfig = await response.json();
            if (serverConfig.success && serverConfig.config) {
                // Update the configuration with values from the server
                config.channelId = serverConfig.config.channelId;
                config.publicUrl = `https://thingspeak.com/channels/${serverConfig.config.channelId}`;
                
                console.log('ThingSpeak helper initialized with channel:', config.channelId);
                return true;
            } else {
                throw new Error('Invalid config response from server');
            }
        } catch (error) {
            console.error('Failed to initialize ThingSpeak helper:', error);
            return false;
        }
    }
    
    /**
     * Check connection to ThingSpeak
     * @returns {Promise<Object>} Connection status
     */
    async function checkConnection() {
        try {
            connectionStatus.lastChecked = new Date();
            
            const response = await fetch(`${config.apiBase}/test-connection`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            const result = await response.json();
            
            connectionStatus = {
                ...connectionStatus,
                ...result,
                lastChecked: new Date()
            };
            
            if (result.success) {
                connectionStatus.lastSuccess = new Date();
            }
            
            return connectionStatus;
        } catch (error) {
            connectionStatus.online = false;
            connectionStatus.error = error.message;
            console.error('ThingSpeak connection check error:', error);
            return connectionStatus;
        }
    }
    
    /**
     * Get latest data from ThingSpeak
     * @param {Number} results - Number of results to fetch (default: 1)
     * @returns {Promise<Object>} Latest data
     */
    async function getLatestData(results = 1) {
        try {
            const response = await fetch(`${config.apiBase}/latest-feed?results=${results}`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching latest ThingSpeak data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get channel details
     * @returns {Promise<Object>} Channel details
     */
    async function getChannelDetails() {
        try {
            const response = await fetch(`${config.apiBase}/channel-details`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching ThingSpeak channel details:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Open ThingSpeak channel in a new window
     */
    function openThingSpeakChannel() {
        if (config.publicUrl) {
            window.open(config.publicUrl, '_blank');
        } else {
            console.error('Cannot open ThingSpeak channel: URL not configured');
        }
    }

    /**
     * Fetch data for a specific time period
     */
    async function fetchTimePeriod(days, results = 8000, includeAnalysis = true) {
        try {
            const url = new URL(`${config.apiBase}/direct`, window.location.origin);
            url.searchParams.append('days', days);
            url.searchParams.append('results', results);
            url.searchParams.append('analysis', includeAnalysis);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Unknown error fetching ThingSpeak data');
            }
            
            return data;
        } catch (error) {
            console.error(`Error fetching ThingSpeak data for ${days} days:`, error);
            
            // Log additional details for debugging
            if (window.ErrorLogger) {
                window.ErrorLogger.error('ThingSpeak data fetch failed', {
                    days,
                    results,
                    includeAnalysis,
                    error: error.message
                });
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    // Public API
    return {
        init,
        checkConnection,
        getLatestData,
        getChannelDetails,
        openThingSpeakChannel,
        fetchTimePeriod,
        getConfig: () => ({ ...config })
    };
})();

// Automatically initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    ThingSpeakHelper.init().then(success => {
        if (success) {
            console.log('ThingSpeak helper initialized successfully');
        } else {
            console.warn('ThingSpeak helper initialization failed, using default values');
        }
    });
});

// Make it globally available
window.ThingSpeakHelper = ThingSpeakHelper;
