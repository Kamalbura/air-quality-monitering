# JavaScript Modules Documentation

## Theme Manager (`theme.js`)

The Theme Manager is a centralized utility for managing the application's theme (light/dark mode).

### Usage

1. Include the script in your HTML before other scripts that might use it:
   ```html
   <script src="/js/theme.js"></script>
   ```

2. Use the global `ThemeManager` object to interact with theme functionality:

   ```javascript
   // Get the current theme ('light' or 'dark')
   const currentTheme = ThemeManager.getCurrentTheme();
   
   // Toggle theme
   ThemeManager.toggleTheme();
   
   // Set a specific theme
   ThemeManager.setTheme('dark'); // or 'light'
   ```

3. Listen for theme changes in your scripts:

   ```javascript
   document.addEventListener('themechange', function(event) {
     const newTheme = event.detail.theme; // 'light' or 'dark'
     // Update your components accordingly
   });
   ```

### Features

- Automatically loads saved theme preferences
- Falls back to system color scheme preferences
- Fires events when theme changes
- Updates theme toggle icon
- Persists preferences to localStorage

## Visualization Loader (`viz-loader.js`)

The Visualization Loader improves performance by implementing lazy loading for charts and visualizations.

### Usage

1. Include the script in your HTML before visualization-dependent scripts:
   ```html
   <script src="/js/viz-loader.js"></script>
   ```

2. Use the global `VizLoader` object to manage lazy loading of charts:

   ```javascript
   // Register a chart for lazy loading
   VizLoader.observeChart(
     'chart-container-id',      // ID of the container element
     (canvasId, data) => {      // Function that creates and returns a chart
       return createMyChart(canvasId, data);
     },
     chartData,                 // Data needed for the chart (optional)
     true                       // High priority flag (optional)
   );
   
   // Manually destroy a chart
   VizLoader.destroyChart('chart-container-id');
   
   // Check if a chart is currently visible
   const isVisible = VizLoader.isChartVisible('chart-container-id');
   
   // Update all currently visible charts (e.g. after theme change)
   VizLoader.updateVisibility();
   ```

### Features

- Only loads charts when they become visible in the viewport
- Uses Intersection Observer API for performance
- Shows loading indicators during chart rendering
- Handles errors gracefully with user-friendly messages
- Supports chart destruction and cleanup
- Automatically updates charts when theme changes
- Optimizes memory usage by only keeping necessary charts in memory

## Error Handler (`error-handler.js`)

The Error Handler provides standardized error handling and user-friendly error messages across the application.

### Usage

1. Include the script in your HTML:
   ```html
   <script src="/js/error-handler.js"></script>
   ```

2. Use the global `ErrorHandler` object to display consistent error messages:
   ```javascript
   // Display error in a container
   ErrorHandler.showError(
     containerElement,        // DOM element or selector
     'Failed to load data',   // Error message
     'connection',            // Error type
     {                        // Options
       retryFn: () => loadData(),    // Retry function
       helpLink: '/help/data'        // Help documentation link
     }
   );
   
   // Show an error toast notification
   ErrorHandler.showErrorToast(
     'Unable to connect to server',  // Error message
     'api',                          // Error type
     {                               // Options
       details: error.message,       // Additional error details
       autoHide: false               // Don't auto-dismiss
     }
   );
   
   // Handle fetch errors
   try {
     const data = await ErrorHandler.handleFetchErrors(
       options => fetch('/api/data', options)
     );
   } catch (error) {
     const { message, details } = ErrorHandler.formatApiError(error);
     ErrorHandler.showErrorToast(message, 'api', { details });
   }
   ```

### Features

- Standardized error display formats across the application
- Consistent error categorization with appropriate styling
- Provides retry functionality for recoverable errors
- Toast notifications for transient errors
- Detailed error information for debugging
- Network status detection and appropriate messaging
- Timeout handling for API requests

## Data Loader (`data-loader.js`)

The Data Loader provides flexible data loading capabilities with support for multiple data sources and automatic fallback mechanisms.

### Usage

1. Include the script in your HTML:
   ```html
   <script src="/js/data-loader.js"></script>
   ```

2. Use the global `DataLoader` object to load data from different sources:
   ```javascript
   // Load data with automatic fallback
   const result = await DataLoader.loadData({
     filters: { startDate: '2023-05-01', endDate: '2023-05-15' }, // Optional filters
     preferredSource: 'api',  // Try API first, then CSV if API fails
     useCached: true          // Use cached data if available
   });
   
   // Load directly from API
   const apiData = await DataLoader.loadFromApi({
     filters: { startDate: '2023-05-01' }
   });
   
   // Load directly from CSV
   const csvData = await DataLoader.loadFromCsv({
     path: '/data/custom-data.csv'  // Default is '/data/default-data.csv'
   });
   
   // Change preferred data source
   DataLoader.setDataSource('csv');  // 'api' or 'csv'
   
   // Get information about current data source
   const sourceInfo = DataLoader.getDataSourceInfo();
   
   // Configure data loader settings
   DataLoader.configure({
     apiEndpoint: '/custom/api/endpoint',
     defaultCsvPath: '/data/alternate-data.csv',
     cacheExpiry: 60000  // 1 minute in milliseconds
   });
   
   // Clear cached data
   DataLoader.clearCache('all');  // 'api', 'csv', or 'all'
   ```

### Features

- Multiple data source support (API and CSV)
- Automatic fallback from API to CSV when API fails
- Data caching for improved performance
- Consistent data format regardless of source
- Filter support for API requests
- Source switching at runtime
- Detailed status information
