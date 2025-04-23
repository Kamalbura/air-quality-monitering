/**
 * Data Loader - Handles loading data from various sources
 * Supports API, local CSV files, and fallback mechanisms
 */

const DataLoader = (function() {
    // Configuration
    const config = {
        apiEndpoint: '/api/data',
        defaultCsvPath: '/data/feeds.csv',
        useApiByDefault: true,
        maxRetries: 2,
        cacheExpiry: 15 * 60 * 1000, // 15 minutes in milliseconds
    };
    
    // Cache for loaded data
    let dataCache = {
        api: null,
        csv: null,
        lastApiUpdate: null,
        lastCsvUpdate: null
    };
    
    // State tracking
    let currentSource = config.useApiByDefault ? 'api' : 'csv';
    let isLoading = false;
    
    /**
     * Load data from the API endpoint
     * @param {Object} options - Options for loading data
     * @returns {Promise<Array>} - Promise resolving to data array
     */
    async function loadFromApi(options = {}) {
        const { filters = {}, forceReload = false } = options;
        
        // Check if cached data can be used
        if (!forceReload && 
            dataCache.api && 
            dataCache.lastApiUpdate && 
            (Date.now() - dataCache.lastApiUpdate < config.cacheExpiry)) {
            console.log('Using cached API data');
            return dataCache.api;
        }
        
        // Construct API URL with filters
        let url = `${config.apiEndpoint}?results=100`;
        
        if (filters.startDate) {
            url += `&start=${filters.startDate}`;
            if (filters.endDate) {
                url += `&end=${filters.endDate}`;
            }
        }
        
        // Fetch data from API
        if (window.ErrorHandler) {
            const fetchFn = (options) => fetch(url, options);
            const result = await window.ErrorHandler.handleFetchErrors(fetchFn);
            
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Invalid data format received from API');
            }
            
            const data = result.data.data?.feeds || [];
            
            // Cache the data
            dataCache.api = data;
            dataCache.lastApiUpdate = Date.now();
            
            return data;
        } else {
            // Fallback if ErrorHandler isn't available
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Invalid data format received from API');
            }
            
            const data = result.data.data?.feeds || [];
            
            // Cache the data
            dataCache.api = data;
            dataCache.lastApiUpdate = Date.now();
            
            return data;
        }
    }
    
    /**
     * Load data from a local CSV file
     * @param {Object} options - Options for loading CSV
     * @returns {Promise<Array>} - Promise resolving to data array
     */
    async function loadFromCsv(options = {}) {
        const { path = config.defaultCsvPath, forceReload = false } = options;
        
        // Check if cached data can be used
        if (!forceReload && 
            dataCache.csv && 
            dataCache.lastCsvUpdate && 
            (Date.now() - dataCache.lastCsvUpdate < config.cacheExpiry)) {
            console.log('Using cached CSV data');
            return dataCache.csv;
        }
        
        try {
            // Fetch the CSV file
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`CSV file fetch failed with status ${response.status}`);
            }
            
            const csvText = await response.text();
            
            // Parse CSV using csv-parser if available, otherwise use simple parsing
            let data;
            if (window.CsvParser) {
                data = window.CsvParser.parse(csvText);
            } else {
                // Simple CSV parsing fallback
                data = parseSimpleCsv(csvText);
            }
            
            // Format data to match API response structure
            const formattedData = formatCsvData(data);
            
            // Cache the data
            dataCache.csv = formattedData;
            dataCache.lastCsvUpdate = Date.now();
            
            return formattedData;
        } catch (error) {
            console.error('Error loading CSV data:', error);
            throw error;
        }
    }
    
    /**
     * Simple CSV parsing function (fallback if CsvParser not available)
     * @param {string} csvText - Raw CSV text
     * @returns {Array} Array of objects representing CSV rows
     */
    function parseSimpleCsv(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(val => val.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            return row;
        });
    }
    
    /**
     * Format CSV data to match API response structure
     * @param {Array} csvData - Raw CSV data objects
     * @returns {Array} - Formatted data matching API structure
     */
    function formatCsvData(csvData) {
        return csvData.map((row, index) => {
            // Try to use timestamp from CSV if it exists
            const timestamp = row.timestamp || row.created_at || row.date || new Date().toISOString();
            
            return {
                created_at: timestamp,
                entry_id: row.entry_id || index + 1,
                field1: row.humidity || row.field1 || null,
                field2: row.temperature || row.field2 || null,
                field3: row.pm25 || row.field3 || null,
                field4: row.pm10 || row.field4 || null,
                
                // Add direct property access for convenience
                humidity: row.humidity || row.field1 || null,
                temperature: row.temperature || row.field2 || null,
                pm25: row.pm25 || row.field3 || null,
                pm10: row.pm10 || row.field4 || null
            };
        });
    }
    
    /**
     * Load data with automatic source selection and fallback
     * @param {Object} options - Options for loading data
     * @returns {Promise<Object>} - Promise resolving to data object with source info
     */
    async function loadData(options = {}) {
        if (isLoading) {
            return { data: [], source: 'pending', message: 'Data loading already in progress' };
        }
        
        isLoading = true;
        const useCached = options.useCached || false;
        const preferredSource = options.preferredSource || currentSource;
        
        try {
            // Try preferred source first
            if (preferredSource === 'api') {
                try {
                    const apiData = await loadFromApi({ 
                        filters: options.filters, 
                        forceReload: !useCached 
                    });
                    
                    if (apiData && apiData.length > 0) {
                        currentSource = 'api';
                        isLoading = false;
                        return { 
                            data: apiData, 
                            source: 'api', 
                            message: 'Data loaded from API',
                            timestamp: new Date()
                        };
                    }
                    
                    // If API returned empty data, fall back to CSV
                    const csvData = await loadFromCsv({ forceReload: !useCached });
                    currentSource = 'csv';
                    isLoading = false;
                    return { 
                        data: csvData, 
                        source: 'csv', 
                        message: 'No API data available, using CSV data',
                        timestamp: new Date()
                    };
                } catch (apiError) {
                    // API failed, try CSV
                    console.warn('API data load failed, falling back to CSV:', apiError);
                    const csvData = await loadFromCsv({ forceReload: !useCached });
                    currentSource = 'csv';
                    isLoading = false;
                    return { 
                        data: csvData, 
                        source: 'csv', 
                        message: 'API data unavailable, using CSV data',
                        timestamp: new Date(),
                        error: apiError
                    };
                }
            } else {
                // CSV is preferred source
                try {
                    const csvData = await loadFromCsv({ 
                        path: options.csvPath, 
                        forceReload: !useCached 
                    });
                    
                    currentSource = 'csv';
                    isLoading = false;
                    return { 
                        data: csvData, 
                        source: 'csv', 
                        message: 'Data loaded from CSV',
                        timestamp: new Date()
                    };
                } catch (csvError) {
                    // CSV failed, try API as last resort
                    console.warn('CSV data load failed, trying API:', csvError);
                    const apiData = await loadFromApi({ forceReload: !useCached });
                    currentSource = 'api';
                    isLoading = false;
                    return { 
                        data: apiData, 
                        source: 'api', 
                        message: 'CSV data unavailable, using API data',
                        timestamp: new Date(),
                        error: csvError
                    };
                }
            }
        } catch (error) {
            // Both sources failed
            isLoading = false;
            throw new Error(`Failed to load data from any source: ${error.message}`);
        }
    }
    
    /**
     * Change the preferred data source
     * @param {string} source - Data source ('api' or 'csv')
     */
    function setDataSource(source) {
        if (source !== 'api' && source !== 'csv') {
            throw new Error('Invalid data source. Use "api" or "csv"');
        }
        
        currentSource = source;
    }
    
    /**
     * Get information about the current data source
     * @returns {Object} - Current data source information
     */
    function getDataSourceInfo() {
        return {
            currentSource,
            lastApiUpdate: dataCache.lastApiUpdate,
            lastCsvUpdate: dataCache.lastCsvUpdate,
            hasApiData: !!dataCache.api && dataCache.api.length > 0,
            hasCsvData: !!dataCache.csv && dataCache.csv.length > 0,
            isLoading
        };
    }
    
    /**
     * Set configuration options
     * @param {Object} newConfig - New configuration options
     */
    function configure(newConfig) {
        Object.assign(config, newConfig);
    }
    
    /**
     * Clear data cache
     * @param {string} source - Data source to clear ('api', 'csv', or 'all')
     */
    function clearCache(source = 'all') {
        if (source === 'api' || source === 'all') {
            dataCache.api = null;
            dataCache.lastApiUpdate = null;
        }
        
        if (source === 'csv' || source === 'all') {
            dataCache.csv = null;
            dataCache.lastCsvUpdate = null;
        }
    }
    
    // Public API
    return {
        loadData,
        loadFromApi,
        loadFromCsv,
        setDataSource,
        getDataSourceInfo,
        configure,
        clearCache
    };
})();

// Make it available globally
window.DataLoader = DataLoader;
