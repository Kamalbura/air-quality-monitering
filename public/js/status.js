/**
 * Status page JavaScript
 * Provides monitoring and diagnostic information about the Air Quality Monitoring system
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the system status page
    checkChannelStatus();
    checkSystemHealth();
    loadApiEndpoints();
    
    // Set up cache clear button
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    
    // Set up auto-refresh
    setInterval(checkChannelStatus, 60000); // Check channel status every minute
    setInterval(checkSystemHealth, 30000);  // Check system health every 30 seconds
});

/**
 * Check ThingSpeak channel status
 */
function checkChannelStatus() {
    const statusElement = document.getElementById('channel-status-info');
    statusElement.innerHTML = '<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Checking channel status...</div>';
    
    fetch('/api/channel/status')
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            let statusHtml = `
                <div class="alert ${data.active ? 'alert-success' : 'alert-warning'}">
                    <h5><i class="bi ${data.active ? 'bi-check-circle' : 'bi-exclamation-triangle'}"></i> 
                    Channel ${data.channelId || 'Unknown'} - ${data.active ? 'Active' : 'Inactive'}</h5>
                </div>
                <div class="mb-2"><strong>Last Entry:</strong> ${data.lastEntryDate || 'No data'}</div>
                <div class="mb-2"><strong>Entry Count:</strong> ${data.entryCount || 0}</div>
                <div class="mb-2"><strong>Data Age:</strong> ${getDataAgeDisplay(data.dataAge)}</div>`;
                
            if (data.fields) {
                statusHtml += '<div class="mt-3"><strong>Available Fields:</strong></div>';
                statusHtml += '<ul class="list-group">';
                
                for (const [key, value] of Object.entries(data.fields)) {
                    statusHtml += `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            ${key}
                            <span class="badge ${value ? 'bg-success' : 'bg-secondary'} rounded-pill">
                                ${value ? 'Available' : 'Not Available'}
                            </span>
                        </li>`;
                }
                
                statusHtml += '</ul>';
            }
            
            statusElement.innerHTML = statusHtml;
        })
        .catch(error => {
            statusElement.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error checking channel status: ${error.message}
                </div>
                <button class="btn btn-sm btn-outline-secondary" onclick="checkChannelStatus()">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>`;
        });
}

/**
 * Check system health status
 */
function checkSystemHealth() {
    const healthElement = document.getElementById('system-health');
    healthElement.innerHTML = '<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Checking system health...</div>';
    
    fetch('/health')
        .then(response => response.json())
        .then(data => {
            const uptimeFormatted = formatUptime(data.uptime);
            let healthHtml = `
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle"></i> System Running</h5>
                </div>
                <div class="mb-2"><strong>Uptime:</strong> ${uptimeFormatted}</div>
                <div class="mb-2"><strong>Server Time:</strong> ${new Date(data.timestamp).toLocaleString()}</div>`;
                
            // Check visualization support
            fetch('/api/visualization/status')
                .then(response => response.json())
                .then(vizData => {
                    healthHtml += `
                        <div class="mb-2"><strong>Visualization Engine:</strong> 
                            <span class="badge ${vizData.pythonAvailable ? 'bg-success' : 'bg-warning'}">
                                ${vizData.pythonAvailable ? 'Python Available' : 'JavaScript Mode'}
                            </span>
                        </div>`;
                    
                    if (vizData.engineDetails) {
                        healthHtml += `<div class="mb-2"><strong>Engine Details:</strong> ${vizData.engineDetails}</div>`;
                    }
                    
                    healthElement.innerHTML = healthHtml;
                })
                .catch(error => {
                    healthHtml += `
                        <div class="mb-2"><strong>Visualization Engine:</strong> 
                            <span class="badge bg-danger">Status Unknown</span>
                        </div>`;
                    healthElement.innerHTML = healthHtml;
                });
        })
        .catch(error => {
            healthElement.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error checking system health: ${error.message}
                </div>
                <button class="btn btn-sm btn-outline-secondary" onclick="checkSystemHealth()">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>`;
        });
}

/**
 * Load API endpoints and test them
 */
function loadApiEndpoints() {
    const tableBody = document.getElementById('api-endpoints-table');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Loading endpoints...</td></tr>';
    
    const endpoints = [
        { url: '/api/data/latest', description: 'Latest sensor readings' },
        { url: '/api/data/recent', description: 'Recent data points' },
        { url: '/api/data/stats', description: 'Statistical summary' },
        { url: '/api/visualization/time_series', description: 'Time series visualization' },
        { url: '/api/visualization/daily_pattern', description: 'Daily pattern visualization' },
        { url: '/api/visualization/correlation', description: 'Correlation visualization' },
        { url: '/api/channel/status', description: 'Channel status information' }
    ];
    
    let tableHtml = '';
    
    // Test each endpoint sequentially
    let promiseChain = Promise.resolve();
    
    endpoints.forEach((endpoint, index) => {
        promiseChain = promiseChain
            .then(() => {
                tableHtml += `
                    <tr id="endpoint-row-${index}">
                        <td>${endpoint.url}</td>
                        <td>${endpoint.description}</td>
                        <td id="endpoint-status-${index}">
                            <div class="spinner-border spinner-border-sm" role="status"></div> Testing...
                        </td>
                        <td>
                            <a href="${endpoint.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                                <i class="bi bi-box-arrow-up-right"></i>
                            </a>
                        </td>
                    </tr>`;
                
                tableBody.innerHTML = tableHtml;
                
                const startTime = Date.now();
                return fetch(endpoint.url)
                    .then(response => {
                        const endTime = Date.now();
                        const duration = endTime - startTime;
                        
                        const statusCell = document.getElementById(`endpoint-status-${index}`);
                        if (response.ok) {
                            statusCell.innerHTML = `
                                <span class="badge bg-success">OK (${duration}ms)</span>`;
                        } else {
                            statusCell.innerHTML = `
                                <span class="badge bg-danger">Error ${response.status}</span>`;
                        }
                    })
                    .catch(error => {
                        const statusCell = document.getElementById(`endpoint-status-${index}`);
                        statusCell.innerHTML = `
                            <span class="badge bg-danger">Failed</span>`;
                    });
            });
    });
}

/**
 * Clear API cache
 */
function clearCache() {
    const cacheStatus = document.getElementById('cache-status');
    cacheStatus.innerHTML = '<div class="alert alert-info"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Clearing cache...</div>';
    
    fetch('/api/admin/clear-cache', { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                cacheStatus.innerHTML = `
                    <div class="alert alert-success">
                        <i class="bi bi-check-circle"></i> Cache cleared successfully!
                    </div>`;
                
                // Refresh all status indicators
                checkChannelStatus();
                checkSystemHealth();
                loadApiEndpoints();
            } else {
                throw new Error(data.message || 'Unknown error');
            }
        })
        .catch(error => {
            cacheStatus.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error clearing cache: ${error.message}
                </div>`;
        });
}

/**
 * Format server uptime into human-readable form
 */
function formatUptime(uptime) {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0 || days > 0) result += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    
    return result;
}

/**
 * Get a human-readable display of data age
 */
function getDataAgeDisplay(ageInMinutes) {
    if (!ageInMinutes && ageInMinutes !== 0) {
        return 'Unknown';
    }
    
    if (ageInMinutes < 1) {
        return 'Just now';
    } else if (ageInMinutes < 60) {
        return `${Math.round(ageInMinutes)} minutes ago`;
    } else if (ageInMinutes < 1440) {
        const hours = Math.floor(ageInMinutes / 60);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else {
        const days = Math.floor(ageInMinutes / 1440);
        return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    }
}