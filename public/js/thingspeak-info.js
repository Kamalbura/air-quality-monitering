/**
 * ThingSpeak Info Page JavaScript
 * Displays detailed information about the ThingSpeak channel
 */

// Configuration and state
const config = {
    apiBase: '/api',
    updateInterval: 30000, // 30-second refresh for real-time data
    chartTheme: localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
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
    lastUpdated: null
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
    toggleTheme: document.getElementById('toggleTheme'),
    toastContainer: document.getElementById('toast-container')
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    
    // Event handlers
    elements.refreshButton.addEventListener('click', refreshAllData);
    elements.toggleTheme.addEventListener('click', toggleTheme);
});

/**
 * Initialize the page
 */
async function initializePage() {
    updateStatus('loading', 'Connecting...');
    
    try {
        // Load all required data in parallel
        const [channelDetailsResponse, latestFeedResponse, statusResponse] = await Promise.all([
            fetch(`${config.apiBase}/thingspeak/channel-details`),
            fetch(`${config.apiBase}/thingspeak/latest-feed`),
            fetch(`${config.apiBase}/thingspeak/status`)
        ]);
        
        if (!channelDetailsResponse.ok || !latestFeedResponse.ok || !statusResponse.ok) {
            throw new Error('One or more API endpoints returned an error');
        }
        
        // Parse responses
        const channelDetailsResult = await channelDetailsResponse.json();
        const latestFeedResult = await latestFeedResponse.json();
        const statusResult = await statusResponse.json();
        
        // Update state with fetched data
        state.channelDetails = channelDetailsResult.success ? channelDetailsResult.data : null;
        state.latestData = latestFeedResult.success ? latestFeedResult.data : null;
        state.channelStatus = statusResult.success ? statusResult.data : null;
        state.lastUpdated = new Date();
        
        // Update UI with fetched data
        updateChannelDetails();
        updateLatestData();
        updateFieldMapping();
        updateApiUsage();
        createVisualizations();
        
        updateStatus('connected', `Last updated: ${formatTime(state.lastUpdated)}`);
        
        // Start auto-refresh for real-time data
        startAutoRefresh();
    } catch (error) {
        console.error('Error initializing page:', error);
        updateStatus('error', 'Connection error');
        showToast('Error', 'Failed to load ThingSpeak information. Please try again.', 'danger');
    }
}

/**
 * Start auto-refresh for real-time data
 */
function startAutoRefresh() {
    setInterval(async () => {
        try {
            const latestFeedResponse = await fetch(`${config.apiBase}/thingspeak/latest-feed`);
            if (!latestFeedResponse.ok) {
                throw new Error('API returned an error');
            }
            
            const latestFeedResult = await latestFeedResponse.json();
            
            if (latestFeedResult.success) {
                const previousData = state.latestData;
                state.latestData = latestFeedResult.data;
                state.lastUpdated = new Date();
                
                // Check if data has actually changed
                const hasNewData = isNewData(previousData, state.latestData);
                
                if (hasNewData) {
                    updateLatestData();
                    updateVisualizations();
                    updateStatus('connected', `Updated: ${formatTime(state.lastUpdated)}`);
                    showToast('Data Updated', 'Received new data from ThingSpeak', 'info');
                }
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            updateStatus('warning', 'Refresh failed');
        }
    }, config.updateInterval);
}

/**
 * Check if new data is different from previous data
 */
function isNewData(prevData, newData) {
    if (!prevData || !prevData.data || !newData || !newData.data) {
        return true;
    }
    
    const prevFeed = prevData.data[0];
    const newFeed = newData.data[0];
    
    return prevFeed.entry_id !== newFeed.entry_id;
}

/**
 * Refresh all data from the server
 */
async function refreshAllData() {
    elements.refreshButton.disabled = true;
    
    try {
        updateStatus('loading', 'Refreshing...');
        
        const [channelDetailsResponse, latestFeedResponse, statusResponse] = await Promise.all([
            fetch(`${config.apiBase}/thingspeak/channel-details`),
            fetch(`${config.apiBase}/thingspeak/latest-feed`),
            fetch(`${config.apiBase}/thingspeak/status`)
        ]);
        
        if (!channelDetailsResponse.ok || !latestFeedResponse.ok || !statusResponse.ok) {
            throw new Error('One or more API endpoints returned an error');
        }
        
        // Parse responses
        const channelDetailsResult = await channelDetailsResponse.json();
        const latestFeedResult = await latestFeedResponse.json();
        const statusResult = await statusResponse.json();
        
        // Update state with fetched data
        state.channelDetails = channelDetailsResult.success ? channelDetailsResult.data : null;
        state.latestData = latestFeedResult.success ? latestFeedResult.data : null;
        state.channelStatus = statusResult.success ? statusResult.data : null;
        state.lastUpdated = new Date();
        
        // Update UI
        updateChannelDetails();
        updateLatestData();
        updateFieldMapping();
        updateApiUsage();
        updateVisualizations();
        
        updateStatus('connected', `Last updated: ${formatTime(state.lastUpdated)}`);
        showToast('Refresh Complete', 'All data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        updateStatus('error', 'Refresh failed');
        showToast('Refresh Error', 'Failed to refresh data. Please try again.', 'danger');
    } finally {
        elements.refreshButton.disabled = false;
    }
}

/**
 * Update channel details in UI
 */
function updateChannelDetails() {
    const detailsContainer = elements.channelDetailsContainer;
    
    if (!state.channelDetails) {
        detailsContainer.innerHTML = `<div class="alert alert-warning">No channel details available</div>`;
        return;
    }
    
    const channel = state.channelDetails;
    
    // Update status badge
    updateChannelStatusBadge(state.channelStatus);
    
    // Format created/updated dates
    const createdDate = new Date(channel.created_at).toLocaleDateString();
    const updatedDate = new Date(channel.updated_at).toLocaleDateString();
    
    // Generate channel details HTML
    detailsContainer.innerHTML = `
        <div class="mb-3">
            <strong>Channel ID:</strong> ${channel.id}
        </div>
        <div class="mb-3">
            <strong>Name:</strong> ${channel.name || 'Unnamed Channel'}
        </div>
        <div class="mb-3">
            <strong>Description:</strong> ${channel.description || 'No description'}
        </div>
        <div class="mb-3">
            <strong>Created:</strong> ${createdDate}
        </div>
        <div class="mb-3">
            <strong>Last Update:</strong> ${updatedDate}
        </div>
        <div class="mb-3">
            <strong>Readings:</strong> ${channel.last_entry_id || 0}
        </div>
        ${channel.url ? `<div class="mb-3"><strong>URL:</strong> <a href="${channel.url}" target="_blank">${channel.url}</a></div>` : ''}
    `;
}

/**
 * Update channel status badge
 */
function updateChannelStatusBadge(status) {
    const badge = elements.channelStatusBadge;
    
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
 * Update latest data container
 */
function updateLatestData() {
    const container = elements.latestDataContainer;
    
    if (!state.latestData || !state.latestData.data || state.latestData.data.length === 0) {
        container.innerHTML = `<div class="alert alert-warning">No data available</div>`;
        return;
    }
    
    const latestEntry = state.latestData.data[0];
    const timestamp = new Date(latestEntry.created_at).toLocaleString();
    
    // Format values for display
    const readings = [
        { name: 'Humidity', value: formatValue(latestEntry.field1 || latestEntry.humidity), unit: '%' },
        { name: 'Temperature', value: formatValue(latestEntry.field2 || latestEntry.temperature), unit: '°C' },
        { name: 'PM2.5', value: formatValue(latestEntry.field3 || latestEntry.pm25), unit: 'μg/m³' },
        { name: 'PM10', value: formatValue(latestEntry.field4 || latestEntry.pm10), unit: 'μg/m³' }
    ];
    
    // Generate HTML for latest readings
    container.innerHTML = `
        <div class="text-muted mb-2">Last reading at: ${timestamp}</div>
        <div class="row">
            ${readings.map(reading => `
                <div class="col-md-6 mb-3">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${reading.name}</h5>
                            <p class="card-text display-6">${reading.value} <small class="text-muted">${reading.unit}</small></p>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * Update field mapping information
 */
function updateFieldMapping() {
    const container = elements.fieldMappingContainer;
    
    if (!state.channelDetails) {
        container.innerHTML = `<div class="alert alert-warning">No field mapping available</div>`;
        return;
    }
    
    const channel = state.channelDetails;
    
    // Extract field mappings from channel details
    const fieldMappings = [
        { id: 'field1', name: channel.field1 || 'Humidity', description: 'Relative Humidity' },
        { id: 'field2', name: channel.field2 || 'Temperature', description: 'Degrees Celsius' },
        { id: 'field3', name: channel.field3 || 'PM2.5', description: 'Fine particulate matter' },
        { id: 'field4', name: channel.field4 || 'PM10', description: 'Coarse particulate matter' },
        { id: 'field5', name: channel.field5 || 'Field 5', description: 'Not used' },
        { id: 'field6', name: channel.field6 || 'Field 6', description: 'Not used' },
        { id: 'field7', name: channel.field7 || 'Field 7', description: 'Not used' },
        { id: 'field8', name: channel.field8 || 'Field 8', description: 'Not used' }
    ];
    
    // Generate HTML table for field mappings
    container.innerHTML = `
        <table class="table table-striped">
            <thead>
                <tr>
                    <th>Field ID</th>
                    <th>Name</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
                ${fieldMappings.map(field => `
                    <tr>
                        <td>${field.id}</td>
                        <td>${field.name}</td>
                        <td>${field.description}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Update API usage information
 */
function updateApiUsage() {
    const container = elements.apiUsageContainer;
    
    if (!state.channelStatus) {
        container.innerHTML = `<div class="alert alert-warning">No API usage information available</div>`;
        return;
    }
    
    const status = state.channelStatus;
    const usageInfo = status.usage || {};
    
    // Generate HTML for API usage info
    container.innerHTML = `
        <div class="row">
            <div class="col-md-6 mb-3">
                <h5>ThingSpeak API Usage</h5>
                <table class="table table-sm">
                    <tr>
                        <td>Request Rate Limit:</td>
                        <td>${usageInfo.rate_limit || 'N/A'} requests per minute</td>
                    </tr>
                    <tr>
                        <td>Daily Quota:</td>
                        <td>${usageInfo.daily_limit || 'N/A'} requests per day</td>
                    </tr>
                    <tr>
                        <td>Remaining Today:</td>
                        <td>${usageInfo.remaining || 'N/A'} requests</td>
                    </tr>
                    <tr>
                        <td>Reset Time:</td>
                        <td>${usageInfo.reset_time ? new Date(usageInfo.reset_time).toLocaleString() : 'N/A'}</td>
                    </tr>
                </table>
            </div>
            <div class="col-md-6 mb-3">
                <h5>Integration Status</h5>
                <div class="progress mb-3">
                    <div class="progress-bar bg-success" style="width: ${Math.min(100, status.uptime_percentage || 0)}%">
                        ${Math.round(status.uptime_percentage || 0)}% Uptime
                    </div>
                </div>
                <p>Last check: ${status.last_checked ? new Date(status.last_checked).toLocaleString() : 'N/A'}</p>
                <p>Last data received: ${status.last_data_received ? new Date(status.last_data_received).toLocaleString() : 'N/A'}</p>
            </div>
        </div>
    `;
}

/**
 * Create visualizations using Chart.js for current values
 */
function createVisualizations() {
    if (!state.latestData || !state.latestData.data || state.latestData.data.length === 0) {
        return;
    }
    
    const latestEntry = state.latestData.data[0];
    
    // Get values from entry
    const pm25 = parseFloat(latestEntry.field3 || latestEntry.pm25) || 0;
    const pm10 = parseFloat(latestEntry.field4 || latestEntry.pm10) || 0;
    const temp = parseFloat(latestEntry.field2 || latestEntry.temperature) || 0;
    const humidity = parseFloat(latestEntry.field1 || latestEntry.humidity) || 0;
    
    // Create radar chart (balanced plot of all parameters)
    if (window.AirQualityViz) {
        // Create radar chart 
        if (state.charts.radar) {
            state.charts.radar.destroy();
        }
        state.charts.radar = window.AirQualityViz.createRadarVisualization(
            'liveRadarChart',
            {pm25, pm10, temperature: temp, humidity},
            {theme: config.chartTheme}
        );
        
        // Create AQI gauge chart
        if (state.charts.gauge) {
            state.charts.gauge.destroy();
        }
        state.charts.gauge = window.AirQualityViz.createAQIGaugeVisualization(
            'liveAQIGauge',
            pm25,
            {theme: config.chartTheme, title: 'Current Air Quality'}
        );
    } else {
        console.error('Visualization library not available');
    }
}

/**
 * Update visualizations with new data
 */
function updateVisualizations() {
    // Recreate visualizations with new data
    createVisualizations();
}

/**
 * Update the status indicator
 */
function updateStatus(status, message) {
    if (!elements.statusIndicator || !elements.statusText) return;
    
    elements.statusIndicator.className = `status-indicator ${status}`;
    elements.statusText.textContent = message;
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info') {
    if (!elements.toastContainer) return;
    
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
 * Toggle theme between light and dark
 */
function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon
    const themeIcon = elements.toggleTheme.querySelector('i');
    if (newTheme === 'dark') {
        themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    } else {
        themeIcon.classList.replace('bi-sun-fill', 'bi-moon-fill');
    }
    
    // Update chart theme
    config.chartTheme = newTheme;
    updateVisualizations();
}

/**
 * Format time for display
 */
function formatTime(date) {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

/**
 * Format numeric value for display
 */
function formatValue(value) {
    if (value === undefined || value === null) {
        return 'N/A';
    }
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : num.toFixed(2);
}

// Set initial theme from localStorage
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    const themeIcon = elements.toggleTheme.querySelector('i');
    if (themeIcon) {
        themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    }
}
