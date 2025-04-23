/**
 * ThingSpeak Info Page JavaScript
 * Displays detailed information about the ThingSpeak channel
 */

// Configuration and state
const config = {
    apiBase: '/api',
    updateInterval: 30000, // 30-second refresh for real-time data
    chartTheme: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
    dataSource: localStorage.getItem('thingspeak_data_source') || 'api'
};

// Application state
let state = {
    channelDetails: null,
    latestData: null,
    channelStatus: null,
    charts: {
        radar: null,
        gauge: null
    },
    lastUpdated: null,
    dateFilter: {
        startDate: null,
        endDate: null
    }
};

// DOM Elements
const elements = {
    statusIndicator: document.getElementById('status-indicator'),
    statusText: document.getElementById('status-text'),
    channelDetailsContainer: document.getElementById('channel-details-container'),
    latestDataContainer: document.getElementById('latest-data-container'),
    fieldMappingContainer: document.getElementById('field-mapping-container'),
    apiUsageContainer: document.getElementById('api-usage-container'),
    channelStatusBadge: document.getElementById('channel-status-badge'),
    refreshButton: document.getElementById('refreshChannelData'),
    toastContainer: document.getElementById('toast-container'),
    vizContainer: document.getElementById('visualization-container'),
    downloadFeedsBtn: document.getElementById('downloadFeedsBtn'),
    dataSourceOptions: document.querySelectorAll('.data-source-option'),
    dataSourceDropdown: document.getElementById('dataSourceDropdown'),
    thingspeakDateRange: document.getElementById('thingspeakDateRange'),
    applyThingspeakDateFilter: document.getElementById('applyThingspeakDateFilter'),
    timeFilterBtns: document.querySelectorAll('.ts-time-filter-btn')
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Apply theme preference
    loadThemePreference();
    
    // Initialize date picker
    initializeDatepicker();
    
    // Load initial data
    refreshAllData();
    
    // Add event listeners
    if (elements.refreshButton) {
        elements.refreshButton.addEventListener('click', refreshAllData);
    }
    
    // Add theme toggle event listener
    const themeToggle = document.getElementById('toggleTheme');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Add download feeds event listener
    if (elements.downloadFeedsBtn) {
        elements.downloadFeedsBtn.addEventListener('click', downloadAndUpdateFeeds);
    }
    
    // Add data source selection listeners
    elements.dataSourceOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            changeDataSource(e.target.dataset.source);
        });
    });
    
    // Add date filter listener
    if (elements.applyThingspeakDateFilter) {
        elements.applyThingspeakDateFilter.addEventListener('click', applyDateFilter);
    }
    
    // Add time filter button listeners
    elements.timeFilterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            elements.timeFilterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            applyQuickTimeFilter(parseInt(e.target.dataset.days, 10));
        });
    });
    
    // Listen for theme changes
    document.addEventListener('themechange', function(e) {
        config.chartTheme = e.detail.theme;
        updateVisualizations();
    });
    
    // Setup auto-refresh
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            refreshLatestData();
        }
    }, config.updateInterval);
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            refreshLatestData();
        }
    });
    
    // Update data source indicator
    updateDataSourceIndicator();
});

/**
 * Initialize datepicker for date range filtering
 */
function initializeDatepicker() {
    if (elements.thingspeakDateRange && typeof flatpickr !== 'undefined') {
        flatpickr(elements.thingspeakDateRange, {
            mode: "range",
            dateFormat: "Y-m-d",
            maxDate: "today",
            onChange: function(selectedDates) {
                if (selectedDates.length === 2) {
                    state.dateFilter.startDate = selectedDates[0];
                    state.dateFilter.endDate = selectedDates[1];
                }
            }
        });
    } else {
        console.warn('Flatpickr not available or date range element not found');
    }
}

/**
 * Apply date filter from date picker
 */
function applyDateFilter() {
    if (!state.dateFilter.startDate || !state.dateFilter.endDate) {
        showToast('Date Filter', 'Please select a date range', 'warning');
        return;
    }
    
    updateStatus('loading', 'Applying date filter...');
    
    // Refresh data with date filter
    refreshAllData(true);
}

/**
 * Apply quick time filter for last X days
 * @param {number} days - Number of days to filter
 */
function applyQuickTimeFilter(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    state.dateFilter.startDate = startDate;
    state.dateFilter.endDate = endDate;
    
    // Update datepicker if available
    if (elements.thingspeakDateRange && typeof flatpickr !== 'undefined') {
        const datePicker = elements.thingspeakDateRange._flatpickr;
        if (datePicker) {
            datePicker.setDate([startDate, endDate]);
        } else {
            elements.thingspeakDateRange.value = `${formatDate(startDate)} to ${formatDate(endDate)}`;
        }
    }
    
    // Refresh data with date filter
    refreshAllData(true);
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Change the data source
 * @param {string} source - 'api' or 'csv'
 */
function changeDataSource(source) {
    if (source !== 'api' && source !== 'csv') {
        console.error('Invalid data source:', source);
        return;
    }
    
    config.dataSource = source;
    localStorage.setItem('thingspeak_data_source', source);
    
    // Update UI indicator
    updateDataSourceIndicator();
    
    // Refresh data with new source
    refreshAllData();
}

/**
 * Update data source indicator in UI
 */
function updateDataSourceIndicator() {
    const sourceText = config.dataSource === 'api' ? 'ThingSpeak API' : 'Local CSV';
    const sourceIcon = config.dataSource === 'api' ? 'cloud' : 'file-earmark-text';
    
    if (elements.dataSourceDropdown) {
        elements.dataSourceDropdown.innerHTML = `<i class="bi bi-${sourceIcon}"></i> ${sourceText}`;
    }
    
    // Highlight active option
    elements.dataSourceOptions.forEach(option => {
        if (option.dataset.source === config.dataSource) {
            option.classList.add('active');
        } else {
            option.classList.remove('active');
        }
    });
}

/**
 * Download and update feeds.csv file from ThingSpeak
 */
async function downloadAndUpdateFeeds() {
    try {
        updateStatus('loading', 'Downloading feeds from ThingSpeak...');
        elements.downloadFeedsBtn.disabled = true;
        elements.downloadFeedsBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Downloading...';
        
        const response = await fetch('/api/thingspeak/download-feeds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                updateExisting: true
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Download Complete', `Successfully updated feeds.csv with ${result.count} records`, 'success');
            updateStatus('connected', 'Feeds.csv updated successfully');
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (error) {
        console.error('Error downloading feeds:', error);
        showToast('Download Failed', error.message || 'Could not download feeds', 'danger');
        updateStatus('error', 'Download failed');
    } finally {
        elements.downloadFeedsBtn.disabled = false;
        elements.downloadFeedsBtn.innerHTML = '<i class="bi bi-cloud-download"></i> Update Feeds.csv';
    }
}

/**
 * Refresh all data from the server
 */
async function refreshAllData(useFilters = false) {
    if (elements.refreshButton) {
        elements.refreshButton.disabled = true;
    }
    
    updateStatus('loading', 'Fetching data...');
    
    try {
        // Prepare API parameters
        const params = new URLSearchParams();
        
        // Add data source parameter
        params.append('source', config.dataSource);
        
        // Add date filters if enabled
        if (useFilters && state.dateFilter.startDate && state.dateFilter.endDate) {
            params.append('start', formatDate(state.dateFilter.startDate));
            params.append('end', formatDate(state.dateFilter.endDate));
        }
        
        // Fetch channel details, latest data and status in parallel
        const [detailsResult, dataResult, statusResult] = await Promise.all([
            safeFetch(`${config.apiBase}/thingspeak/channel-details?${params}`),
            safeFetch(`${config.apiBase}/thingspeak/latest-feed?${params}`),
            safeFetch(`${config.apiBase}/thingspeak/status?${params}`)
        ]);
        
        state.channelDetails = detailsResult.success ? detailsResult.data : null;
        state.latestData = dataResult.success ? dataResult.data : null;
        state.channelStatus = statusResult.success ? statusResult.data : null;
        state.lastUpdated = new Date();
        
        // Update UI
        updateChannelDetails();
        updateLatestData();
        updateFieldMapping();
        updateApiUsage();
        updateVisualizations();
        updateChannelStatusBadge(state.channelStatus);
        
        updateStatus('connected', `Last updated: ${formatTime(state.lastUpdated)}`);
        showToast('Refresh Complete', 'All data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        updateStatus('error', 'Refresh failed');
        showToast('Refresh Error', 'Failed to refresh data. Please try again.', 'danger');
    } finally {
        if (elements.refreshButton) {
            elements.refreshButton.disabled = false;
        }
    }
}

/**
 * Refresh only the latest data
 */
async function refreshLatestData() {
    try {
        // Prepare API parameters
        const params = new URLSearchParams();
        params.append('source', config.dataSource);
        
        const dataResult = await safeFetch(`${config.apiBase}/thingspeak/latest-feed?${params}`);
        
        if (dataResult.success) {
            state.latestData = dataResult.data;
            state.lastUpdated = new Date();
            updateLatestData();
            updateStatus('connected', `Last updated: ${formatTime(state.lastUpdated)}`);
        }
    } catch (error) {
        console.error('Error refreshing latest data:', error);
        // Don't update status or show toast for silent refresh failures
    }
}

/**
 * Update channel details in the UI
 */
function updateChannelDetails() {
    const container = elements.channelDetailsContainer;
    if (!container) return;
    
    if (!state.channelDetails) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Channel details not available.
            </div>
        `;
        return;
    }
    
    const channel = state.channelDetails;
    
    container.innerHTML = `
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-info-circle"></i> Channel Information
                </h5>
                <span class="badge bg-primary">${channel.id || 'Unknown'}</span>
            </div>
            <div class="card-body">
                <div class="row mb-3">
                    <div class="col-md-6">
                        <h5>${channel.name || 'Unnamed Channel'}</h5>
                        <p class="text-muted">${channel.description || 'No description available.'}</p>
                    </div>
                    <div class="col-md-6">
                        <div class="d-flex justify-content-between mb-2">
                            <span><i class="bi bi-calendar"></i> Created:</span>
                            <span>${new Date(channel.created_at).toLocaleDateString()}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span><i class="bi bi-clock"></i> Last Updated:</span>
                            <span>${new Date(channel.updated_at).toLocaleDateString()}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2">
                            <span><i class="bi bi-database"></i> Total Entries:</span>
                            <span>${channel.last_entry_id || 0} entries</span>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-12">
                        <div class="alert alert-info">
                            <p class="mb-0">
                                <i class="bi bi-link"></i> Public URL:
                                <a href="https://thingspeak.com/channels/${channel.id}" target="_blank" class="alert-link">
                                    https://thingspeak.com/channels/${channel.id}
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Update latest data in the UI
 */
function updateLatestData() {
    const container = elements.latestDataContainer;
    if (!container) return;
    
    if (!state.latestData) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Latest data not available.
            </div>
        `;
        return;
    }
    
    const data = state.latestData;
    const timestamp = data.timestamp ? new Date(data.timestamp) : new Date();
    
    const getStatusClass = (pm25) => {
        if (!pm25 || pm25 === 'N/A') return 'bg-secondary';
        pm25 = parseFloat(pm25);
        if (pm25 <= 12) return 'bg-success';
        if (pm25 <= 35.4) return 'bg-warning';
        if (pm25 <= 55.4) return 'bg-warning';
        if (pm25 <= 150.4) return 'bg-danger';
        return 'bg-dark';
    };
    
    const getStatusText = (pm25) => {
        if (!pm25 || pm25 === 'N/A') return 'Unknown';
        pm25 = parseFloat(pm25);
        if (pm25 <= 12) return 'Good';
        if (pm25 <= 35.4) return 'Moderate';
        if (pm25 <= 55.4) return 'Unhealthy for Sensitive Groups';
        if (pm25 <= 150.4) return 'Unhealthy';
        return 'Hazardous';
    };
    
    const statusClass = getStatusClass(data.pm25);
    const statusText = getStatusText(data.pm25);
    
    container.innerHTML = `
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">
                    <i class="bi bi-graph-up"></i> Latest Data
                </h5>
                <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <div class="card-body">
                <div class="row text-center">
                    <div class="col-6 col-md-3 mb-3">
                        <div class="card h-100">
                            <div class="card-body">
                                <h5 class="card-title">PM2.5</h5>
                                <h2 class="mb-0">${data.pm25}</h2>
                                <small class="text-muted">μg/m³</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3 mb-3">
                        <div class="card h-100">
                            <div class="card-body">
                                <h5 class="card-title">PM10</h5>
                                <h2 class="mb-0">${data.pm10}</h2>
                                <small class="text-muted">μg/m³</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3 mb-3">
                        <div class="card h-100">
                            <div class="card-body">
                                <h5 class="card-title">Temperature</h5>
                                <h2 class="mb-0">${data.temperature}</h2>
                                <small class="text-muted">°C</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-6 col-md-3 mb-3">
                        <div class="card h-100">
                            <div class="card-body">
                                <h5 class="card-title">Humidity</h5>
                                <h2 class="mb-0">${data.humidity}</h2>
                                <small class="text-muted">%</small>
                            </div>
                        </div>
                    </div>
                </div>
                <p class="text-muted text-center mt-3">
                    <i class="bi bi-clock"></i> Recorded: ${timestamp.toLocaleString()}
                </p>
            </div>
        </div>
    `;
}

/**
 * Update field mapping in the UI
 */
function updateFieldMapping() {
    const container = elements.fieldMappingContainer;
    if (!container) return;
    
    if (!state.channelDetails) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Field mapping not available.
            </div>
        `;
        return;
    }
    
    const channel = state.channelDetails;
    
    container.innerHTML = `
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="mb-0"><i class="bi bi-tags"></i> Field Mapping</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <div class="field-item field1">
                            <h5>Field 1: Humidity</h5>
                            <p class="text-muted">${channel.field1 || 'Humidity (%)'}</p>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="field-item field2">
                            <h5>Field 2: Temperature</h5>
                            <p class="text-muted">${channel.field2 || 'Temperature (°C)'}</p>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="field-item field3">
                            <h5>Field 3: PM2.5</h5>
                            <p class="text-muted">${channel.field3 || 'Particulate Matter 2.5 (μg/m³)'}</p>
                        </div>
                    </div>
                    <div class="col-md-6 mb-3">
                        <div class="field-item field4">
                            <h5>Field 4: PM10</h5>
                            <p class="text-muted">${channel.field4 || 'Particulate Matter 10 (μg/m³)'}</p>
                        </div>
                    </div>
                </div>
                <div class="alert alert-info mt-3">
                    <i class="bi bi-info-circle"></i> These fields represent the ThingSpeak channel field mappings for this Air Quality Monitoring station.
                </div>
            </div>
        </div>
    `;
}

/**
 * Update API usage information
 */
function updateApiUsage() {
    const container = elements.apiUsageContainer;
    if (!container) return;
    
    if (!state.channelStatus || !state.channelStatus.usage) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> API usage information not available.
            </div>
        `;
        return;
    }
    
    const usage = state.channelStatus.usage;
    const usagePercent = Math.round((usage.used / usage.daily_limit) * 100);
    
    container.innerHTML = `
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="mb-0"><i class="bi bi-speedometer"></i> API Usage</h5>
            </div>
            <div class="card-body">
                <div class="mb-3">
                    <label class="form-label">Daily API Usage (${usage.used}/${usage.daily_limit})</label>
                    <div class="progress">
                        <div class="progress-bar ${usagePercent > 80 ? 'bg-danger' : 'bg-success'}" role="progressbar" 
                            style="width: ${usagePercent}%" 
                            aria-valuenow="${usage.used}" 
                            aria-valuemin="0" 
                            aria-valuemax="${usage.daily_limit}">
                            ${usagePercent}%
                        </div>
                    </div>
                </div>
                
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Rate Limit</label>
                            <p class="mb-0">${usage.rate_limit || 'N/A'} requests/minute</p>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label class="form-label">Reset Time</label>
                            <p class="mb-0">${usage.reset_time ? new Date(usage.reset_time).toLocaleString() : 'N/A'}</p>
                        </div>
                    </div>
                </div>
                
                <div class="alert alert-info">
                    <i class="bi bi-info-circle"></i> The ThingSpeak API has daily usage limits. Monitor your usage to avoid service interruptions.
                </div>
            </div>
        </div>
    `;
}

/**
 * Update visualizations based on current data
 */
function updateVisualizations() {
    const container = elements.vizContainer;
    if (!container) return;
    
    if (!state.latestData) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle"></i> Data not available for visualization.
            </div>
        `;
        return;
    }
    
    // Clean up previous charts
    Object.values(state.charts).forEach(chart => {
        if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
        }
    });
    
    // Create new container structure
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h5 class="mb-0">Parameter Distribution</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="radar-chart" height="300"></canvas>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card h-100">
                    <div class="card-header">
                        <h5 class="mb-0">Air Quality Index</h5>
                    </div>
                    <div class="card-body">
                        <canvas id="gauge-chart" height="300"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Create radar chart
    createRadarChart();
    
    // Create gauge chart
    createGaugeChart();
}

/**
 * Create radar chart for parameter distribution
 */
function createRadarChart() {
    if (!state.latestData) return;
    
    const canvas = document.getElementById('radar-chart');
    if (!canvas) return;
    
    const data = state.latestData;
    
    const pm25 = parseFloat(data.pm25 !== 'N/A' ? data.pm25 : 0);
    const pm10 = parseFloat(data.pm10 !== 'N/A' ? data.pm10 : 0);
    const temp = parseFloat(data.temperature !== 'N/A' ? data.temperature : 0);
    const humidity = parseFloat(data.humidity !== 'N/A' ? data.humidity : 0);
    
    // Normalize values to 0-100 range for radar
    const normalizedPM25 = Math.min(100, (pm25 / 35.4) * 100); // 35.4 is moderate limit
    const normalizedPM10 = Math.min(100, (pm10 / 150) * 100);  // 150 is moderate limit
    const normalizedTemp = Math.min(100, (temp / 50) * 100);   // Normalized to 50°C max
    const normalizedHumidity = humidity; // Already 0-100
    
    const ctx = canvas.getContext('2d');
    
    const isDarkMode = config.chartTheme === 'dark';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    
    state.charts.radar = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['PM2.5', 'PM10', 'Temperature', 'Humidity'],
            datasets: [{
                label: 'Current Values',
                data: [normalizedPM25, normalizedPM10, normalizedTemp, normalizedHumidity],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgb(54, 162, 235)',
                pointBackgroundColor: 'rgb(54, 162, 235)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(54, 162, 235)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const originalValues = [data.pm25, data.pm10, data.temperature, data.humidity];
                            const units = ['μg/m³', 'μg/m³', '°C', '%'];
                            return `${originalValues[context.dataIndex]} ${units[context.dataIndex]}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    pointLabels: {
                        color: textColor,
                        font: {
                            size: 12
                        }
                    },
                    grid: {
                        color: gridColor
                    },
                    angleLines: {
                        color: gridColor
                    },
                    suggestedMin: 0,
                    suggestedMax: 100
                }
            }
        }
    });
}

/**
 * Create gauge chart for air quality index
 */
function createGaugeChart() {
    if (!state.latestData) return;
    
    const canvas = document.getElementById('gauge-chart');
    if (!canvas) return;
    
    const pm25 = parseFloat(state.latestData.pm25 !== 'N/A' ? state.latestData.pm25 : 0);
    
    // Calculate AQI level based on PM2.5
    let aqiText = 'Good';
    let aqiColor = 'rgb(0, 153, 51)';
    let needle = 0;
    
    if (pm25 <= 12) {
        aqiText = 'Good';
        aqiColor = 'rgb(0, 153, 51)';
        needle = (pm25 / 12) * 20;
    } else if (pm25 <= 35.4) {
        aqiText = 'Moderate';
        aqiColor = 'rgb(255, 204, 0)';
        needle = 20 + ((pm25 - 12) / (35.4 - 12)) * 20;
    } else if (pm25 <= 55.4) {
        aqiText = 'Unhealthy for Sensitive Groups';
        aqiColor = 'rgb(255, 153, 0)';
        needle = 40 + ((pm25 - 35.4) / (55.4 - 35.4)) * 20;
    } else if (pm25 <= 150.4) {
        aqiText = 'Unhealthy';
        aqiColor = 'rgb(204, 0, 0)';
        needle = 60 + ((pm25 - 55.4) / (150.4 - 55.4)) * 20;
    } else if (pm25 <= 250.4) {
        aqiText = 'Very Unhealthy';
        aqiColor = 'rgb(102, 0, 153)';
        needle = 80 + ((pm25 - 150.4) / (250.4 - 150.4)) * 10;
    } else {
        aqiText = 'Hazardous';
        aqiColor = 'rgb(126, 0, 35)';
        needle = 90 + Math.min(10, ((pm25 - 250.4) / 250) * 10);
    }
    
    // Keep needle in 0-100 range
    needle = Math.max(0, Math.min(100, needle));
    
    const isDarkMode = config.chartTheme === 'dark';
    const textColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
    
    const ctx = canvas.getContext('2d');
    
    state.charts.gauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [needle, 100 - needle],
                backgroundColor: [
                    aqiColor,
                    'rgba(0, 0, 0, 0.1)'
                ],
                borderWidth: 0,
                circumference: 180,
                rotation: 270,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            },
            layout: {
                padding: {
                    bottom: 30
                }
            }
        },
        plugins: [{
            id: 'gaugeText',
            afterDraw: (chart) => {
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;
                
                ctx.restore();
                ctx.textBaseline = 'middle';
                
                // Air Quality value
                const pm25Value = parseFloat(state.latestData.pm25).toFixed(1);
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = aqiColor;
                ctx.fillText(pm25Value, width / 2, height - 90);
                
                // μg/m³ unit
                ctx.font = '12px Arial';
                ctx.fillStyle = textColor;
                ctx.fillText('μg/m³', width / 2, height - 70);
                
                // AQI Text
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = aqiColor;
                ctx.fillText(aqiText, width / 2, height - 40);
                
                // Draw gauge segments
                const segmentColors = [
                    'rgb(0, 153, 51)',    // Good
                    'rgb(255, 204, 0)',   // Moderate
                    'rgb(255, 153, 0)',   // USG
                    'rgb(204, 0, 0)',     // Unhealthy
                    'rgb(102, 0, 153)',   // Very Unhealthy
                    'rgb(126, 0, 35)'     // Hazardous
                ];
                
                const center = { x: width / 2, y: height - 20 };
                const radius = Math.min(width, height) * 0.4;
                const segmentWidth = Math.PI / 6;  // 30 degrees
                
                for (let i = 0; i < 6; i++) {
                    ctx.beginPath();
                    const startAngle = Math.PI - (i * segmentWidth);
                    const endAngle = startAngle - segmentWidth;
                    ctx.arc(center.x, center.y, radius, startAngle, endAngle, true);
                    ctx.lineWidth = 10;
                    ctx.strokeStyle = segmentColors[i];
                    ctx.stroke();
                }
                
                ctx.save();
            }
        }]
    });
}

/**
 * Update channel status badge
 */
function updateChannelStatusBadge(status) {
    const badge = elements.channelStatusBadge;
    if (!badge) return;
    
    if (!status) {
        badge.className = 'badge bg-secondary';
        badge.textContent = 'Unknown';
        return;
    }
    
    if (status.online) {
        badge.className = 'badge bg-success';
        badge.textContent = 'Online';
    } else {
        badge.className = 'badge bg-danger';
        badge.textContent = 'Offline';
    }
    
    if (status.maintenance) {
        badge.className = 'badge bg-warning';
        badge.textContent = 'Maintenance';
    }
}

/**
 * Update the status indicator
 */
function updateStatus(status, message) {
    elements.statusIndicator.className = `status-indicator ${status}`;
    elements.statusText.textContent = message;
}

/**
 * Format time for display
 */
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info') {
    const toastId = `toast-${Date.now()}`;
    
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-${type} text-white">
                <strong class="me-auto">${title}</strong>
                <small>${formatTime(new Date())}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    elements.toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Auto-remove after shown
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

/**
 * Load theme preference from localStorage
 */
function loadThemePreference() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const themeIcon = document.querySelector('#toggleTheme i');
        if (themeIcon) {
            themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
        }
        config.chartTheme = 'dark';
    } else {
        config.chartTheme = 'light';
    }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    const themeIcon = document.querySelector('#toggleTheme i');
    
    if (themeIcon) {
        if (isDarkMode) {
            themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
        } else {
            themeIcon.classList.replace('bi-sun-fill', 'bi-moon-fill');
        }
    }
    
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    config.chartTheme = isDarkMode ? 'dark' : 'light';
    
    // Update charts if they exist
    updateVisualizations();
    
    // Dispatch event for other components
    document.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: isDarkMode ? 'dark' : 'light' }
    }));
}

/**
 * Safe fetch with error handling
 */
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`Request failed with status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}
