/**
 * Status page JavaScript
 * Provides monitoring and diagnostic information about the Air Quality Monitoring system
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the system status page
    checkChannelStatus();
    checkSystemHealth();
    loadApiEndpoints();
    loadResourceMetrics();
    loadCacheStats();
    
    // Set up cache clear button
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    
    // Set up auto-refresh
    setInterval(checkChannelStatus, 60000); // Check channel status every minute
    setInterval(checkSystemHealth, 30000);  // Check system health every 30 seconds
    setInterval(loadResourceMetrics, 10000); // Update resource metrics every 10 seconds
    
    // Update last checked time
    document.getElementById('last-check-time').textContent = formatTime(new Date());
    
    // Set up theme toggle
    const toggleThemeBtn = document.getElementById('toggleTheme');
    if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener('click', ThemeManager.toggleTheme);
    }
    
    // Set up export report button
    const exportStatusBtn = document.getElementById('exportStatusBtn');
    if (exportStatusBtn) {
        exportStatusBtn.addEventListener('click', exportStatusReport);
    }
});

/**
 * Check ThingSpeak channel status
 */
function checkChannelStatus() {
    const statusElement = document.getElementById('channel-status-info');
    statusElement.innerHTML = `
        <div class="viz-loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Checking channel status...</p>
        </div>
    `;
    
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
                let statusText = 'Active';
                if (dataAge.hours > 24) {
                    statusBadge = 'bg-danger';
                    statusText = 'Inactive';
                } else if (dataAge.hours > 1) {
                    statusBadge = 'bg-warning';
                    statusText = 'Stale';
                }
                
                let html = `
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h5 class="mb-0">${channel.name || 'Channel ' + channel.id}</h5>
                        <span class="badge ${statusBadge}">${statusText}</span>
                    </div>
                    
                    <div class="mb-3">
                        <div class="field-item field1">
                            <div class="d-flex justify-content-between">
                                <div><i class="bi bi-moisture me-2"></i>Humidity</div>
                                <div>${channel.field1 || 'Humidity (%)' }</div>
                            </div>
                        </div>
                        <div class="field-item field2">
                            <div class="d-flex justify-content-between">
                                <div><i class="bi bi-thermometer-half me-2"></i>Temperature</div>
                                <div>${channel.field2 || 'Temperature (°C)'}</div>
                            </div>
                        </div>
                        <div class="field-item field3">
                            <div class="d-flex justify-content-between">
                                <div><i class="bi bi-cloud-haze2 me-2"></i>PM2.5</div>
                                <div>${channel.field3 || 'PM2.5 (μg/m³)'}</div>
                            </div>
                        </div>
                        <div class="field-item field4">
                            <div class="d-flex justify-content-between">
                                <div><i class="bi bi-cloud me-2"></i>PM10</div>
                                <div>${channel.field4 || 'PM10 (μg/m³)'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-2">
                                <strong><i class="bi bi-clock-history me-1"></i>Last Update:</strong> 
                                <span class="badge bg-info">${lastUpdate.toLocaleString()}</span>
                            </div>
                            <div class="mb-2">
                                <strong><i class="bi bi-hourglass-split me-1"></i>Data Age:</strong> 
                                <span class="badge ${dataAge.hours > 1 ? 'bg-warning' : 'bg-success'}">
                                    ${formatDataAge(dataAge)}
                                </span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-2">
                                <strong><i class="bi bi-database me-1"></i>Total Entries:</strong> 
                                <span class="badge bg-primary">${channel.last_entry_id || 0}</span>
                            </div>
                            <div class="mb-2">
                                <strong><i class="bi bi-calendar-event me-1"></i>Created:</strong> 
                                ${new Date(channel.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </div>
                    
                    <div class="d-grid gap-2 d-md-flex justify-content-md-end mt-3">
                        <a href="https://thingspeak.com/channels/${channel.id}" 
                           target="_blank" class="btn btn-sm btn-outline-primary">
                            <i class="bi bi-box-arrow-up-right me-1"></i>Open in ThingSpeak
                        </a>
                        <a href="/thingspeak-info" class="btn btn-sm btn-outline-info">
                            <i class="bi bi-info-circle me-1"></i>Detailed Info
                        </a>
                    </div>
                `;
                statusElement.innerHTML = html;
                
                // Update health overview
                updateHealthOverview();
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        })
        .catch(error => {
            console.error('Error checking channel status:', error);
            statusElement.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Error</h5>
                    <p>Error checking channel status: ${error.message}</p>
                    <button class="btn btn-sm btn-danger mt-2" onclick="checkChannelStatus()">
                        <i class="bi bi-arrow-repeat me-1"></i>Try Again
                    </button>
                </div>
            `;
            
            // Update health overview
            updateHealthOverview(false, 'ThingSpeak connection issue');
        });
}

/**
 * Check system health status
 */
function checkSystemHealth() {
    const healthElement = document.getElementById('system-health');
    healthElement.innerHTML = `
        <div class="viz-loading">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-2">Checking system health...</p>
        </div>
    `;
    
    fetch('/api/health')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const uptimeFormatted = formatUptime(data.uptime);
            
            // Update system uptime in resource section
            const systemUptimeElement = document.getElementById('system-uptime');
            if (systemUptimeElement) {
                systemUptimeElement.textContent = uptimeFormatted;
            }
            
            // Update Node.js version in resource section
            const nodejsVersionElement = document.getElementById('nodejs-version');
            if (nodejsVersionElement && data.node_version) {
                nodejsVersionElement.textContent = data.node_version;
            }
            
            let healthHtml = `
                <div class="alert alert-success">
                    <h5><i class="bi bi-check-circle me-2"></i>System Running</h5>
                    <p class="mb-0">All core services are operational.</p>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <div class="mb-2">
                            <strong><i class="bi bi-clock-history me-1"></i>Uptime:</strong> ${uptimeFormatted}
                        </div>
                        <div class="mb-2">
                            <strong><i class="bi bi-calendar-event me-1"></i>Server Time:</strong> 
                            ${new Date(data.timestamp).toLocaleString()}
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-2">
                            <strong><i class="bi bi-gear me-1"></i>Environment:</strong> 
                            <span class="badge bg-info">${data.environment || 'development'}</span>
                        </div>
                        <div class="mb-2">
                            <strong><i class="bi bi-cpu me-1"></i>OS:</strong> 
                            ${data.os || 'Unknown'}
                        </div>
                    </div>
                </div>
            `;
                
            // Check visualization support
            fetch('/api/visualization/status')
                .then(response => response.json())
                .then(vizData => {
                    healthHtml += `
                        <h6><i class="bi bi-bar-chart me-2"></i>Visualization Engine</h6>
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1">
                                <span>
                                    <span class="badge ${vizData.pythonAvailable ? 'bg-success' : 'bg-warning'}">
                                        ${vizData.pythonAvailable ? 'Python Available' : 'JavaScript Mode'}
                                    </span>
                                    ${vizData.engineDetails || ''}
                                </span>
                                <button class="btn btn-sm btn-outline-primary" id="testVizBtn">
                                    <i class="bi bi-play me-1"></i>Test
                                </button>
                            </div>
                        </div>
                    `;
                    
                    healthElement.innerHTML = healthHtml;
                    
                    // Add test visualization button event listener
                    const testVizBtn = document.getElementById('testVizBtn');
                    if (testVizBtn) {
                        testVizBtn.addEventListener('click', testVisualization);
                    }
                    
                    // Update health overview
                    updateHealthOverview(true);
                })
                .catch(error => {
                    healthHtml += `
                        <h6><i class="bi bi-bar-chart me-2"></i>Visualization Engine</h6>
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            Unable to check visualization engine status
                        </div>
                    `;
                    healthElement.innerHTML = healthHtml;
                    
                    // Update health overview with warning
                    updateHealthOverview(true, 'Visualization service issue');
                });
        })
        .catch(error => {
            console.error('Error checking system health:', error);
            healthElement.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="bi bi-exclamation-triangle-fill me-2"></i>Error</h5>
                    <p>Error checking system health: ${error.message}</p>
                    <button class="btn btn-sm btn-danger mt-2" onclick="checkSystemHealth()">
                        <i class="bi bi-arrow-repeat me-1"></i>Try Again
                    </button>
                </div>
            `;
            
            // Update health overview
            updateHealthOverview(false, 'System health check failed');
        });
}

/**
 * Load API endpoints and test them
 */
function loadApiEndpoints() {
    const tableBody = document.getElementById('api-endpoints-table');
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center">
                <div class="spinner-border spinner-border-sm me-2" role="status"></div>
                Loading endpoints...
            </td>
        </tr>
    `;
    
    const endpoints = [
        { url: '/api/data/latest', description: 'Latest sensor readings', icon: 'arrow-up-right-circle' },
        { url: '/api/data/recent', description: 'Recent data points', icon: 'clock-history' },
        { url: '/api/data/stats', description: 'Statistical summary', icon: 'bar-chart' },
        { url: '/api/thingspeak/latest-feed', description: 'ThingSpeak latest feed', icon: 'cloud-download' },
        { url: '/api/visualization/time_series', description: 'Time series visualization', icon: 'graph-up' },
        { url: '/api/channel/status', description: 'Channel status information', icon: 'info-circle' },
        { url: '/api/health', description: 'System health information', icon: 'activity' },
        { url: '/api/config', description: 'System configuration', icon: 'gear' }
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
                let responseTimeClass = '';
                
                if (result.time) {
                    if (result.time < 200) responseTimeClass = 'text-success';
                    else if (result.time < 500) responseTimeClass = 'text-warning';
                    else responseTimeClass = 'text-danger';
                }
                
                tableHtml += `
                    <tr>
                        <td>
                            <i class="bi bi-${result.icon || 'link'} me-2"></i>
                            ${result.url}
                        </td>
                        <td>${result.description}</td>
                        <td><span class="badge ${statusClass}">${statusText}</span></td>
                        <td class="${responseTimeClass}">${result.time ? result.time + 'ms' : 'N/A'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary test-endpoint" data-url="${result.url}">
                                <i class="bi bi-lightning-charge me-1"></i>Test
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
                        const timeCell = row.cells[3];
                        
                        statusCell.innerHTML = `
                            <div class="spinner-border spinner-border-sm" role="status">
                                <span class="visually-hidden">Testing...</span>
                            </div>
                        `;
                        
                        timeCell.innerHTML = 'Testing...';
                        
                        testEndpoint(endpoint).then(result => {
                            let statusClass = result.success ? 'bg-success' : 'bg-danger';
                            let statusText = result.success ? 'OK' : 'Failed';
                            let responseTimeClass = '';
                            
                            if (result.time) {
                                if (result.time < 200) responseTimeClass = 'text-success';
                                else if (result.time < 500) responseTimeClass = 'text-warning';
                                else responseTimeClass = 'text-danger';
                            }
                            
                            statusCell.innerHTML = `<span class="badge ${statusClass}">${statusText}</span>`;
                            timeCell.className = responseTimeClass;
                            timeCell.textContent = result.time ? result.time + 'ms' : 'N/A';
                        });
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error testing endpoints:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> 
                        Error testing endpoints: ${error.message}
                    </td>
                </tr>
                <tr>
                    <td colspan="5" class="text-center">
                        <button class="btn btn-sm btn-danger" onclick="loadApiEndpoints()">
                            <i class="bi bi-arrow-repeat me-1"></i>Retry
                        </button>
                    </td>
                </tr>
            `;
            
            // Update health overview
            updateHealthOverview(false, 'API endpoint tests failed');
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
            icon: endpoint.icon,
            success: response.ok,
            status: response.status,
            time: time,
            error: response.ok ? null : await response.text()
        };
    } catch (error) {
        return {
            url: endpoint.url,
            description: endpoint.description,
            icon: endpoint.icon,
            success: false,
            error: error.message
        };
    }
}

/**
 * Load resource utilization metrics
 */
function loadResourceMetrics() {
    fetch('/api/metrics/resources')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load resource metrics');
            return response.json();
        })
        .then(data => {
            if (!data.success) throw new Error(data.error || 'Unknown error');
            
            const resources = data.data;
            
            // Update memory usage
            const memoryUsageBar = document.getElementById('memory-usage-bar');
            const memoryUsageText = document.getElementById('memory-usage-text');
            if (memoryUsageBar && memoryUsageText && resources.memory) {
                const memoryPercent = Math.round((resources.memory.used / resources.memory.total) * 100);
                memoryUsageBar.style.width = `${memoryPercent}%`;
                memoryUsageBar.className = `progress-bar ${memoryPercent > 80 ? 'bg-danger' : memoryPercent > 60 ? 'bg-warning' : 'bg-success'}`;
                memoryUsageText.textContent = `${formatBytes(resources.memory.used)} / ${formatBytes(resources.memory.total)} (${memoryPercent}%)`;
            }
            
            // Update CPU usage
            const cpuUsageBar = document.getElementById('cpu-usage-bar');
            const cpuUsageText = document.getElementById('cpu-usage-text');
            if (cpuUsageBar && cpuUsageText && resources.cpu) {
                const cpuPercent = Math.round(resources.cpu.usage);
                cpuUsageBar.style.width = `${cpuPercent}%`;
                cpuUsageBar.className = `progress-bar ${cpuPercent > 80 ? 'bg-danger' : cpuPercent > 60 ? 'bg-warning' : 'bg-info'}`;
                cpuUsageText.textContent = `${cpuPercent}%`;
            }
            
            // Update disk usage
            const diskUsageBar = document.getElementById('disk-usage-bar');
            const diskUsageText = document.getElementById('disk-usage-text');
            const systemStorage = document.getElementById('system-storage');
            if (diskUsageBar && diskUsageText && resources.disk) {
                const diskPercent = Math.round((resources.disk.used / resources.disk.total) * 100);
                diskUsageBar.style.width = `${diskPercent}%`;
                diskUsageBar.className = `progress-bar ${diskPercent > 80 ? 'bg-danger' : diskPercent > 60 ? 'bg-warning' : 'bg-success'}`;
                diskUsageText.textContent = `${formatBytes(resources.disk.used)} / ${formatBytes(resources.disk.total)} (${diskPercent}%)`;
                
                if (systemStorage) {
                    systemStorage.textContent = `${formatBytes(resources.disk.free)} free of ${formatBytes(resources.disk.total)}`;
                }
            }
        })
        .catch(error => {
            console.error('Error loading resource metrics:', error);
        });
}

/**
 * Load cache statistics
 */
function loadCacheStats() {
    fetch('/api/metrics/cache')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load cache statistics');
            return response.json();
        })
        .then(data => {
            if (!data.success) throw new Error(data.error || 'Unknown error');
            
            const stats = data.data;
            
            // Update cache hit rate
            const cacheHitRate = document.getElementById('cache-hit-rate');
            if (cacheHitRate) {
                const hitRate = stats.hits && stats.misses ? 
                    Math.round((stats.hits / (stats.hits + stats.misses)) * 100) : 0;
                cacheHitRate.textContent = `${hitRate}%`;
            }
            
            // Update cache items
            const cacheItems = document.getElementById('cache-items');
            if (cacheItems) {
                cacheItems.textContent = stats.size || 0;
            }
            
            // Update last cleared time
            const cacheLastCleared = document.getElementById('cache-last-cleared');
            if (cacheLastCleared) {
                cacheLastCleared.textContent = stats.lastCleared ? 
                    new Date(stats.lastCleared).toLocaleString() : 'Never';
            }
        })
        .catch(error => {
            console.error('Error loading cache statistics:', error);
        });
}

/**
 * Clear API cache
 */
function clearCache() {
    const cacheStatus = document.getElementById('cache-status');
    cacheStatus.innerHTML = `
        <div class="alert alert-info">
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Clearing cache...
        </div>
    `;
    
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
                    <i class="bi bi-check-circle me-2"></i> 
                    Cache cleared successfully. Cleared ${data.clearedCount} items.
                </div>
            `;
            
            // Reload cache stats
            loadCacheStats();
            
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
                <i class="bi bi-exclamation-triangle me-2"></i> 
                Error clearing cache: ${error.message}
            </div>
        `;
    });
}

/**
 * Test visualization functionality
 */
function testVisualization() {
    // Show testing toast
    showToast('Testing Visualization', 'Generating test visualization...', 'info');
    
    fetch('/api/visualization/test')
        .then(response => {
            if (!response.ok) throw new Error('Failed to test visualization');
            return response.json();
        })
        .then(data => {
            if (!data.success) throw new Error(data.error || 'Visualization test failed');
            
            showToast('Visualization Test', 'Visualization test completed successfully', 'success');
        })
        .catch(error => {
            console.error('Error testing visualization:', error);
            showToast('Visualization Test Failed', error.message, 'danger');
        });
}

/**
 * Update health overview
 */
function updateHealthOverview(isHealthy = true, issue = null) {
    const badge = document.getElementById('health-status-badge');
    const progressBar = document.getElementById('health-progress-bar');
    
    if (!badge || !progressBar) return;
    
    if (isHealthy && !issue) {
        badge.className = 'badge bg-success';
        badge.textContent = 'System OK';
        
        progressBar.className = 'progress-bar bg-success';
        progressBar.style.width = '100%';
    } else if (isHealthy && issue) {
        badge.className = 'badge bg-warning';
        badge.textContent = 'Minor Issue';
        
        progressBar.className = 'progress-bar bg-warning';
        progressBar.style.width = '75%';
    } else {
        badge.className = 'badge bg-danger';
        badge.textContent = 'System Error';
        
        progressBar.className = 'progress-bar bg-danger';
        progressBar.style.width = '25%';
    }
    
    // Update last check time
    document.getElementById('last-check-time').textContent = formatTime(new Date());
}

/**
 * Export status report as JSON/PDF
 */
function exportStatusReport() {
    // Show exporting toast
    showToast('Export Report', 'Preparing system status report...', 'info');
    
    fetch('/api/status/export')
        .then(response => {
            if (!response.ok) throw new Error('Failed to export status report');
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'system-status-report.pdf';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            showToast('Export Complete', 'Status report downloaded successfully', 'success');
        })
        .catch(error => {
            console.error('Error exporting status report:', error);
            showToast('Export Failed', error.message, 'danger');
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
 * Format file size
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
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
 * Format current time for display
 */
function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info') {
    const toastId = `toast-${Date.now()}`;
    
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header bg-${type} text-white">
                <strong class="me-auto">
                    <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'} me-1"></i>
                    ${title}
                </strong>
                <small>${formatTime(new Date())}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    const toastContainer = document.getElementById('toast-container');
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Auto-remove after shown
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}