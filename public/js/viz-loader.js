/**
 * Visualization Loader - Lazy loading for visualizations
 * Improves performance by only rendering charts when they are visible
 */

class VizLoader {
    /**
     * Create a new visualization loader
     */
    constructor() {
        this.observers = new Map();
        this.visibleCharts = new Set();
        this.loadedCharts = new Map();
        this.renderQueue = new Map();
        this.fullDataset = null;
        this.options = {
            rootMargin: '100px',  // Load slightly before becoming visible
            threshold: 0.1        // Start loading when 10% of element is visible
        };

        // Configuration
        this.config = {
            debugMode: false,        // Enable for additional logging
            maxRetries: 2,           // Maximum number of retry attempts
            errorRecovery: true      // Auto-retry on error
        };

        // Bind methods to preserve 'this' context
        this.observeChart = this.observeChart.bind(this);
        this.handleIntersection = this.handleIntersection.bind(this);
        this.loadChart = this.loadChart.bind(this);
        this.destroyChart = this.destroyChart.bind(this);
        this.destroyAllCharts = this.destroyAllCharts.bind(this);
        this.updateVisibility = this.updateVisibility.bind(this);
        this.setFullDataset = this.setFullDataset.bind(this);
        
        // Update visibility on resize and orientation change
        window.addEventListener('resize', this.updateVisibility);
        window.addEventListener('orientationchange', this.updateVisibility);
        
        // Listen for theme changes
        document.addEventListener('themechange', this.updateVisibility);
    }

    /**
     * Register a chart for lazy loading
     * @param {string} containerId - ID of the container element
     * @param {Function} renderFn - Function to call when chart should render
     * @param {Object} data - Data needed for rendering
     * @param {boolean} highPriority - Whether this chart should be prioritized
     */
    observeChart(containerId, renderFn, data = null, highPriority = false) {
        const container = document.getElementById(containerId);
        if (!container) return false;
        
        // Create loading indicator
        this.showLoadingIndicator(container);
        
        // Store render function and data for later use
        this.renderQueue.set(containerId, { 
            renderFn, 
            data, 
            priority: highPriority ? 1 : 0,
            isProcessing: false
        });
        
        // Create observer if not already observing
        if (!this.observers.has(containerId)) {
            const observer = new IntersectionObserver(
                entries => this.handleIntersection(entries, containerId),
                this.options
            );
            observer.observe(container);
            this.observers.set(containerId, observer);
        }
        
        return true;
    }
    
    /**
     * Handle intersection events when chart containers enter/leave viewport
     * @param {IntersectionObserverEntry[]} entries - Intersection entries
     * @param {string} containerId - ID of the container being observed
     */
    handleIntersection(entries, containerId) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Element is visible, load chart
                this.visibleCharts.add(containerId);
                this.loadChart(containerId);
            } else {
                // Element is not visible
                this.visibleCharts.delete(containerId);
            }
        });
    }
    
    /**
     * Set the full dataset for all visualizations
     * @param {Array} data - Complete dataset
     */
    setFullDataset(data) {
        if (!data || !Array.isArray(data)) {
            console.warn('Invalid dataset provided to VizLoader');
            return false;
        }
        
        this.fullDataset = [...data];
        
        // Re-render visible charts with new data
        for (const containerId of this.visibleCharts) {
            if (this.renderQueue.has(containerId)) {
                const queueItem = this.renderQueue.get(containerId);
                queueItem.data = this.fullDataset;
                this.loadChart(containerId, true);
            }
        }
        
        return true;
    }
    
    /**
     * Load a chart when its container is visible
     * @param {string} containerId - ID of the container
     * @param {boolean} forceReload - Whether to force reload even if already loaded
     * @returns {boolean} - Whether the chart was loaded
     */
    loadChart(containerId, forceReload = false) {
        if (!this.renderQueue.has(containerId)) return false;
        
        const queueItem = this.renderQueue.get(containerId);
        
        // Skip if already processing or loaded (unless force reload)
        if (queueItem.isProcessing || (!forceReload && this.loadedCharts.has(containerId))) return false;
        
        queueItem.isProcessing = true;
        
        // Get chart container
        const container = document.getElementById(containerId);
        if (!container) {
            queueItem.isProcessing = false;
            return false;
        }
        
        try {
            // Clear loading indicator
            container.innerHTML = '';
            
            // Create canvas if it doesn't exist
            if (!container.querySelector('canvas')) {
                const canvas = document.createElement('canvas');
                canvas.id = `${containerId}-canvas`;
                container.appendChild(canvas);
            }
            
            // Ensure we have data to render
            const dataToUse = queueItem.data || this.fullDataset;
            if (!dataToUse || (Array.isArray(dataToUse) && dataToUse.length === 0)) {
                throw new Error('No data available for visualization');
            }
            
            // Call render function
            const chart = queueItem.renderFn(container.querySelector('canvas').id, dataToUse);
            
            // Store the chart instance
            if (chart) {
                this.loadedCharts.set(containerId, chart);
                
                if (this.config.debugMode) {
                    console.log(`Chart loaded: ${containerId}`);
                }
                
                // Reset error count on successful load
                queueItem.errorCount = 0;
            }
            
            queueItem.isProcessing = false;
            return true;
        } catch (error) {
            console.error(`Error loading chart ${containerId}:`, error);
            
            // Track error count
            queueItem.errorCount = (queueItem.errorCount || 0) + 1;
            const canRetry = this.config.errorRecovery && queueItem.errorCount <= this.config.maxRetries;
            
            // Use ErrorHandler if available, otherwise fall back to basic error display
            if (window.ErrorHandler) {
                window.ErrorHandler.showError(container, 
                    error.message || 'Failed to load visualization', 
                    'visualization',
                    {
                        retryFn: canRetry ? () => this.loadChart(containerId, true) : null,
                        helpLink: '/help/visualizations',
                        details: error.stack
                    }
                );
                
                // Also show toast for visibility
                window.ErrorHandler.showErrorToast(
                    `Visualization "${containerId}" failed to load`,
                    'visualization',
                    {
                        details: error.message
                    }
                );
            } else {
                // Basic fallback if ErrorHandler isn't available
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>Visualization Error</strong>: ${error.message || 'Failed to load'}
                        ${canRetry ? '<button class="btn btn-sm btn-danger mt-2" onclick="window.VizLoader.loadChart(\'' + containerId + '\', true)">Retry</button>' : ''}
                    </div>`;
            }
            
            queueItem.isProcessing = false;
            return false;
        }
    }
    
    /**
     * Destroy a chart instance and clean up
     * @param {string} containerId - ID of the container
     */
    destroyChart(containerId) {
        // Destroy chart instance if it exists
        if (this.loadedCharts.has(containerId)) {
            try {
                const chart = this.loadedCharts.get(containerId);
                if (chart && typeof chart.destroy === 'function') {
                    chart.destroy();
                }
            } catch (e) {
                console.warn(`Error destroying chart ${containerId}:`, e);
            }
            
            this.loadedCharts.delete(containerId);
        }
        
        // Stop observing
        if (this.observers.has(containerId)) {
            const observer = this.observers.get(containerId);
            observer.disconnect();
            this.observers.delete(containerId);
        }
        
        // Remove from render queue
        this.renderQueue.delete(containerId);
        
        // Remove from visible charts
        this.visibleCharts.delete(containerId);
    }
    
    /**
     * Destroy all chart instances and clean up
     */
    destroyAllCharts() {
        for (const containerId of this.loadedCharts.keys()) {
            this.destroyChart(containerId);
        }
    }
    
    /**
     * Show loading indicator in a container
     * @param {HTMLElement} container - Container element
     */
    showLoadingIndicator(container) {
        container.innerHTML = `
            <div class="d-flex justify-content-center align-items-center h-100">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading visualization...</span>
                </div>
            </div>
        `;
    }
    
    /**
     * Update visibility of all charts (useful after layout changes)
     */
    updateVisibility() {
        // Re-load visible charts
        for (const containerId of this.visibleCharts) {
            // Destroy existing chart
            if (this.loadedCharts.has(containerId)) {
                try {
                    const chart = this.loadedCharts.get(containerId);
                    if (chart && typeof chart.destroy === 'function') {
                        chart.destroy();
                    }
                } catch (e) {
                    console.warn(`Error destroying chart ${containerId}:`, e);
                }
                
                this.loadedCharts.delete(containerId);
            }
            
            // Re-load the chart
            this.loadChart(containerId);
        }
    }
    
    /**
     * Check if a chart is currently visible
     * @param {string} containerId - ID of the container
     * @returns {boolean} - Whether the chart is visible
     */
    isChartVisible(containerId) {
        return this.visibleCharts.has(containerId);
    }
}

// Create global instance
window.VizLoader = new VizLoader();
