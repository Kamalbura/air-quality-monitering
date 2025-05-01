/**
 * ThingSpeak Info Page JavaScript
 * Displays detailed information about the ThingSpeak channel
 * Uses the ThingSpeakHelper to fetch and display data
 */

class ThingSpeakInfoPage {
    constructor() {
        // Configuration
        this.config = {
            apiBase: '/api',
            updateInterval: 30000, // 30-second refresh for real-time data
            chartTheme: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
            retryLimit: 3
        };
        
        // Application state
        this.state = {
            channelDetails: null,
            latestData: null,
            channelStatus: null,
            charts: {
                radar: null,
                gauge: null
            },
            lastUpdated: null,
            retryCount: 0,
            liveUpdateTimer: null
        };
        
        // Initialize DOM element references
        this.initDOMElements();
        
        // Bind methods to preserve this context
        this.refreshAllData = this.refreshAllData.bind(this);
        this.refreshLatestData = this.refreshLatestData.bind(this);
        this.updateChannelDetails = this.updateChannelDetails.bind(this);
        this.updateLatestData = this.updateLatestData.bind(this);
        this.updateFieldMapping = this.updateFieldMapping.bind(this);
        this.updateApiUsage = this.updateApiUsage.bind(this);
        this.updateVisualizations = this.updateVisualizations.bind(this);
        this.toggleTheme = this.toggleTheme.bind(this);
        this.setupExtraUI = this.setupExtraUI.bind(this);
    }

    /**
     * Initialize DOM element references
     */
    initDOMElements() {
        // Main page elements
        this.elements = {
            statusIndicator: document.getElementById('status-indicator'),
            statusText: document.getElementById('status-text'),
            channelDetailsContainer: document.querySelector('.channel-details-container'),
            latestDataContainer: document.querySelector('.latest-data-container'),
            fieldMappingContainer: document.querySelector('.field-mapping-container'),
            apiUsageContainer: document.querySelector('.api-usage-container'),
            channelStatusBadge: document.getElementById('channel-status-badge'),
            refreshButton: document.getElementById('refreshChannelData'),
            toggleTheme: document.getElementById('toggleTheme'),
            toastContainer: document.getElementById('toast-container'),
            liveRadarChart: document.getElementById('liveRadarChart'),
            liveAQIGauge: document.getElementById('liveAQIGauge'),
            csvUpdateBtn: document.getElementById('csvUpdateBtn'),
            csvUpdateStatus: document.getElementById('csvUpdateStatus')
        };
        
        // Create elements if they don't exist
        this.createMissingElements();
    }

    /**
     * Create any missing elements that are needed
     */
    createMissingElements() {
        // Ensure toast container exists
        if (!this.elements.toastContainer) {
            this.elements.toastContainer = document.createElement('div');
            this.elements.toastContainer.id = 'toast-container';
            this.elements.toastContainer.className = 'position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(this.elements.toastContainer);
        }
        
        // Create other missing containers if needed
        const containers = [
            { name: 'channelDetailsContainer', selector: '.channel-details-container' },
            { name: 'latestDataContainer', selector: '.latest-data-container' },
            { name: 'fieldMappingContainer', selector: '.field-mapping-container' },
            { name: 'apiUsageContainer', selector: '.api-usage-container' }
        ];
        
        containers.forEach(container => {
            if (!this.elements[container.name]) {
                const mainElement = document.querySelector('main');
                if (mainElement) {
                    const containerDiv = document.createElement('div');
                    containerDiv.className = container.selector.substring(1);
                    mainElement.appendChild(containerDiv);
                    this.elements[container.name] = containerDiv;
                }
            }
        });
    }

    /**
     * Initialize the page
     */
    async init() {
        try {
            // Apply theme settings
            this.loadThemePreference();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Load ThingSpeak configuration
            const thingspeakConfig = await thingspeakService.getChannelFields();
            
            // Update the app config with API settings
            this.config.channelId = thingspeakConfig.channelId;
            this.config.readApiKey = thingspeakConfig.readApiKey;
            
            if (thingspeakConfig.updateInterval) {
                this.config.updateInterval = thingspeakConfig.updateInterval;
            }
            
            // Initial data load
            await this.refreshAllData();
            
            // Start live updates
            this.startLiveUpdates();
            
            // Setup extra UI elements
            this.setupExtraUI();
        } catch (error) {
            console.error('Error initializing ThingSpeak info page:', error);
            this.updateStatus('error', 'Configuration error');
            this.showError('Configuration Error', 'Could not load ThingSpeak configuration. Please check your settings.');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Refresh button
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', this.refreshAllData);
        }
        
        // Theme toggle
        if (this.elements.toggleTheme) {
            this.elements.toggleTheme.addEventListener('click', this.toggleTheme);
        }
        
        // CSV update button
        if (this.elements.csvUpdateBtn) {
            this.elements.csvUpdateBtn.addEventListener('click', () => this.updateLocalCsvFromThingSpeak());
        }
        
        // Listen for theme changes
        document.addEventListener('themechange', (e) => {
            this.config.chartTheme = e.detail.theme;
            this.updateVisualizations();
        });
        
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.refreshLatestData();
            }
        });
    }

    /**
     * Get ThingSpeak configuration from server
     */
    async getThingSpeakConfig() {
        const resp = await fetch('/api/config');
        const data = await resp.json();
        if (data.success && data.data && data.data.thingspeak) {
            return data.data.thingspeak;
        }
        throw new Error('Failed to load ThingSpeak config');
    }

    /**
     * Refresh all data from the server
     */
    async refreshAllData() {
        if (this.elements.refreshButton) {
            this.elements.refreshButton.disabled = true;
        }
        
        try {
            this.updateStatus('loading', 'Fetching data...');
            console.log('Starting data refresh...');
            
            // Fetch all data in parallel
            const channelDetailsPromise = this.fetchWithRetry(`${this.config.apiBase}/thingspeak/channel-details`)
                .then(r => r.json());
            const latestFeedPromise = this.fetchWithRetry(`${this.config.apiBase}/thingspeak/latest-feed`)
                .then(r => r.json());
            const statusPromise = this.fetchWithRetry(`${this.config.apiBase}/thingspeak/status`)
                .then(r => r.json());
            
            // Track success and failure
            let successCount = 0;
            let failureCount = 0;
            const errors = [];
            
            // Process channel details
            try {
                const channelDetailsResult = await channelDetailsPromise;
                this.state.channelDetails = channelDetailsResult.data;
                successCount++;
            } catch (error) {
                console.error('Error fetching channel details:', error);
                errors.push({ type: 'channel', message: error.message });
                failureCount++;
            }
            
            // Process latest feed
            try {
                const latestFeedResult = await latestFeedPromise;
                this.state.latestData = this.normalizeLatestData(latestFeedResult.data);
                successCount++;
            } catch (error) {
                console.error('Error fetching latest feed:', error);
                errors.push({ type: 'feed', message: error.message });
                failureCount++;
            }
            
            // Process channel status
            try {
                const statusResult = await statusPromise;
                this.state.channelStatus = statusResult.success ? statusResult : null;
                if (statusResult.success) successCount++;
                else failureCount++;
            } catch (error) {
                console.error('Error fetching channel status:', error);
                errors.push({ type: 'status', message: error.message });
                failureCount++;
            }
            
            this.state.lastUpdated = new Date();
            
            // Update UI with whatever data we have
            this.updateChannelDetails();
            this.updateLatestData();
            this.updateFieldMapping();
            this.updateApiUsage();
            
            // Update visualizations if we have the necessary data
            if (this.state.latestData) {
                this.updateVisualizations();
            }
            
            // Update UI status based on partial or complete success
            if (failureCount === 0) {
                this.updateStatus('connected', `Data updated: ${this.formatTime(new Date())}`);
            } else if (successCount > 0) {
                this.updateStatus('warning', `Partial data update (${successCount}/${successCount + failureCount} succeeded)`);
                this.showToast('Partial Data Update', `Some data could not be retrieved. Check the console for details.`, 'warning');
            } else {
                this.updateStatus('error', 'Failed to update data');
                
                // Show error with the first error message
                if (errors.length > 0) {
                    const primaryError = errors[0];
                    this.showError(`${primaryError.type.charAt(0).toUpperCase() + primaryError.type.slice(1)} Error`, primaryError.message);
                } else {
                    this.showError('Update Error', 'Failed to retrieve data from ThingSpeak');
                }
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.updateStatus('error', 'Refresh failed');
            this.showToast('Refresh Error', `Failed to refresh data: ${error.message}`, 'danger');
        } finally {
            if (this.elements.refreshButton) {
                this.elements.refreshButton.disabled = false;
            }
        }
    }

    /**
     * Refresh latest data with improved error handling
     */
    async refreshLatestData() {
        try {
            this.updateStatus('loading', 'Updating latest data...');
            
            // Always use backend endpoint for latest feed
            const latestFeedResp = await this.fetchWithRetry('/api/thingspeak/latest-feed');
            const latestFeedJson = await latestFeedResp.json();
            this.state.latestData = this.normalizeLatestData(latestFeedJson.data);
            this.state.lastUpdated = new Date();
            
            // Update UI
            this.updateLatestData();
            this.updateVisualizations();
            this.updateStatus('connected', `Data updated: ${this.formatTime(new Date())}`);
            
            return true;
        } catch (error) {
            console.error('Error refreshing latest data:', error);
            this.updateStatus('error', 'Update failed');
            
            // Update just the latest data container with error
            if (this.elements.latestDataContainer) {
                this.elements.latestDataContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle"></i> Failed to update latest data: ${error.message}
                        <button class="btn btn-sm btn-outline-dark ms-2" onclick="app.refreshLatestData()">
                            <i class="bi bi-arrow-clockwise"></i> Retry
                        </button>
                    </div>
                `;
            }
            
            return false;
        }
    }

    /**
     * Normalize latest data to handle different response formats
     * @param {Object} data - The data object from the API
     * @returns {Object} - Normalized data object
     */
    normalizeLatestData(data) {
        if (!data) return null;
        
        // Always expect backend format: { pm25, pm10, temperature, humidity, timestamp, entry_id }
        return {
            pm25: data.pm25 ?? null,
            pm10: data.pm10 ?? null,
            temperature: data.temperature ?? null,
            humidity: data.humidity ?? null,
            timestamp: data.timestamp ?? new Date().toISOString(),
            entry_id: data.entry_id ?? '0'
        };
    }

    /**
     * Update channel details in the UI
     */
    updateChannelDetails() {
        const container = this.elements.channelDetailsContainer;
        if (!container) return;
        
        if (!this.state.channelDetails) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> Channel details not available. 
                    <button class="btn btn-sm btn-outline-dark ms-2" onclick="app.refreshAllData()">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>
                </div>
            `;
            return;
        }
        
        try {
            const channel = this.state.channelDetails;
            
            // Set the channel status badge
            if (this.elements.channelStatusBadge) {
                this.elements.channelStatusBadge.className = 'badge bg-success';
                this.elements.channelStatusBadge.textContent = 'Active';
            }
            
            // Format dates
            const createdDate = new Date(channel.created_at).toLocaleDateString();
            const updatedDate = new Date(channel.updated_at).toLocaleDateString();
            
            // Create channel details card
            container.innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h4>${channel.name || 'Unnamed Channel'}</h4>
                        <p>${channel.description || 'No description available'}</p>
                        <div class="mb-3">
                            <strong>Channel ID:</strong> ${channel.id}
                        </div>
                        <div class="mb-3">
                            <strong>Created:</strong> ${createdDate}
                        </div>
                        <div class="mb-3">
                            <strong>Last Update:</strong> ${updatedDate}
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">Channel Statistics</div>
                            <div class="card-body">
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Total Entries:</span>
                                    <strong>${channel.last_entry_id || 0}</strong>
                                </div>
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Latitude:</span>
                                    <strong>${channel.latitude || 'N/A'}</strong>
                                </div>
                                <div class="d-flex justify-content-between mb-2">
                                    <span>Longitude:</span>
                                    <strong>${channel.longitude || 'N/A'}</strong>
                                </div>
                                <div class="d-flex justify-content-between">
                                    <span>Elevation:</span>
                                    <strong>${channel.elevation || 'N/A'}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="mt-3">
                    <a href="https://thingspeak.com/channels/${channel.id}" target="_blank" class="btn btn-sm btn-outline-primary">
                        <i class="bi bi-box-arrow-up-right"></i> View on ThingSpeak
                    </a>
                    <a href="https://thingspeak.com/channels/${channel.id}/charts" target="_blank" class="btn btn-sm btn-outline-secondary">
                        <i class="bi bi-graph-up"></i> View ThingSpeak Charts
                    </a>
                    <button class="btn btn-sm btn-outline-info" onclick="app.copyThingSpeakFeedUrl('${channel.id}')">
                        <i class="bi bi-clipboard"></i> Copy JSON Feed URL
                    </button>
                </div>
            `;
        } catch (error) {
            console.error('Error updating channel details:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error displaying channel details: ${error.message}
                    <button class="btn btn-sm btn-outline-dark ms-2" onclick="app.refreshAllData()">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Copy ThingSpeak feed URL to clipboard
     */
    copyThingSpeakFeedUrl(channelId) {
        const apiKey = this.config.readApiKey || '';
        const url = `https://api.thingspeak.com/channels/${channelId}/feeds.json?api_key=${apiKey}`;
        
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('URL Copied', 'ThingSpeak feed URL copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy URL:', err);
            this.showToast('Copy Failed', 'Failed to copy URL to clipboard', 'danger');
        });
    }

    /**
     * Update latest data in the UI
     */
    updateLatestData() {
        const container = this.elements.latestDataContainer;
        if (!container) return;
        
        if (!this.state.latestData) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> Latest data not available.
                    <button class="btn btn-sm btn-outline-dark ms-2" onclick="app.refreshLatestData()">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>
                </div>
            `;
            return;
        }
        
        try {
            console.log('Updating latest data display with:', this.state.latestData);
            
            // Format values for display with units
            const pm25 = this.formatValue(this.state.latestData.pm25);
            const pm10 = this.formatValue(this.state.latestData.pm10);
            const temperature = this.formatValue(this.state.latestData.temperature);
            const humidity = this.formatValue(this.state.latestData.humidity);
            
            // Get AQI class based on PM2.5 level
            let aqiClass = '';
            const pm25Value = parseFloat(this.state.latestData.pm25);
            
            if (!isNaN(pm25Value)) {
                if (pm25Value <= 12) aqiClass = 'text-success';
                else if (pm25Value <= 35.4) aqiClass = 'text-warning';
                else if (pm25Value <= 55.4) aqiClass = 'text-warning';
                else if (pm25Value <= 150.4) aqiClass = 'text-danger';
                else aqiClass = 'text-dark';
            }
            
            // Display the data
            container.innerHTML = `
                <div class="row">
                    <div class="col-6 mb-2">
                        <div class="card">
                            <div class="card-body text-center py-2">
                                <h6 class="mb-0">PM2.5</h6>
                                <h3 class="mb-0 ${aqiClass ? aqiClass : ''}">${pm25}</h3>
                                <small class="text-muted">μg/m³</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 mb-2">
                        <div class="card">
                            <div class="card-body text-center py-2">
                                <h6 class="mb-0">PM10</h6>
                                <h3 class="mb-0">${pm10}</h3>
                                <small class="text-muted">μg/m³</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="card">
                            <div class="card-body text-center py-2">
                                <h6 class="mb-0">Temperature</h6>
                                <h3 class="mb-0">${temperature}</h3>
                                <small class="text-muted">°C</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6">
                        <div class="card">
                            <div class="card-body text-center py-2">
                                <h6 class="mb-0">Humidity</h6>
                                <h3 class="mb-0">${humidity}</h3>
                                <small class="text-muted">%</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="text-center mt-2">
                    <small class="text-muted">
                        Last updated: ${this.state.latestData.timestamp ? this.formatDate(this.state.latestData.timestamp) : 'Unknown'}
                    </small>
                </div>
            `;
        } catch (error) {
            console.error('Error updating latest data display:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error displaying latest data: ${error.message}
                    <button class="btn btn-sm btn-outline-dark ms-2" onclick="app.refreshLatestData()">
                        <i class="bi bi-arrow-clockwise"></i> Retry
                    </button>
                </div>
            `;
        }
    }

    /**
     * Update field mapping in the UI
     */
    updateFieldMapping() {
        const container = this.elements.fieldMappingContainer;
        if (!container) return;
        
        if (!this.state.channelDetails) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> Field mapping not available.
                </div>
            `;
            return;
        }
        
        try {
            const channel = this.state.channelDetails;
            
            // Create field mapping cards
            let fieldsHtml = '';
            
            for (let i = 1; i <= 8; i++) {
                const fieldName = channel[`field${i}`];
                const fieldClass = fieldName ? `field${i}` : '';
                
                fieldsHtml += `
                    <div class="col-md-3 col-sm-6 mb-3">
                        <div class="field-item ${fieldClass}">
                            <div class="d-flex justify-content-between">
                                <strong>Field ${i}</strong>
                                <span>${fieldName || 'Not used'}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            container.innerHTML = `
                <div class="row">
                    ${fieldsHtml}
                </div>
                
                <div class="alert alert-info">
                    <h6><i class="bi bi-info-circle-fill me-2"></i>Field Usage</h6>
                    <p class="mb-0">
                        ThingSpeak channels have 8 fields for storing different types of data. This channel uses:
                        <span class="badge bg-primary">${this.getUsedFieldCount(channel)} of 8 fields</span>
                    </p>
                </div>
            `;
        } catch (error) {
            console.error('Error updating field mapping:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error displaying field mapping: ${error.message}
                </div>
            `;
        }
    }

    /**
     * Update API usage in the UI
     */
    updateApiUsage() {
        const container = this.elements.apiUsageContainer;
        if (!container) return;
        
        if (!this.state.channelStatus) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle"></i> API usage information not available.
                </div>
            `;
            return;
        }
        
        try {
            const statusData = this.state.channelStatus;
            const usage = statusData.api_rate_limit ? {
                used: statusData.api_daily_limit - statusData.api_remaining,
                total: statusData.api_daily_limit
            } : { used: 0, total: 1000 };
            const usedPercentage = Math.round((usage.used / usage.total) * 100);
            let usageClass = 'bg-success';
            
            if (usedPercentage > 90) usageClass = 'bg-danger';
            else if (usedPercentage > 70) usageClass = 'bg-warning';
            
            container.innerHTML = `
                <div class="card">
                    <div class="card-header">API Usage</div>
                    <div class="card-body">
                        <h5>Daily API Requests</h5>
                        <div class="progress mb-2">
                            <div class="progress-bar ${usageClass}" role="progressbar" 
                                style="width: ${usedPercentage}%" 
                                aria-valuenow="${usedPercentage}" 
                                aria-valuemin="0" 
                                aria-valuemax="100">
                                ${usedPercentage}%
                            </div>
                        </div>
                        <p class="mb-0">${usage.used} of ${usage.total} daily requests used</p>
                        <small class="text-muted">Remaining: ${usage.total - usage.used} requests</small>
                        
                        <div class="alert alert-info mt-3 mb-0">
                            <small>
                                <i class="bi bi-info-circle"></i>
                                ThingSpeak limits free accounts to ${usage.total} API requests per day.
                                The quota resets daily at midnight UTC.
                            </small>
                        </div>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error updating API usage:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error displaying API usage: ${error.message}
                </div>
            `;
        }
    }

    /**
     * Set up chart containers and CSV update UI
     */
    setupExtraUI() {
        // Make sure we have chart containers
        this.ensureExtraUI();
    }

    /**
     * Add chart containers and CSV update UI if not present
     */
    ensureExtraUI() {
        // Chart containers already exist in the updated HTML
        
        // Set up CSV update button handlers
        if (this.elements.csvUpdateBtn) {
            this.elements.csvUpdateBtn.addEventListener('click', () => this.updateLocalCsvFromThingSpeak());
        }
    }

    /**
     * Update visualizations
     */
    updateVisualizations() {
        if (!this.state.latestData) return;
        this.setupExtraUI();

        // Radar chart
        if (this.elements.liveRadarChart) {
            if (this.state.charts.radar) this.state.charts.radar.destroy();
            const data = {
                labels: ['PM2.5', 'PM10', 'Temperature', 'Humidity'],
                datasets: [{
                    label: 'Current Values',
                    data: [
                        parseFloat(this.state.latestData.pm25) || 0,
                        parseFloat(this.state.latestData.pm10) || 0,
                        parseFloat(this.state.latestData.temperature) || 0,
                        parseFloat(this.state.latestData.humidity) || 0
                    ],
                    backgroundColor: 'rgba(54,162,235,0.2)',
                    borderColor: 'rgba(54,162,235,1)',
                    borderWidth: 2
                }]
            };
            this.state.charts.radar = new Chart(this.elements.liveRadarChart, {
                type: 'radar',
                data,
                options: {
                    responsive: true,
                    plugins: {
                        title: { 
                            display: true, 
                            text: 'Live Sensor Radar', 
                            color: this.config.chartTheme === 'dark' ? '#fff' : '#222' 
                        },
                        legend: { 
                            labels: { 
                                color: this.config.chartTheme === 'dark' ? '#fff' : '#222' 
                            } 
                        }
                    },
                    scales: {
                        r: {
                            angleLines: { color: this.config.chartTheme === 'dark' ? '#444' : '#ccc' },
                            pointLabels: { color: this.config.chartTheme === 'dark' ? '#fff' : '#222' },
                            grid: { color: this.config.chartTheme === 'dark' ? '#444' : '#ccc' },
                            min: 0
                        }
                    }
                }
            });
        }

        // AQI Gauge chart
        if (this.elements.liveAQIGauge) {
            if (this.state.charts.gauge) this.state.charts.gauge.destroy();
            
            const pm25 = parseFloat(this.state.latestData.pm25) || 0;
            const aqi = this.calculateAQI(pm25);
            const aqiCat = this.getAQICategory(aqi);
            
            this.state.charts.gauge = new Chart(this.elements.liveAQIGauge, {
                type: 'doughnut',
                data: {
                    labels: ['AQI', 'Max'],
                    datasets: [{
                        data: [aqi, 500 - aqi],
                        backgroundColor: [aqiCat.color, '#eee'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '80%',
                    rotation: -90,
                    circumference: 180,
                    plugins: {
                        title: { 
                            display: true, 
                            text: 'AQI (PM2.5)', 
                            color: this.config.chartTheme === 'dark' ? '#fff' : '#222' 
                        },
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                },
                plugins: [{
                    id: 'aqiText',
                    afterDraw(chart) {
                        const {ctx, chartArea: {width, top, height}} = chart;
                        ctx.save();
                        ctx.font = 'bold 28px Arial';
                        ctx.fillStyle = aqiCat.color;
                        ctx.textAlign = 'center';
                        ctx.fillText(aqi, width / 2, top + height / 1.5);
                        ctx.font = '14px Arial';
                        ctx.fillStyle = chart.options.plugins.title.color;
                        ctx.fillText(aqiCat.name, width / 2, top + height / 1.5 + 24);
                        ctx.restore();
                    }
                }]
            });
        }
    }

    /**
     * Calculate AQI value from PM2.5 reading
     * @param {number} pm25 - PM2.5 value in μg/m³
     * @returns {number} AQI value
     */
    calculateAQI(pm25) {
        if (pm25 === undefined || pm25 === null || isNaN(pm25)) return 0;
        const bp = [
            {min: 0, max: 12, aqiMin: 0, aqiMax: 50},
            {min: 12.1, max: 35.4, aqiMin: 51, aqiMax: 100},
            {min: 35.5, max: 55.4, aqiMin: 101, aqiMax: 150},
            {min: 55.5, max: 150.4, aqiMin: 151, aqiMax: 200},
            {min: 150.5, max: 250.4, aqiMin: 201, aqiMax: 300},
            {min: 250.5, max: 500.4, aqiMin: 301, aqiMax: 500}
        ];
        for (const b of bp) {
            if (pm25 >= b.min && pm25 <= b.max) {
                return Math.round(((b.aqiMax - b.aqiMin) / (b.max - b.min)) * (pm25 - b.min) + b.aqiMin);
            }
        }
        return pm25 > 500.4 ? 500 : 0;
    }

    /**
     * Get AQI category based on AQI value
     * @param {number} aqi - AQI value
     * @returns {Object} Category with name and color
     */
    getAQICategory(aqi) {
        if (aqi <= 50) return {name: 'Good', color: '#28a745'};
        if (aqi <= 100) return {name: 'Moderate', color: '#ffc107'};
        if (aqi <= 150) return {name: 'Unhealthy for Sensitive Groups', color: '#fd7e14'};
        if (aqi <= 200) return {name: 'Unhealthy', color: '#dc3545'};
        if (aqi <= 300) return {name: 'Very Unhealthy', color: '#6f42c1'};
        return {name: 'Hazardous', color: '#343a40'};
    }

    /**
     * Update CSV file from ThingSpeak
     */
    async updateLocalCsvFromThingSpeak() {
        if (this.elements.csvUpdateStatus) this.elements.csvUpdateStatus.innerHTML = '<span class="text-info">Updating...</span>';
        try {
            const resp = await fetch('/api/thingspeak/export-csv', {method: 'POST'});
            const result = await resp.json();
            if (result.success) {
                this.elements.csvUpdateStatus.innerHTML = `<span class="text-success">CSV updated (${result.data.rows} rows)</span>`;
            } else {
                this.elements.csvUpdateStatus.innerHTML = `<span class="text-danger">Failed: ${result.error}</span>`;
            }
        } catch (e) {
            this.elements.csvUpdateStatus.innerHTML = `<span class="text-danger">Error: ${e.message}</span>`;
        }
    }

    /**
     * Start live data updates
     */
    startLiveUpdates() {
        if (this.state.liveUpdateTimer) clearInterval(this.state.liveUpdateTimer);
        this.state.liveUpdateTimer = setInterval(() => {
            this.refreshLatestData();
        }, this.config.updateInterval);
    }

    /**
     * Stop live data updates
     */
    stopLiveUpdates() {
        if (this.state.liveUpdateTimer) clearInterval(this.state.liveUpdateTimer);
        this.state.liveUpdateTimer = null;
    }

    /**
     * Update status indicator and message
     * @param {string} status - Status type ('connected', 'disconnected', 'error', 'loading')
     * @param {string} message - Status message
     */
    updateStatus(status, message) {
        if (this.elements.statusIndicator) this.elements.statusIndicator.className = `status-indicator ${status}`;
        if (this.elements.statusText) this.elements.statusText.textContent = message;
    }

    /**
     * Show a toast notification
     * @param {string} title - Toast title
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, warning, danger, info)
     */
    showToast(title, message, type = 'info') {
        const toastId = `toast-${Date.now()}`;
        
        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header bg-${type} text-white">
                    <strong class="me-auto">${title}</strong>
                    <small>${this.formatTime(new Date())}</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        this.elements.toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        // Auto-remove after shown
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    /**
     * Show an error toast
     * @param {string} title - Error title
     * @param {string} message - Error message
     */
    showError(title, message) {
        this.showToast(title, message, 'danger');
    }

    /**
     * Format time for display
     * @param {Date} date - Date to format
     * @returns {string} Formatted time string
     */
    formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Format date for display
     * @param {string} dateString - ISO date string
     * @returns {string} Formatted date string
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }

    /**
     * Format numeric value for display
     * @param {any} value - Value to format
     * @returns {string} Formatted value string
     */
    formatValue(value) {
        if (value === undefined || value === null || value === '') {
            return 'N/A';
        }
        const num = parseFloat(value);
        return isNaN(num) ? 'N/A' : num.toFixed(2);
    }

    /**
     * Count the number of fields used in a channel
     * @param {Object} channel - Channel object
     * @returns {number} Number of used fields
     */
    getUsedFieldCount(channel) {
        let count = 0;
        for (let i = 1; i <= 8; i++) {
            if (channel[`field${i}`]) count++;
        }
        return count;
    }

    /**
     * Load theme preference from localStorage
     */
    loadThemePreference() {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-mode');
            const themeIcon = this.elements.toggleTheme.querySelector('i');
            if (themeIcon) {
                themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
            }
        }
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        if (isDarkMode) {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
            if (this.elements.toggleTheme.querySelector('i')) {
                this.elements.toggleTheme.querySelector('i').classList.replace('bi-sun-fill', 'bi-moon-fill');
            }
            this.config.chartTheme = 'light';
        } else {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
            if (this.elements.toggleTheme.querySelector('i')) {
                this.elements.toggleTheme.querySelector('i').classList.replace('bi-moon-fill', 'bi-sun-fill');
            }
            this.config.chartTheme = 'dark';
        }
        
        // If we have charts, update them with the new theme
        this.updateVisualizations();
        
        // Dispatch an event for other components to react
        document.dispatchEvent(new CustomEvent('themechange', { 
            detail: { theme: this.config.chartTheme }
        }));
    }

    /**
     * Enhanced fetch with retry functionality
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise<Response>} Fetch response
     */
    async fetchWithRetry(url, options = {}, maxRetries = 2) {
        let lastError = null;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                // Add timeout to prevent long-hanging requests
                const { timeout = 5000, ...fetchOptions } = options;
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);
                
                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok && attempt < maxRetries) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                
                return response;
            } catch (error) {
                lastError = error;
                
                if (attempt < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    const delay = Math.pow(2, attempt) * 1000;
                    console.log(`Retry ${attempt + 1}/${maxRetries} for ${url} in ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        // All retries failed
        throw lastError;
    }
}

// Create and initialize the application
const app = new ThingSpeakInfoPage();
document.addEventListener('DOMContentLoaded', () => app.init());

// Make app globally available for event handlers in HTML
window.app = app;
