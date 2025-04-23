/**
 * Configuration Manager JavaScript
 * Handles configuration management interface functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize configuration manager
    initConfigManager();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load theme preference
    loadThemePreference();
});

/**
 * Initialize the configuration manager
 */
async function initConfigManager() {
    try {
        // Load current configuration
        await loadConfiguration();
        
        // Load diagnostics data
        if (isActiveSectionId('diagnostics-section')) {
            loadDiagnostics();
        }
    } catch (error) {
        console.error('Error initializing configuration manager:', error);
        showToast('Error', 'Failed to load configuration. Please try refreshing the page.', 'danger');
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Navigation between sections
    document.querySelectorAll('.config-section-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            showSection(sectionId);
            
            // Load diagnostics data if viewing that section
            if (sectionId === 'diagnostics-section') {
                loadDiagnostics();
            }
        });
    });
    
    // Save configuration
    document.getElementById('saveAllBtn').addEventListener('click', saveAllConfig);
    
    // Reset configuration
    document.getElementById('resetConfigBtn').addEventListener('click', resetConfig);
    
    // Export configuration
    document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
    
    // Import configuration
    document.getElementById('importConfigBtn').addEventListener('click', () => {
        document.getElementById('configFileInput').click();
    });
    
    // Handle file selection for import
    document.getElementById('configFileInput').addEventListener('change', importConfig);
    
    // Test ThingSpeak connection
    document.getElementById('testThingspeakBtn').addEventListener('click', testThingspeak);
    
    // Run diagnostics
    document.getElementById('runDiagnosticsBtn').addEventListener('click', runDiagnostics);
    
    // Log type selector
    document.getElementById('log-type-selector').addEventListener('change', function() {
        loadLogs(this.value);
    });
    
    // Theme toggle
    document.getElementById('toggleTheme').addEventListener('click', toggleTheme);
}

/**
 * Load configuration from the server
 */
async function loadConfiguration() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        
        if (data.success) {
            populateConfigForm(data.config);
        } else {
            throw new Error(data.error || 'Failed to load configuration');
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
        showToast('Error', 'Failed to load configuration: ' + error.message, 'danger');
    }
}

/**
 * Save all configuration settings
 */
async function saveAllConfig() {
    try {
        const config = collectConfigValues();
        
        const response = await fetch('/api/config/all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Success', 'Configuration saved successfully', 'success');
        } else {
            throw new Error(data.error || 'Failed to save configuration');
        }
    } catch (error) {
        console.error('Error saving configuration:', error);
        showToast('Error', 'Failed to save configuration: ' + error.message, 'danger');
    }
}

/**
 * Reset configuration to defaults
 */
async function resetConfig() {
    if (!confirm('Are you sure you want to reset all configuration to default values?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/config/reset', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Success', 'Configuration reset to defaults', 'success');
            await loadConfiguration();
        } else {
            throw new Error(data.error || 'Failed to reset configuration');
        }
    } catch (error) {
        console.error('Error resetting configuration:', error);
        showToast('Error', 'Failed to reset configuration: ' + error.message, 'danger');
    }
}

/**
 * Export configuration to JSON file
 */
function exportConfig() {
    window.location.href = '/api/config/export';
}

/**
 * Import configuration from JSON file
 */
async function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('config', file);
    
    try {
        const response = await fetch('/api/config/import', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('Success', 'Configuration imported successfully', 'success');
            await loadConfiguration();
        } else {
            throw new Error(data.error || 'Failed to import configuration');
        }
    } catch (error) {
        console.error('Error importing configuration:', error);
        showToast('Error', 'Failed to import configuration: ' + error.message, 'danger');
    }
    
    // Reset the file input
    document.getElementById('configFileInput').value = '';
}

/**
 * Test ThingSpeak connection
 */
async function testThingspeak() {
    const resultElement = document.getElementById('thingspeak-test-result');
    resultElement.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div> Testing connection...';
    
    try {
        // Get current values from form
        const channelId = document.getElementById('thingspeakChannelId').value;
        const readApiKey = document.getElementById('thingspeakReadApiKey').value;
        
        const response = await fetch('/api/diagnostics/thingspeak', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ channelId, readApiKey })
        });
        
        const data = await response.json();
        
        if (data.success) {
            let testsHtml = '<div class="alert alert-success"><strong>Connection successful!</strong></div>';
            testsHtml += '<h6 class="mt-3">Test Results:</h6>';
            testsHtml += '<ul class="list-group">';
            
            data.data.tests.forEach(test => {
                const statusClass = test.success ? 'success' : 'danger';
                const statusIcon = test.success ? 'check-circle' : 'x-circle';
                testsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
                    <span>${test.name}</span>
                    <span class="badge bg-${statusClass}"><i class="bi bi-${statusIcon}"></i></span>
                </li>`;
            });
            
            testsHtml += '</ul>';
            
            if (data.data.recommendations && data.data.recommendations.length > 0) {
                testsHtml += '<h6 class="mt-3">Recommendations:</h6>';
                testsHtml += '<ul>';
                data.data.recommendations.forEach(rec => {
                    testsHtml += `<li>${rec}</li>`;
                });
                testsHtml += '</ul>';
            }
            
            resultElement.innerHTML = testsHtml;
        } else {
            throw new Error(data.error || 'Connection test failed');
        }
    } catch (error) {
        console.error('Error testing ThingSpeak connection:', error);
        resultElement.innerHTML = `
            <div class="alert alert-danger">
                <strong>Connection failed:</strong> ${error.message}
            </div>
        `;
    }
}

/**
 * Load diagnostics data
 */
async function loadDiagnostics() {
    try {
        // Load system metrics
        loadSystemMetrics();
        
        // Load logs (default to error logs)
        loadLogs('error');
        
        // Load ThingSpeak metrics
        loadThingSpeakMetrics();
        
        // Load data quality metrics
        loadDataQualityMetrics();
    } catch (error) {
        console.error('Error loading diagnostics:', error);
    }
}

/**
 * Run comprehensive diagnostics
 */
async function runDiagnostics() {
    // Show loading indicators
    document.getElementById('system-metrics').innerHTML = getLoadingHTML();
    document.getElementById('error-metrics').innerHTML = getLoadingHTML();
    document.getElementById('thingspeak-metrics').innerHTML = getLoadingHTML();
    document.getElementById('data-quality-metrics').innerHTML = getLoadingHTML();
    document.getElementById('logs-container').innerHTML = getLoadingHTML();
    
    // Reload all diagnostics data
    await loadDiagnostics();
    
    showToast('Diagnostics', 'Diagnostics completed', 'info');
}

/**
 * Load system metrics
 */
async function loadSystemMetrics() {
    const element = document.getElementById('system-metrics');
    element.innerHTML = getLoadingHTML();
    
    try {
        const response = await fetch('/api/diagnostics/metrics');
        const data = await response.json();
        
        if (data.success) {
            const metrics = data.data;
            const uptime = formatUptime(metrics.uptime);
            const memoryUsage = formatBytes(metrics.memory.used);
            const memoryTotal = formatBytes(metrics.memory.total);
            const memoryPercent = Math.round((metrics.memory.used / metrics.memory.total) * 100);
            
            let html = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="card border-info mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-clock"></i> Uptime</h5>
                                <p class="card-text">${uptime}</p>
                                <div class="small text-muted">Started: ${new Date(metrics.startTime).toLocaleString()}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-warning mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-memory"></i> Memory Usage</h5>
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-warning" role="progressbar" style="width: ${memoryPercent}%" 
                                        aria-valuenow="${memoryPercent}" aria-valuemin="0" aria-valuemax="100">
                                        ${memoryPercent}%
                                    </div>
                                </div>
                                <p class="card-text">${memoryUsage} used of ${memoryTotal}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="card border-danger mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-exclamation-triangle"></i> Errors (24h)</h5>
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>${metrics.errors.rate.toFixed(2)} per hour</span>
                                    <span class="badge ${metrics.errors.change > 0 ? 'bg-danger' : 'bg-success'}">
                                        ${metrics.errors.change > 0 ? '+' : ''}${metrics.errors.change}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-primary mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-cpu"></i> Environment</h5>
                                <table class="table table-sm small">
                                    <tbody>
                                        <tr><td>Node.js:</td><td>${metrics.environment['Node.js Version']}</td></tr>
                                        <tr><td>Platform:</td><td>${metrics.environment['Platform']} (${metrics.environment['Architecture']})</td></tr>
                                        <tr><td>CPU Cores:</td><td>${metrics.environment['CPU Cores']}</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            element.innerHTML = html;
        } else {
            throw new Error(data.error || 'Failed to load system metrics');
        }
    } catch (error) {
        console.error('Error loading system metrics:', error);
        element.innerHTML = `<div class="alert alert-danger">Error loading system metrics: ${error.message}</div>`;
    }
}

/**
 * Load logs
 */
async function loadLogs(type = 'error') {
    const element = document.getElementById('logs-container');
    element.innerHTML = getLoadingHTML();
    
    try {
        const response = await fetch('/api/diagnostics/logs');
        const data = await response.json();
        
        if (data.success) {
            const logs = data.data[type] || [];
            
            if (logs.length === 0) {
                element.innerHTML = '<div class="alert alert-info">No logs available</div>';
                return;
            }
            
            let html = '<table class="table table-sm table-hover">';
            
            if (type === 'error') {
                html += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Context</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                logs.forEach(log => {
                    html += `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleString()}</td>
                            <td>${log.context}</td>
                            <td>${log.message}</td>
                        </tr>
                    `;
                });
            } else if (type === 'access') {
                html += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Method</th>
                            <th>Path</th>
                            <th>Status</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                logs.forEach(log => {
                    const statusClass = log.status >= 400 ? 'text-danger' : (log.status >= 300 ? 'text-warning' : 'text-success');
                    html += `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleString()}</td>
                            <td>${log.method}</td>
                            <td>${log.path}</td>
                            <td class="${statusClass}">${log.status}</td>
                            <td>${log.responseTime}ms</td>
                        </tr>
                    `;
                });
            } else if (type === 'api') {
                html += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Endpoint</th>
                            <th>Status</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                logs.forEach(log => {
                    const statusClass = log.success ? 'text-success' : 'text-danger';
                    html += `
                        <tr>
                            <td>${new Date(log.timestamp).toLocaleString()}</td>
                            <td>${log.endpoint}</td>
                            <td class="${statusClass}">${log.status}</td>
                            <td>${log.message}</td>
                        </tr>
                    `;
                });
            }
            
            html += '</tbody></table>';
            element.innerHTML = html;
        } else {
            throw new Error(data.error || 'Failed to load logs');
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        element.innerHTML = `<div class="alert alert-danger">Error loading logs: ${error.message}</div>`;
    }
}

/**
 * Load ThingSpeak metrics
 */
async function loadThingSpeakMetrics() {
    const element = document.getElementById('thingspeak-metrics');
    element.innerHTML = getLoadingHTML();
    
    try {
        const response = await fetch('/api/diagnostics/thingspeak');
        const data = await response.json();
        
        if (data.success) {
            const metrics = data.data;
            const connectedClass = metrics.connected ? 'success' : 'danger';
            const connectedStatus = metrics.connected ? 'Connected' : 'Disconnected';
            const lastSuccess = metrics.lastSuccess ? new Date(metrics.lastSuccess).toLocaleString() : 'Never';
            
            let html = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="card border-${connectedClass} mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-cloud"></i> Connection Status</h5>
                                <p class="card-text">
                                    <span class="badge bg-${connectedClass}">${connectedStatus}</span>
                                </p>
                                <div class="small text-muted">Last successful connection: ${lastSuccess}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-info mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-bar-chart"></i> API Usage</h5>
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-info" role="progressbar" 
                                        style="width: ${Math.min(100, (metrics.usage.used / metrics.usage.daily_limit) * 100)}%" 
                                        aria-valuenow="${metrics.usage.used}" aria-valuemin="0" aria-valuemax="${metrics.usage.daily_limit}">
                                        ${Math.round((metrics.usage.used / metrics.usage.daily_limit) * 100)}%
                                    </div>
                                </div>
                                <p class="card-text">${metrics.usage.used} of ${metrics.usage.daily_limit} daily requests used</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            if (metrics.connected && metrics.diagnostics && metrics.diagnostics.tests) {
                html += '<h6 class="mt-3">Recent Tests:</h6>';
                html += '<ul class="list-group">';
                
                metrics.diagnostics.tests.forEach(test => {
                    const statusClass = test.success ? 'success' : 'danger';
                    const statusIcon = test.success ? 'check-circle' : 'x-circle';
                    html += `<li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${test.name}</span>
                        <span class="badge bg-${statusClass}"><i class="bi bi-${statusIcon}"></i> ${test.time ? (test.time + 'ms') : ''}</span>
                    </li>`;
                });
                
                html += '</ul>';
            }
            
            if (metrics.requests && metrics.requests.length > 0) {
                html += '<h6 class="mt-3">Recent Requests:</h6>';
                html += '<div class="table-responsive" style="max-height: 200px; overflow-y: auto;">';
                html += '<table class="table table-sm table-hover">';
                html += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Endpoint</th>
                            <th>Status</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                metrics.requests.forEach(req => {
                    const statusClass = req.status >= 400 ? 'text-danger' : (req.status >= 300 ? 'text-warning' : 'text-success');
                    html += `
                        <tr>
                            <td>${new Date(req.timestamp).toLocaleString()}</td>
                            <td>${req.endpoint}</td>
                            <td class="${statusClass}">${req.status}</td>
                            <td>${req.responseTime}ms</td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                html += '</div>';
            }
            
            element.innerHTML = html;
        } else {
            throw new Error(data.error || 'Failed to load ThingSpeak metrics');
        }
    } catch (error) {
        console.error('Error loading ThingSpeak metrics:', error);
        element.innerHTML = `<div class="alert alert-danger">Error loading ThingSpeak metrics: ${error.message}</div>`;
    }
}

/**
 * Load data quality metrics
 */
async function loadDataQualityMetrics() {
    const element = document.getElementById('data-quality-metrics');
    element.innerHTML = getLoadingHTML();
    
    try {
        const response = await fetch('/api/diagnostics/data-quality');
        const data = await response.json();
        
        if (data.success) {
            const metrics = data.data;
            
            // Calculate overall completeness score
            const completeness = metrics.completeness;
            let overallCompleteness = 0;
            let metricCount = 0;
            
            Object.values(completeness.metrics).forEach(values => {
                if (values && values.length > 0) {
                    overallCompleteness += values.reduce((sum, val) => sum + val, 0) / values.length;
                    metricCount++;
                }
            });
            
            const completenessScore = metricCount > 0 ? Math.round(overallCompleteness / metricCount) : 0;
            
            // Format completeness score
            const completenessClass = completenessScore >= 90 ? 'success' : 
                                    completenessScore >= 70 ? 'warning' : 'danger';
            
            let html = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="card border-${completenessClass} mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-clipboard-check"></i> Data Completeness</h5>
                                <div class="progress mb-2">
                                    <div class="progress-bar bg-${completenessClass}" role="progressbar" 
                                        style="width: ${completenessScore}%" 
                                        aria-valuenow="${completenessScore}" aria-valuemin="0" aria-valuemax="100">
                                        ${completenessScore}%
                                    </div>
                                </div>
                                <p class="card-text">Overall data completeness score</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card border-info mb-3">
                            <div class="card-body">
                                <h5 class="card-title"><i class="bi bi-reception-4"></i> Data Reception</h5>
                                <p class="card-text">
                                    Last hour: <strong>${metrics.reception?.rates?.slice(-1)[0] || 'N/A'}</strong> points/min
                                </p>
                                <p class="small text-muted">24-hour average: ${
                                    metrics.reception?.rates ? 
                                    (metrics.reception.rates.reduce((sum, val) => sum + val, 0) / metrics.reception.rates.length).toFixed(2) : 
                                    'N/A'
                                } points/min</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add data quality issues if available
            if (metrics.issues && metrics.issues.length > 0) {
                html += '<h6 class="mt-3">Recent Data Quality Issues:</h6>';
                html += '<div class="table-responsive">';
                html += '<table class="table table-sm table-hover">';
                html += `
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Metric</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                `;
                
                metrics.issues.forEach(issue => {
                    const statusBadge = issue.resolved ? 
                        '<span class="badge bg-success">Resolved</span>' : 
                        '<span class="badge bg-warning">Open</span>';
                        
                    html += `
                        <tr>
                            <td>${new Date(issue.timestamp).toLocaleString()}</td>
                            <td>${issue.metric}</td>
                            <td>${issue.type}</td>
                            <td>${issue.description}</td>
                            <td>${statusBadge}</td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                html += '</div>';
            } else {
                html += '<div class="alert alert-success mt-3">No data quality issues detected.</div>';
            }
            
            element.innerHTML = html;
        } else {
            throw new Error(data.error || 'Failed to load data quality metrics');
        }
    } catch (error) {
        console.error('Error loading data quality metrics:', error);
        element.innerHTML = `<div class="alert alert-danger">Error loading data quality metrics: ${error.message}</div>`;
    }
}

/**
 * Populate config form with values
 */
function populateConfigForm(config) {
    // ThingSpeak section
    if (config.thingspeak) {
        document.getElementById('thingspeakChannelId').value = config.thingspeak.channelId || '';
        document.getElementById('thingspeakReadApiKey').value = config.thingspeak.readApiKey || '';
        document.getElementById('thingspeakWriteApiKey').value = config.thingspeak.writeApiKey || '';
        document.getElementById('thingspeakUpdateInterval').value = config.thingspeak.updateInterval || 30000;
    }
    
    // Data sources section
    if (config.dataSources) {
        document.getElementById('defaultCsvPath').value = config.dataSources.defaultCsvPath || '';
        document.getElementById('csvUploadDir').value = config.dataSources.csvUploadDir || '';
        document.getElementById('dataExportDir').value = config.dataSources.dataExportDir || '';
    }
    
    // System section
    if (config.system) {
        document.getElementById('serverPort').value = config.system.port || 3000;
        document.getElementById('logLevel').value = config.system.logLevel || 'info';
        document.getElementById('cacheTTL').value = config.system.cacheTTL || 300;
        document.getElementById('debugMode').checked = config.system.debugMode || false;
    }
}

/**
 * Collect configuration values from the form
 */
function collectConfigValues() {
    const config = {
        thingspeak: {
            channelId: document.getElementById('thingspeakChannelId').value,
            readApiKey: document.getElementById('thingspeakReadApiKey').value,
            writeApiKey: document.getElementById('thingspeakWriteApiKey').value,
            updateInterval: parseInt(document.getElementById('thingspeakUpdateInterval').value, 10) || 30000
        },
        dataSources: {
            defaultCsvPath: document.getElementById('defaultCsvPath').value,
            csvUploadDir: document.getElementById('csvUploadDir').value,
            dataExportDir: document.getElementById('dataExportDir').value
        },
        system: {
            port: parseInt(document.getElementById('serverPort').value, 10) || 3000,
            logLevel: document.getElementById('logLevel').value,
            cacheTTL: parseInt(document.getElementById('cacheTTL').value, 10) || 300,
            debugMode: document.getElementById('debugMode').checked
        }
    };
    
    return config;
}

/**
 * Show a specific configuration section
 */
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.config-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Deactivate all section links
    document.querySelectorAll('.config-section-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Activate selected section link
    document.querySelector(`.config-section-link[href="#${sectionId}"]`).classList.add('active');
}

/**
 * Check if a section is active
 */
function isActiveSectionId(sectionId) {
    return document.getElementById(sectionId).classList.contains('active');
}

/**
 * Show a toast notification
 */
function showToast(title, message, type = 'primary') {
    const toastContainer = document.getElementById('toast-container');
    
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.setAttribute('id', toastId);
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}:</strong> ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const toastInstance = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    
    toastInstance.show();
    
    // Clean up after the toast is hidden
    toast.addEventListener('hidden.bs.toast', () => {
        document.getElementById(toastId)?.remove();
    });
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format uptime to human-readable string
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    let uptime = '';
    if (days > 0) uptime += `${days}d `;
    if (hours > 0 || days > 0) uptime += `${hours}h `;
    if (minutes > 0 || hours > 0 || days > 0) uptime += `${minutes}m `;
    uptime += `${remainingSeconds}s`;
    
    return uptime;
}

/**
 * Get HTML for loading indicator
 */
function getLoadingHTML() {
    return `
        <div class="d-flex justify-content-center">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
}

/**
 * Load theme preference from localStorage
 */
function loadThemePreference() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const themeIcon = document.getElementById('toggleTheme').querySelector('i');
        themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const themeIcon = document.getElementById('toggleTheme').querySelector('i');
    
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    } else {
        localStorage.setItem('theme', 'light');
        themeIcon.classList.replace('bi-sun-fill', 'bi-moon-fill');
    }
}
