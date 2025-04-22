/**
 * System status dashboard functionality
 */
document.addEventListener('DOMContentLoaded', function() {
    // Load channel status
    loadChannelStatus();
    
    // Load system health
    loadSystemHealth();
    
    // Load API endpoints
    loadApiEndpoints();
    
    // Configure cache clear button
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);
    
    // Update status every 60 seconds
    setInterval(() => {
        loadChannelStatus();
        loadSystemHealth();
    }, 60000);
});

/**
 * Load ThingSpeak channel status
 */
function loadChannelStatus() {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            if (data.success && data.status) {
                const status = data.status;
                const healthStatus = status.health || {};
                
                // Create status card with appropriate color
                let statusClass = 'success';
                if (healthStatus.status === 'warning') statusClass = 'warning';
                if (healthStatus.status === 'error') statusClass = 'danger';
                
                const html = `
                    <div class="alert alert-${statusClass}">
                        <h5>Channel Status: ${healthStatus.status || 'Unknown'}</h5>
                        <p>Last update: ${new Date(status.channel?.updated_at || Date.now()).toLocaleString()}</p>
                        <p>Time since last update: ${healthStatus.lastUpdateMinutesAgo || '?'} minutes</p>
                        <p>Entry count: ${status.channel?.last_entry_id || 0}</p>
                    </div>
                `;
                
                document.getElementById('channel-status-info').innerHTML = html;
            } else {
                document.getElementById('channel-status-info').innerHTML = `
                    <div class="alert alert-danger">
                        <h5>Unable to fetch channel status</h5>
                        <p>${data.error || 'Unknown error'}</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            document.getElementById('channel-status-info').innerHTML = `
                <div class="alert alert-danger">
                    <h5>Connection Error</h5>
                    <p>${error.message}</p>
                </div>
            `;
        });
}

/**
 * Load system health information
 */
function loadSystemHealth() {
    fetch('/api/health')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const health = data.health;
                
                let statusClass = 'success';
                if (health.status === 'warning' || health.status === 'notice') statusClass = 'warning';
                if (health.status === 'critical' || health.status === 'error') statusClass = 'danger';
                
                const html = `
                    <div class="alert alert-${statusClass}">
                        <h5>System Status: ${health.status}</h5>
                        <p>${health.message}</p>
                        <p>Data source: ${health.name || 'Unknown'}</p>
                        <p>Entry count: ${health.entryCount.toLocaleString()}</p>
                        <p>Last updated: ${health.minutesSinceUpdate} minutes ago</p>
                    </div>
                `;
                
                document.getElementById('system-health').innerHTML = html;
            } else {
                document.getElementById('system-health').innerHTML = `
                    <div class="alert alert-danger">
                        <h5>Unable to fetch system health</h5>
                        <p>${data.error || 'Unknown error'}</p>
                    </div>
                `;
            }
        })
        .catch(error => {
            document.getElementById('system-health').innerHTML = `
                <div class="alert alert-danger">
                    <h5>Connection Error</h5>
                    <p>${error.message}</p>
                </div>
            `;
        });
}

/**
 * Clear the API cache
 */
function clearCache() {
    const button = document.getElementById('clearCacheBtn');
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Clearing...';
    
    fetch('/api/cache/clear', {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {
            document.getElementById('cache-status').innerHTML = `
                <div class="alert alert-success">
                    <p>${data.message}</p>
                </div>
            `;
            
            // Re-enable button after a delay
            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = '<i class="bi bi-trash"></i> Clear API Cache';
            }, 2000);
        })
        .catch(error => {
            document.getElementById('cache-status').innerHTML = `
                <div class="alert alert-danger">
                    <p>Failed to clear cache: ${error.message}</p>
                </div>
            `;
            button.disabled = false;
            button.innerHTML = '<i class="bi bi-trash"></i> Clear API Cache';
        });
}

/**
 * Load and test API endpoints
 */
function loadApiEndpoints() {
    const endpoints = [
        { url: '/api/data', description: 'Data API' },
        { url: '/api/data-source', description: 'Data Source Info' },
        { url: '/api/analysis?quick=true', description: 'Quick Analysis' },
        { url: '/api/status', description: 'Channel Status' },
        { url: '/api/health', description: 'System Health' },
        { url: '/api/realtime?lastEntryId=0', description: 'Realtime Updates' }
    ];
    
    const tableBody = document.getElementById('api-endpoints-table');
    tableBody.innerHTML = '';
    
    endpoints.forEach(endpoint => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><code>${endpoint.url}</code></td>
            <td>${endpoint.description}</td>
            <td id="status-${btoa(endpoint.url)}">Checking...</td>
            <td>
                <button class="btn btn-sm btn-primary test-endpoint" 
                        data-url="${endpoint.url}">
                    Test
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
        
        // Test endpoint
        testEndpoint(endpoint.url);
    });
    
    // Add event listeners to test buttons
    document.querySelectorAll('.test-endpoint').forEach(button => {
        button.addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            testEndpoint(url);
        });
    });
}

/**
 * Test an API endpoint
 */
function testEndpoint(url) {
    const statusId = `status-${btoa(url)}`;
    const statusEl = document.getElementById(statusId);
    
    statusEl.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>';
    
    const startTime = performance.now();
    
    fetch(url)
        .then(response => {
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            if (response.ok) {
                statusEl.innerHTML = `<span class="badge bg-success">OK (${responseTime}ms)</span>`;
            } else {
                statusEl.innerHTML = `<span class="badge bg-danger">Error ${response.status}</span>`;
            }
        })
        .catch(error => {
            statusEl.innerHTML = `<span class="badge bg-danger">Failed</span>`;
        });
}
