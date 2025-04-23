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
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const channel = data.channel;
                const lastUpdate = new Date(channel.updated_at);
                const dataAge = getDataAge(lastUpdate);
                
                // Determine status badge based on data age
                let statusBadge = 'bg-success';
                if (dataAge.hours > 24) {
                    statusBadge = 'bg-danger';
                } else if (dataAge.hours > 1) {
                    statusBadge = 'bg-warning';
                }
                
                let html = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0">Channel ${channel.id}: ${channel.name}</h5>
                        <span class="badge ${statusBadge}">
                            ${dataAge.hours > 24 ? 'Inactive' : 'Active'}
                        </span>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Description:</strong> ${channel.description || 'N/A'}</p>
                            <p><strong>Last Update:</strong> ${lastUpdate.toLocaleString()}</p>
                            <p><strong>Data Age:</strong> ${formatDataAge(dataAge)}</p>
                            <p><strong>Total Entries:</strong> ${channel.last_entry_id || 0}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Created:</strong> ${new Date(channel.created_at).toLocaleDateString()}</p>
                            <p><strong>Field 1:</strong> ${channel.field1 || 'Humidity (%)'}</p>
                            <p><strong>Field 2:</strong> ${channel.field2 || 'Temperature (°C)'}</p>
                            <p><strong>Field 3:</strong> ${channel.field3 || 'PM2.5 (μg/m³)'}</p>
                            <p><strong>Field 4:</strong> ${channel.field4 || 'PM10 (μg/m³)'}</p>
                        </div>
                    </div>
                `;
                statusElement.innerHTML = html;
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error checking channel status:', error);
            statusElement.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error checking channel status: ${error.message}
                </div>
                <button class="btn btn-sm btn-outline-secondary" onclick="checkChannelStatus()">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>
            `;
        });
}

/**
 * Check system health status
 */
function checkSystemHealth() {
    const healthElement = document.getElementById('system-health');
    healthElement.innerHTML = '<div class="d-flex align-items-center"><div class="spinner-border spinner-border-sm me-2" role="status"></div>Checking system health...</div>';
    
    fetch('/api/health')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const uptimeFormatted = formatUptime(data.uptime);
            let healthHtml = `
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle"></i> System Running</h5>
                </div>
                <div class="mb-2"><strong>Uptime:</strong> ${uptimeFormatted}</div>
                <div class="mb-2"><strong>Server Time:</strong> ${new Date(data.timestamp).toLocaleString()}</div>
                <div class="mb-2"><strong>Environment:</strong> ${data.environment || 'development'}</div>
            `;
                
            // Check visualization support
            fetch('/api/visualization/status')
                .then(response => response.json())
                .then(vizData => {
                    healthHtml += `
                        <div class="mb-2"><strong>Visualization Engine:</strong> 
                            <span class="badge ${vizData.pythonAvailable ? 'bg-success' : 'bg-warning'}">
                                ${vizData.pythonAvailable ? 'Python Available' : 'JavaScript Mode'}
                            </span>
                        </div>
                    `;
                    
                    if (vizData.engineDetails) {
                        healthHtml += `<div class="mb-2"><strong>Engine Details:</strong> ${vizData.engineDetails}</div>`;
                    }
                    
                    healthElement.innerHTML = healthHtml;
                })
                .catch(error => {
                    healthHtml += `
                        <div class="mb-2"><strong>Visualization Engine:</strong> 
                            <span class="badge bg-danger">Status Unknown</span>
                        </div>
                    `;
                    healthElement.innerHTML = healthHtml;
                });
        })
        .catch(error => {
            console.error('Error checking system health:', error);
            healthElement.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> Error checking system health: ${error.message}
                </div>
                <button class="btn btn-sm btn-outline-secondary" onclick="checkSystemHealth()">
                    <i class="bi bi-arrow-repeat"></i> Try Again
                </button>
            `;
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
        { url: '/api/channel/status', description: 'Channel status information' },
        { url: '/api/health', description: 'System health information' }
    ];
    
    let tableHtml = '';
    
    // Test each endpoint sequentially
    let testPromises = endpoints.map(endpoint => {
        return testEndpoint(endpoint);
    });

    // When all tests complete, update the table
    Promise.all(testPromises)
        .then(results => {
            results.forEach(result => {
                let statusClass = result.success ? 'bg-success' : 'bg-danger';
                let statusText = result.success ? 'OK' : 'Failed';
                
                tableHtml += `
                    <tr>
                        <td>${result.url}</td>
                        <td>${result.description}</td>
                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-secondary test-endpoint" data-url="${result.url}">
                                <i class="bi bi-lightning"></i> Test
                            </button>
                        </td>
                    </tr>
                `;
            });
            tableBody.innerHTML = tableHtml;
            
            // Add event listeners to test buttons
            document.querySelectorAll('.test-endpoint').forEach(button => {
                button.addEventListener('click', function() {
                    const url = this.getAttribute('data-url');
                    const endpoint = endpoints.find(e => e.url === url);
                    if (endpoint) {
                        const row = this.closest('tr');
                        const statusCell = row.cells[2];
                        statusCell.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
                        
                        testEndpoint(endpoint).then(result => {
                            let statusClass = result.success ? 'bg-success' : 'bg-danger';
                            let statusText = result.success ? 'OK' : 'Failed';
                            statusCell.innerHTML = `<span class="badge ${statusClass}">${statusText}</span>`;
                        });
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error testing endpoints:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle"></i> Error testing endpoints: ${error.message}
                    </td>
                </tr>
            `;
        });
}

/**
 * Test a specific API endpoint
 */
async function testEndpoint(endpoint) {
    try {
        const start = Date.now();
        const response = await fetch(endpoint.url, { 
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        const time = Date.now() - start;
        
        return {
            url: endpoint.url,
            description: endpoint.description,
            success: response.ok,
            status: response.status,
            time: time,
            error: response.ok ? null : await response.text()
        };
    } catch (error) {
        return {
            url: endpoint.url,
            description: endpoint.description,
            success: false,
            error: error.message
        };
    }
}

/**
 * Clear API cache
 */
function clearCache() {
    const cacheStatus = document.getElementById('cache-status');
    cacheStatus.innerHTML = '<div class="spinner-border spinner-border-sm me-2" role="status"></div>Clearing cache...';
    
    fetch('/api/clear-cache', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            cacheStatus.innerHTML = `
                <div class="alert alert-success">
                    <i class="bi bi-check-circle"></i> Cache cleared successfully. Cleared ${data.clearedCount} items.
                </div>
            `;
            
            // Reload all data after cache clear
            setTimeout(() => {
                checkChannelStatus();
                checkSystemHealth();
                loadApiEndpoints();
            }, 1000);
        } else {
            throw new Error(data.error || 'Failed to clear cache');
        }
    })
    .catch(error => {
        console.error('Error clearing cache:', error);
        cacheStatus.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> Error clearing cache: ${error.message}
            </div>
        `;
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
function getDataAge(updateTime) {
    const now = new Date();
    const diff = now - updateTime;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    return {
        seconds,
        minutes,
        hours,
        days
    };
}

/**
 * Format data age for display
 */
function formatDataAge(dataAge) {
    if (dataAge.days > 1) {
        return `${dataAge.days} days old`;
    } else if (dataAge.hours > 1) {
        return `${dataAge.hours} hours old`;
    } else if (dataAge.minutes > 1) {
        return `${dataAge.minutes} minutes old`;
    } else {
        return `${dataAge.seconds} seconds old`;
    }
}

/**
 * Error handling wrapper for fetch requests
 */
async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error;
    }
}