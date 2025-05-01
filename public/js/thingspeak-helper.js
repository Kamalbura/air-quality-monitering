/**
 * ThingSpeak Helper
 * Client-side utility for ThingSpeak API operations
 */

const ThingSpeakHelper = (function() {
    // Private variables
    let config = {
        channelId: null,
        readApiKey: null,
        writeApiKey: null,
        updateInterval: 30000,
        fields: {
            humidity: 'field1',
            temperature: 'field2',
            pm25: 'field3',
            pm10: 'field4'
        }
    };
    
    let configListeners = [];
    let connectionStatus = false;
    let lastError = null;
    
    /**
     * Initialize ThingSpeak Helper
     */
    async function init() {
        try {
            // Try to fetch config from server
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success && data.data && data.data.thingspeak) {
                config = { ...config, ...data.data.thingspeak };
                console.log('Loaded ThingSpeak config from server');
            }
        } catch (error) {
            console.warn('Failed to load ThingSpeak config from server:', error);
            console.log('Using default ThingSpeak config');
            
            // Try localStorage as fallback
            const storedConfig = localStorage.getItem('thingspeak_config');
            if (storedConfig) {
                try {
                    const parsedConfig = JSON.parse(storedConfig);
                    config = { ...config, ...parsedConfig };
                    console.log('Loaded ThingSpeak config from localStorage');
                } catch (e) {
                    console.warn('Failed to parse ThingSpeak config from localStorage');
                }
            }
        }
        
        // Check if we have minimum config
        if (!config.channelId) {
            console.warn('No ThingSpeak channel ID configured');
        }
        
        return config;
    }
    
    /**
     * Get ThingSpeak API URL
     * @param {string} endpoint - API endpoint
     * @returns {string} Full API URL
     */
    function getApiUrl(endpoint) {
        return `https://api.thingspeak.com/${endpoint}`;
    }
    
    /**
     * Get channel feed URL
     * @param {Object} options - Options for the feed
     * @returns {string} Channel feed URL
     */
    function getChannelFeedUrl(options = {}) {
        const { results = 100, days, start, end } = options;
        
        if (!config.channelId) {
            throw new Error('No channel ID configured');
        }
        
        let url = getApiUrl(`channels/${config.channelId}/feeds.json`);
        
        // Build query parameters
        const params = new URLSearchParams();
        
        if (config.readApiKey) {
            params.append('api_key', config.readApiKey);
        }
        
        params.append('results', results);
        
        if (days) {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            params.append('start', startDate.toISOString());
            params.append('end', endDate.toISOString());
        } else {
            if (start) params.append('start', start);
            if (end) params.append('end', end);
        }
        
        return `${url}?${params.toString()}`;
    }
    
    /**
     * Fetch channel data
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Channel data
     */
    async function fetchChannelData(options = {}) {
        try {
            // Prefer server-side processing through our API
            try {
                const apiResponse = await fetch(`/api/thingspeak/data?${new URLSearchParams({
                    results: options.results || 100,
                    days: options.days || '',
                    start: options.start || '',
                    end: options.end || ''
                })}`);
                
                if (apiResponse.ok) {
                    return await apiResponse.json();
                }
                
                console.warn('Server-side ThingSpeak API failed, falling back to direct ThingSpeak API');
            } catch (apiError) {
                console.warn('Error using server ThingSpeak proxy:', apiError);
                console.log('Falling back to direct ThingSpeak API');
            }
            
            // Direct ThingSpeak API fallback
            const url = getChannelFeedUrl(options);
            
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`ThingSpeak API returned ${response.status}`);
            }
            
            const data = await response.json();
            
            // Normalize data to match our expected format
            const normalizedData = {
                success: true,
                data: data.feeds.map(feed => ({
                    entry_id: feed.entry_id,
                    created_at: feed.created_at,
                    field1: feed.field1,
                    field2: feed.field2,
                    field3: feed.field3,
                    field4: feed.field4,
                    field5: feed.field5,
                    field6: feed.field6,
                    field7: feed.field7,
                    field8: feed.field8,
                    // Add semantic mappings based on config
                    humidity: feed[config.fields.humidity],
                    temperature: feed[config.fields.temperature],
                    pm25: feed[config.fields.pm25],
                    pm10: feed[config.fields.pm10]
                })),
                channel: data.channel
            };
            
            connectionStatus = true;
            return normalizedData;
        } catch (error) {
            connectionStatus = false;
            lastError = error;
            console.error('Error fetching ThingSpeak data:', error);
            
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }
    
    /**
     * Get the latest data point
     * @returns {Promise<Object>} Latest data
     */
    async function getLatestFeed() {
        // Try server endpoint first
        try {
            const response = await fetch('/api/thingspeak/latest-feed');
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.warn('Error fetching latest feed from server:', error);
        }
        
        // Fallback to direct ThingSpeak
        const data = await fetchChannelData({ results: 1 });
        
        if (data.success && data.data && data.data.length > 0) {
            const latestFeed = data.data[0];
            
            return {
                success: true,
                data: latestFeed,
                timestamp: new Date().toISOString()
            };
        }
        
        return {
            success: false,
            error: 'No data available',
            timestamp: new Date().toISOString()
        };
    }
    
    /**
     * Get channel details
     * @returns {Promise<Object>} Channel details
     */
    async function getChannelDetails() {
        try {
            // Try server endpoint first
            try {
                const response = await fetch('/api/thingspeak/channel-details');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        return data.data;
                    }
                }
            } catch (error) {
                console.warn('Error fetching channel details from server:', error);
            }
            
            // Fallback to direct ThingSpeak API
            if (!config.channelId) {
                throw new Error('No channel ID configured');
            }
            
            const url = getApiUrl(`channels/${config.channelId}.json`);
            const params = new URLSearchParams();
            
            if (config.readApiKey) {
                params.append('api_key', config.readApiKey);
            }
            
            const response = await fetch(`${url}?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`ThingSpeak API returned ${response.status}`);
            }
            
            const data = await response.json();
            connectionStatus = true;
            
            return data;
        } catch (error) {
            connectionStatus = false;
            lastError = error;
            console.error('Error fetching ThingSpeak channel details:', error);
            
            return null;
        }
    }
    
    /**
     * Check ThingSpeak availability
     * @returns {Promise<boolean>} Whether ThingSpeak is available
     */
    async function checkAvailability() {
        try {
            // Try server status endpoint first
            try {
                const response = await fetch('/api/thingspeak/status');
                if (response.ok) {
                    const data = await response.json();
                    connectionStatus = data.connected || data.success;
                    return connectionStatus;
                }
            } catch (error) {
                console.warn('Error checking ThingSpeak status from server:', error);
            }
            
            // Fallback to direct ThingSpeak ping
            const response = await fetch('https://api.thingspeak.com/ping.json');
            connectionStatus = response.ok;
            return connectionStatus;
        } catch (error) {
            connectionStatus = false;
            lastError = error;
            console.error('Error checking ThingSpeak availability:', error);
            
            return false;
        }
    }
    
    /**
     * Test ThingSpeak connection
     * @returns {Promise<Object>} Connection test results
     */
    async function testConnection() {
        try {
            const response = await fetch('/api/thingspeak/test-connection');
            if (response.ok) {
                return await response.json();
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (error) {
            console.error('Error testing ThingSpeak connection:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Fetch data for a specific time period
     * @param {number} days - Number of days
     * @param {number} results - Maximum number of results
     * @param {boolean} includeAnalysis - Whether to include analysis
     * @returns {Promise<Object>} ThingSpeak data
     */
    async function fetchTimePeriod(days = 7, results = 500, includeAnalysis = false) {
        try {
            const response = await fetch(`/api/thingspeak/direct?days=${days}&results=${results}&analysis=${includeAnalysis}`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching ThingSpeak time period:', error);
            
            // Fallback to direct fetch
            console.log('Falling back to direct ThingSpeak API');
            
            try {
                const data = await fetchChannelData({ days, results });
                return {
                    success: data.success,
                    data: {
                        data: data.data,
                        channel: data.channel
                    }
                };
            } catch (directError) {
                console.error('Direct ThingSpeak fetch also failed:', directError);
                return {
                    success: false,
                    error: directError.message
                };
            }
        }
    }
    
    /**
     * Update ThingSpeak configuration
     * @param {Object} newConfig - New configuration values
     * @returns {Promise<Object>} Update result
     */
    async function updateConfig(newConfig) {
        try {
            // Update server-side config
            const response = await fetch('/api/thingspeak/update-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            
            const result = await response.json();
            
            // Update local config
            config = { ...config, ...newConfig };
            
            // Store in localStorage
            localStorage.setItem('thingspeak_config', JSON.stringify(config));
            
            // Notify listeners
            configListeners.forEach(listener => {
                try {
                    listener(config);
                } catch (error) {
                    console.error('Error in config listener:', error);
                }
            });
            
            return result;
        } catch (error) {
            console.error('Error updating ThingSpeak config:', error);
            
            // Still update local config for offline usage
            config = { ...config, ...newConfig };
            localStorage.setItem('thingspeak_config', JSON.stringify(config));
            
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Get current ThingSpeak configuration
     * @returns {Object} Current configuration
     */
    function getConfig() {
        return { ...config };
    }
    
    /**
     * Add configuration change listener
     * @param {Function} listener - Listener function
     */
    function addEventListener(listener) {
        if (typeof listener === 'function' && !configListeners.includes(listener)) {
            configListeners.push(listener);
        }
    }
    
    /**
     * Remove configuration change listener
     * @param {Function} listener - Listener function
     */
    function removeEventListener(listener) {
        const index = configListeners.indexOf(listener);
        if (index !== -1) {
            configListeners.splice(index, 1);
        }
    }
    
    /**
     * Get connection status
     * @returns {Object} Connection status info
     */
    function getConnectionStatus() {
        return {
            connected: connectionStatus,
            lastError: lastError ? lastError.message : null
        };
    }
    
    // Initialize on load
    init();
    
    // Public API
    return {
        init,
        fetchChannelData,
        getLatestFeed,
        getChannelDetails,
        checkAvailability,
        testConnection,
        fetchTimePeriod,
        updateConfig,
        getConfig,
        addEventListener,
        removeEventListener,
        getConnectionStatus
    };
})();

// Make it globally available
window.ThingSpeakHelper = ThingSpeakHelper;
