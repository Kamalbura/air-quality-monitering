/**
 * Unified Configuration Manager
 * Combines configuration management and UI functionality
 */

// Global state
let configData = {};
let diagnosticsData = {};
const elements = {};
const modals = {};

// Configuration for different sections
const CONFIG_SECTIONS = {
    thingspeak: {
        title: 'ThingSpeak Configuration',
        fields: ['channelId', 'readApiKey', 'writeApiKey', 'updateInterval']
    },
    dataSources: {
        title: 'Data Sources',
        fields: ['enabled', 'refreshRate', 'retryAttempts']
    },
    system: {
        title: 'System Settings',
        fields: ['logLevel', 'maxDataPoints', 'autoBackup']
    },
    visualization: {
        title: 'Visualization Settings',
        fields: ['chartType', 'colorScheme', 'animationSpeed']
    },
    security: {
        title: 'Security Settings',
        fields: ['corsEnabled', 'rateLimitEnabled', 'apiKeyRequired']
    }
};

document.addEventListener('DOMContentLoaded', function() {
    initializeConfigManager();
});

/**
 * Initialize the configuration manager
 */
async function initializeConfigManager() {
    try {
        console.log('🔧 Initializing Configuration Manager...');
        
        // Initialize DOM elements
        initializeElements();
        
        // Setup event listeners
        setupEventListeners();
        
        // Load configuration and theme
        await loadConfiguration();
        loadThemePreference();
        
        // Setup section navigation
        setupSectionNavigation();
        
        // Load diagnostics if on that section
        const activeSection = getActiveSection();
        if (activeSection === 'diagnostics-section') {
            await loadDiagnostics();
        }
        
        console.log('✅ Configuration Manager initialized successfully');
    } catch (error) {
        console.error('❌ Error initializing configuration manager:', error);
        showToast('Error', 'Failed to initialize configuration manager. Please refresh the page.', 'danger');
    }
}

/**
 * Initialize DOM element references
 */
function initializeElements() {
    // Status elements
    elements.statusIndicator = document.getElementById('status-indicator');
    elements.statusText = document.getElementById('status-text');
    elements.configStatus = document.getElementById('configStatus');
    elements.configStatusMsg = document.getElementById('configStatusMsg');
    
    // Forms for different configuration sections
    elements.forms = {
        thingspeak: document.getElementById('thingspeakForm'),
        dataSources: document.getElementById('dataSourcesForm'),
        system: document.getElementById('systemForm'),
        visualization: document.getElementById('visualizationForm'),
        security: document.getElementById('securityForm')
    };
    
    // Config sections
    elements.sections = document.querySelectorAll('.config-section');
    elements.sectionLinks = document.querySelectorAll('.config-section-link');
    
    // JSON textarea
    elements.configJson = document.getElementById('configJson');
    
    // Buttons
    elements.toggleTheme = document.getElementById('toggleTheme');
    elements.saveButtons = document.querySelectorAll('.save-config-btn');
    elements.resetButtons = document.querySelectorAll('.reset-config-btn');
    elements.refreshButtons = document.querySelectorAll('.refresh-btn');
    
    // Diagnostics elements
    elements.diagnosticsContainer = document.getElementById('diagnostics-container');
    elements.apiMetricsContainer = document.getElementById('api-metrics-container');
    elements.healthCheckContainer = document.getElementById('health-check-container');
    
    // Modals
    modals.confirmSave = new bootstrap.Modal(document.getElementById('confirmSaveModal'));
    modals.confirmReset = new bootstrap.Modal(document.getElementById('confirmResetModal'));
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Navigation between sections
    elements.sectionLinks.forEach(link => {
        link.addEventListener('click', async function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            await showSection(sectionId);
        });
    });
    
    // Form submissions
    Object.entries(elements.forms).forEach(([section, form]) => {
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                await saveConfiguration(section);
            });
        }
    });
    
    // Save buttons
    elements.saveButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const section = this.getAttribute('data-section');
            await saveConfiguration(section);
        });
    });
    
    // Reset buttons
    elements.resetButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            confirmReset(section);
        });
    });
    
    // Refresh buttons
    elements.refreshButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const action = this.getAttribute('data-action');
            await performRefreshAction(action);
        });
    });
    
    // Theme toggle
    if (elements.toggleTheme) {
        elements.toggleTheme.addEventListener('click', toggleTheme);
    }
    
    // JSON editor
    if (elements.configJson) {
        elements.configJson.addEventListener('change', function() {
            try {
                const parsed = JSON.parse(this.value);
                configData = parsed;
                populateFormsFromConfig();
            } catch (error) {
                showToast('Error', 'Invalid JSON format', 'danger');
            }
        });
    }
    
    // Form field change listeners
    setupFormFieldListeners();
}

/**
 * Setup form field change listeners
 */
function setupFormFieldListeners() {
    Object.entries(elements.forms).forEach(([section, form]) => {
        if (form) {
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.addEventListener('change', function() {
                    markSectionAsModified(section);
                });
            });
        }
    });
}

/**
 * Load configuration from server
 */
async function loadConfiguration() {
    try {
        console.log('📡 Loading configuration...');
        showStatus('loading', 'Loading configuration...');
        
        const response = await fetch('/api/config');
        const result = await response.json();
        
        if (result.success) {
            configData = result.data;
            populateFormsFromConfig();
            updateJsonEditor();
            showStatus('success', 'Configuration loaded successfully');
            console.log('✅ Configuration loaded:', configData);
        } else {
            throw new Error(result.error || 'Failed to load configuration');
        }
    } catch (error) {
        console.error('❌ Error loading configuration:', error);
        showStatus('error', `Error loading configuration: ${error.message}`);
        showToast('Error', 'Failed to load configuration', 'danger');
    }
}

/**
 * Save configuration for a specific section
 */
async function saveConfiguration(section) {
    try {
        console.log(`💾 Saving ${section} configuration...`);
        showStatus('loading', `Saving ${section} configuration...`);
        
        // Get form data for the section
        const formData = getFormData(section);
        
        // Update config data
        configData[section] = { ...configData[section], ...formData };
        
        // Send to server
        const response = await fetch(`/api/config/${section}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showStatus('success', `${section} configuration saved successfully`);
            showToast('Success', `${CONFIG_SECTIONS[section]?.title || section} configuration saved`, 'success');
            clearSectionModified(section);
            updateJsonEditor();
        } else {
            throw new Error(result.error || 'Failed to save configuration');
        }
    } catch (error) {
        console.error(`❌ Error saving ${section} configuration:`, error);
        showStatus('error', `Error saving configuration: ${error.message}`);
        showToast('Error', `Failed to save ${section} configuration`, 'danger');
    }
}

/**
 * Get form data for a section
 */
function getFormData(section) {
    const form = elements.forms[section];
    if (!form) return {};
    
    const formData = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    
    inputs.forEach(input => {
        const name = input.name || input.id;
        if (name) {
            let value = input.value;
            
            // Handle different input types
            if (input.type === 'checkbox') {
                value = input.checked;
            } else if (input.type === 'number') {
                value = parseFloat(value) || 0;
            }
            
            formData[name] = value;
        }
    });
    
    return formData;
}

/**
 * Populate forms from configuration data
 */
function populateFormsFromConfig() {
    Object.entries(elements.forms).forEach(([section, form]) => {
        if (form && configData[section]) {
            const sectionData = configData[section];
            const inputs = form.querySelectorAll('input, select, textarea');
            
            inputs.forEach(input => {
                const name = input.name || input.id;
                if (name && sectionData.hasOwnProperty(name)) {
                    const value = sectionData[name];
                    
                    if (input.type === 'checkbox') {
                        input.checked = Boolean(value);
                    } else {
                        input.value = value;
                    }
                }
            });
        }
    });
}

/**
 * Update JSON editor
 */
function updateJsonEditor() {
    if (elements.configJson) {
        elements.configJson.value = JSON.stringify(configData, null, 2);
    }
}

/**
 * Show specific section
 */
async function showSection(sectionId) {
    // Hide all sections
    elements.sections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all links
    elements.sectionLinks.forEach(link => {
        link.classList.remove('active');
    });
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Add active class to current link
    const activeLink = document.querySelector(`[href="#${sectionId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Load section-specific data
    if (sectionId === 'diagnostics-section') {
        await loadDiagnostics();
    }
    
    // Update URL hash
    window.location.hash = sectionId;
}

/**
 * Setup section navigation
 */
function setupSectionNavigation() {
    // Show initial section based on URL hash or default
    const hash = window.location.hash.substring(1);
    const initialSection = hash && document.getElementById(hash) ? hash : 'thingspeak-section';
    showSection(initialSection);
}

/**
 * Get currently active section
 */
function getActiveSection() {
    for (const section of elements.sections) {
        if (section.style.display !== 'none') {
            return section.id;
        }
    }
    return null;
}

/**
 * Load diagnostics data
 */
async function loadDiagnostics() {
    try {
        console.log('📊 Loading diagnostics data...');
        
        // Load health data
        const healthResponse = await fetch('/api/health');
        const healthData = await healthResponse.json();
        
        // Load metrics data
        const metricsResponse = await fetch('/api/metrics');
        const metricsData = await metricsResponse.json();
        
        // Update diagnostics display
        updateHealthDisplay(healthData);
        updateMetricsDisplay(metricsData);
        
        console.log('✅ Diagnostics data loaded');
    } catch (error) {
        console.error('❌ Error loading diagnostics:', error);
        showToast('Error', 'Failed to load diagnostics data', 'danger');
    }
}

/**
 * Update health display
 */
function updateHealthDisplay(data) {
    if (!elements.healthCheckContainer) return;
    
    const html = `
        <div class="health-status ${data.status === 'healthy' ? 'healthy' : 'unhealthy'}">
            <h4>System Health: ${data.status}</h4>
            <p>Uptime: ${formatUptime(data.uptime)}</p>
            <p>Environment: ${data.environment}</p>
            <p>Last Updated: ${new Date(data.timestamp).toLocaleString()}</p>
        </div>
        <div class="services-status">
            <h5>Services Status</h5>
            ${Object.entries(data.services || {}).map(([service, status]) => `
                <div class="service-item">
                    <span class="service-name">${service}:</span>
                    <span class="service-status ${typeof status === 'string' ? status.toLowerCase() : 'unknown'}">${status}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    elements.healthCheckContainer.innerHTML = html;
}

/**
 * Update metrics display
 */
function updateMetricsDisplay(data) {
    if (!elements.apiMetricsContainer) return;
    
    const metrics = data.metrics || {};
    const html = `
        <div class="metrics-summary">
            <h4>API Metrics</h4>
            <div class="metrics-grid">
                <div class="metric-item">
                    <span class="metric-label">Total Requests:</span>
                    <span class="metric-value">${metrics.totalRequests || 0}</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Success Rate:</span>
                    <span class="metric-value">${((metrics.successfulRequests || 0) / (metrics.totalRequests || 1) * 100).toFixed(1)}%</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Average Response Time:</span>
                    <span class="metric-value">${metrics.averageResponseTime || 0}ms</span>
                </div>
                <div class="metric-item">
                    <span class="metric-label">Active Connections:</span>
                    <span class="metric-value">${metrics.activeConnections || 0}</span>
                </div>
            </div>
        </div>
    `;
    
    elements.apiMetricsContainer.innerHTML = html;
}

/**
 * Show status indicator
 */
function showStatus(type, message) {
    if (!elements.statusIndicator || !elements.statusText) return;
    
    elements.statusIndicator.className = `status-indicator ${type}`;
    elements.statusText.textContent = message;
    
    // Auto-hide after 5 seconds for success/error
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            elements.statusIndicator.className = 'status-indicator';
            elements.statusText.textContent = '';
        }, 5000);
    }
}

/**
 * Show toast notification
 */
function showToast(title, message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'danger' ? 'danger' : type === 'success' ? 'success' : 'info'} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <strong>${title}</strong><br>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    // Add to toast container
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // Show toast
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove from DOM after hiding
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

/**
 * Mark section as modified
 */
function markSectionAsModified(section) {
    const form = elements.forms[section];
    if (form) {
        form.classList.add('modified');
    }
}

/**
 * Clear section modified state
 */
function clearSectionModified(section) {
    const form = elements.forms[section];
    if (form) {
        form.classList.remove('modified');
    }
}

/**
 * Confirm reset action
 */
function confirmReset(section) {
    if (confirm(`Are you sure you want to reset ${CONFIG_SECTIONS[section]?.title || section} configuration to defaults?`)) {
        resetConfiguration(section);
    }
}

/**
 * Reset configuration for a section
 */
async function resetConfiguration(section) {
    try {
        const response = await fetch(`/api/config/${section}/reset`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            await loadConfiguration();
            showToast('Success', `${CONFIG_SECTIONS[section]?.title || section} configuration reset`, 'success');
        } else {
            throw new Error(result.error || 'Failed to reset configuration');
        }
    } catch (error) {
        console.error(`Error resetting ${section} configuration:`, error);
        showToast('Error', `Failed to reset ${section} configuration`, 'danger');
    }
}

/**
 * Perform refresh action
 */
async function performRefreshAction(action) {
    try {
        let endpoint;
        let message;
        
        switch (action) {
            case 'config':
                endpoint = '/api/config/refresh';
                message = 'Configuration refreshed';
                break;
            case 'data':
                endpoint = '/api/refresh';
                message = 'Data refreshed';
                break;
            case 'diagnostics':
                await loadDiagnostics();
                showToast('Success', 'Diagnostics data refreshed', 'success');
                return;
            default:
                throw new Error('Unknown refresh action');
        }
        
        const response = await fetch(endpoint, { method: 'POST' });
        const result = await response.json();
        
        if (result.success) {
            if (action === 'config') {
                await loadConfiguration();
            }
            showToast('Success', message, 'success');
        } else {
            throw new Error(result.error || 'Refresh failed');
        }
    } catch (error) {
        console.error(`Error performing ${action} refresh:`, error);
        showToast('Error', `Failed to refresh ${action}`, 'danger');
    }
}

/**
 * Theme management
 */
function loadThemePreference() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeButton(theme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    if (elements.toggleTheme) {
        elements.toggleTheme.innerHTML = theme === 'dark' ? 
            '<i class="fas fa-sun"></i> Light Mode' : 
            '<i class="fas fa-moon"></i> Dark Mode';
    }
}

/**
 * Utility functions
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

// Export for use in other modules
window.ConfigManager = {
    loadConfiguration,
    saveConfiguration,
    showSection,
    showToast,
    loadDiagnostics
};
