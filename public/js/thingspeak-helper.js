/**
 * ThingSpeak Helper
 * Client-side utility for ThingSpeak API operations
 */

const ThingSpeakHelper = (function() {
    // Configuration
    let config = {
        channelId: '2863798',
        readApiKey: 'RIXYDDDMXDBX9ALI',
        writeApiKey: '',
        apiBase: 'https://api.thingspeak.com',
        fields: {
            humidity: 'field1',
            temperature: 'field2',
            pm25: 'field3',
            pm10: 'field4'
        }
    };
    
    // State tracking
    let connectionStatus = false;
    let lastError = null;
    const configListeners = [];
    
    /**
     * Initialize configuration from server
     */
    async function init() {
        try {
            const response = await fetch('/api/thingspeak/config');
            if (response.ok) {
                const serverConfig = await response.json();
                if (serverConfig.success && serverConfig.config) {
                    config = { ...config, ...serverConfig.config };
                    console.log('ThingSpeak helper initialized with server config');
                }
            }
        } catch (error) {
            console.warn('Could not load server config, using defaults:', error);
        }
        
        // Load from localStorage as fallback
        const savedConfig = localStorage.getItem('thingspeak_config');
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                config = { ...config, ...parsed };
            } catch (error) {
                console.warn('Invalid saved config in localStorage');
            }
        }
        
        return config;
    }
    
    /**
     * Get API URL for endpoint
     */
    function getApiUrl(endpoint) {
        return `${config.apiBase}/${endpoint}`;
    }
    
    /**
     * Fetch all available data from ThingSpeak channel with progress reporting
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} All channel data
     */
    async function fetchAllChannelData(options = {}) {
        try {
            console.log('Fetching all available ThingSpeak data...');
            
            // Show progress if callback provided
            const onProgress = options.onProgress || (() => {});
            
            // Use server-side endpoint for comprehensive data fetching
            const response = await fetch('/api/thingspeak/fetch-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    includeAnalysis: options.includeAnalysis !== false,
                    chunkSize: options.chunkSize || 8000
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to fetch all data');
            }
            
            connectionStatus = true;
            onProgress(100, result.data.total_records);
            return result;
            
        } catch (error) {
            connectionStatus = false;
            lastError = error;
            console.error('Error fetching all ThingSpeak data:', error);
            
            // Fallback to direct API with progress
            return await fetchAllDataWithPagination({ ...options, onProgress });
        }
    }
    
    /**
     * Fallback method to fetch all data using pagination with progress
     */
    async function fetchAllDataWithPagination(options = {}) {
        console.log('Using fallback pagination method...');
        
        const onProgress = options.onProgress || (() => {});
        let allData = [];
        let lastEntryId = null;
        let hasMoreData = true;
        let pageCount = 0;
        const maxPages = 50; // Safety limit
        
        while (hasMoreData && pageCount < maxPages) {
            try {
                onProgress((pageCount / maxPages) * 90, allData.length); // Max 90% until complete
                
                const params = new URLSearchParams({
                    api_key: config.readApiKey,
                    results: '8000'
                });
                
                if (lastEntryId) {
                    params.append('start', lastEntryId);
                }
                
                const url = getApiUrl(`channels/${config.channelId}/feeds.json?${params.toString()}`);
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`ThingSpeak API returned ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.feeds || data.feeds.length === 0) {
                    hasMoreData = false;
                    break;
                }
                
                // Process and add data in chunks to avoid memory issues
                const processedChunk = [];
                for (let i = 0; i < data.feeds.length; i += 1000) {
                    const chunk = data.feeds.slice(i, i + 1000);
                    const processedData = chunk.map(feed => ({
                        entry_id: feed.entry_id,
                        created_at: feed.created_at,
                        field1: feed.field1,
                        field2: feed.field2,
                        field3: feed.field3,
                        field4: feed.field4,
                        humidity: feed[config.fields.humidity],
                        temperature: feed[config.fields.temperature],
                        pm25: feed[config.fields.pm25],
                        pm10: feed[config.fields.pm10]
                    }));
                    processedChunk.push(...processedData);
                }
                
                allData = allData.concat(processedChunk);
                
                // Set up for next iteration
                lastEntryId = data.feeds[data.feeds.length - 1].entry_id;
                pageCount++;
                
                // If we got less than the max results, we've reached the end
                if (data.feeds.length < 8000) {
                    hasMoreData = false;
                }
                
                console.log(`Fetched page ${pageCount}, total records: ${allData.length}`);
                
                // Memory management - limit client-side processing
                if (allData.length > 100000) {
                    console.log('Large dataset detected, stopping client-side fetch');
                    hasMoreData = false;
                }
                
            } catch (error) {
                console.error(`Error fetching page ${pageCount + 1}:`, error);
                hasMoreData = false;
            }
        }
        
        onProgress(100, allData.length);
        
        return {
            success: true,
            data: {
                data: allData,
                totalRecords: allData.length,
                pagesLoaded: pageCount,
                channel: { id: config.channelId },
                clientSideFetch: true
            }
        };
    }
    
    /**
     * Fetch channel data with flexible options
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} Channel data
     */
    async function fetchChannelData(options = {}) {
        const { results = 100, days, start, end, fetchAll = false } = options;
        
        if (fetchAll) {
            return await fetchAllChannelData(options);
        }
        
        try {
            // Prefer server-side processing through our API
            try {
                const params = new URLSearchParams({
                    results: results.toString(),
                    days: days || '',
                    start: start || '',
                    end: end || ''
                });
                
                const apiResponse = await fetch(`/api/thingspeak/data?${params.toString()}`);
                
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
     * Fetch data for a specific time period with comprehensive options
     */
    async function fetchTimePeriod(days = 7, results = 500, includeAnalysis = false) {
        const options = {
            days: days === 'all' ? null : parseInt(days),
            results: results === 'unlimited' ? null : parseInt(results),
            includeAnalysis,
            fetchAll: days === 'all' || results === 'unlimited'
        };
        
        if (options.fetchAll) {
            console.log('Fetching all available data from ThingSpeak...');
            return await fetchAllChannelData(options);
        }
        
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
                const data = await fetchChannelData(options);
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
    
    // Public API
    return {
        init,
        fetchChannelData,
        fetchAllChannelData,
        fetchTimePeriod,
        getLatestFeed,
        getChannelDetails,
        getConfig: () => ({ ...config }),
        addEventListener: (listener) => {
            if (typeof listener === 'function' && !configListeners.includes(listener)) {
                configListeners.push(listener);
            }
        }
    };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    ThingSpeakHelper.init().then(success => {
        console.log('ThingSpeak helper initialized');
    });
});

// Make it globally available
window.ThingSpeakHelper = ThingSpeakHelper;
