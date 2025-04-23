/**
 * Enhanced Configuration Page JavaScript
 * Handles the configuration page UI and interactions with the config service
 */

// Global variables
let configData = {};
const elements = {};
const modals = {};

document.addEventListener('DOMContentLoaded', function() {
    // Initialize elements
    initElements();
    
    // Initialize configuration page
    loadConfig();
    setupEventListeners();
    loadThemePreference();
    
    // Show active section and hide others
    setupSectionNavigation();
});

/**
 * Initialize DOM element references
 */
function initElements() {
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
    elements.saveAllConfigBtn = document.getElementById('saveAllConfigBtn');
    elements.resetConfigBtn = document.getElementById('resetConfigBtn');
    elements.exportConfigBtn = document.getElementById('exportConfigBtn');
    elements.importConfigBtn = document.getElementById('importConfigBtn');
    elements.applyJsonBtn = document.getElementById('applyJsonBtn');
    elements.copyJsonBtn = document.getElementById('copyJsonBtn');
    elements.clearDataBtn = document.getElementById('clearDataBtn');
    elements.toggleWriteKey = document.getElementById('toggleWriteKey');
    
    // Save section buttons
    elements.saveSectionButtons = document.querySelectorAll('.save-section');

    // Modal elements
    modals.importConfig = new bootstrap.Modal(document.getElementById('importConfigModal'));
    modals.resetConfirm = new bootstrap.Modal(document.getElementById('resetConfirmModal'));
    modals.clearData = new bootstrap.Modal(document.getElementById('clearDataModal'));
    
    elements.importConfigText = document.getElementById('importConfigText');
    elements.confirmImportBtn = document.getElementById('confirmImportBtn');
    elements.confirmResetBtn = document.getElementById('confirmResetBtn');
    elements.confirmClearDataBtn = document.getElementById('confirmClearDataBtn');
}

/**
 * Set up event listeners for buttons and form elements
 */
function setupEventListeners() {
    // Save buttons
    elements.saveAllConfigBtn.addEventListener('click', saveAllConfig);
    elements.saveSectionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            saveSectionConfig(section);
        });
    });
    
    // Reset button
    elements.resetConfigBtn.addEventListener('click', () => {
        modals.resetConfirm.show();
    });
    
    elements.confirmResetBtn.addEventListener('click', () => {
        resetConfig();
        modals.resetConfirm.hide();
    });
    
    // Export button
    elements.exportConfigBtn.addEventListener('click', exportConfig);
    
    // Import button
    elements.importConfigBtn.addEventListener('click', () => {
        modals.importConfig.show();
    });
    
    elements.confirmImportBtn.addEventListener('click', () => {
        importConfig();
        modals.importConfig.hide();
    });
    
    // Apply JSON config button
    elements.applyJsonBtn.addEventListener('click', applyJsonConfig);
    
    // Copy JSON to clipboard button
    elements.copyJsonBtn.addEventListener('click', copyJsonToClipboard);
    
    // Toggle password visibility
    if (elements.toggleWriteKey) {
        elements.toggleWriteKey.addEventListener('click', togglePasswordVisibility);
    }
    
    // Clear data button
    elements.clearDataBtn.addEventListener('click', () => {
        modals.clearData.show();
    });
    
    elements.confirmClearDataBtn.addEventListener('click', () => {
        clearAllData();
        modals.clearData.hide();
    });
    
    // Theme toggle
    elements.toggleTheme.addEventListener('click', toggleTheme);
}

/**
 * Set up section navigation
 */
function setupSectionNavigation() {
    // Hide all sections initially except the first one
    elements.sections.forEach((section, index) => {
        if (index > 0) section.style.display = 'none';
    });
    
    // Add click handlers for section navigation
    elements.sectionLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            elements.sectionLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Get the target section ID from the href attribute
            const targetId = link.getAttribute('href');
            
            // Hide all sections
            elements.sections.forEach(section => section.style.display = 'none');
            
            // Show the target section
            document.querySelector(targetId).style.display = 'block';
        });
    });
}

/**
 * Load configuration from the server
 */
async function loadConfig() {
    updateStatus('loading', 'Loading configuration...');
    
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
            throw new Error('Failed to fetch configuration');
        }
        
        const result = await response.json();
        if (result.success) {
            configData = result.data;
            
            // Populate ThingSpeak form
            if (configData.thingspeak) {
                document.getElementById('channelId').value = configData.thingspeak.channelId || '';
                document.getElementById('readApiKey').value = configData.thingspeak.readApiKey || '';
                document.getElementById('writeApiKey').value = configData.thingspeak.writeApiKey || '';
                document.getElementById('updateInterval').value = configData.thingspeak.updateInterval || 30000;
            }
            
            // Populate Data Sources form
            if (configData.dataSources) {
                document.getElementById('defaultCsvPath').value = configData.dataSources.defaultCsvPath || '';
                document.getElementById('csvUploadDir').value = configData.dataSources.csvUploadDir || '';
                document.getElementById('dataExportDir').value = configData.dataSources.dataExportDir || '';
            }
            
            // Populate System form
            if (configData.system) {
                document.getElementById('port').value = configData.system.port || 3000;
                document.getElementById('logLevel').value = configData.system.logLevel || 'info';
                document.getElementById('cacheTTL').value = configData.system.cacheTTL || 300;
                document.getElementById('debugMode').checked = configData.system.debugMode || false;
            }
            
            // Populate Visualization form
            if (configData.visualization) {
                document.getElementById('defaultEngine').value = configData.visualization.defaultEngine || 'client';
                document.getElementById('chartTheme').value = configData.visualization.chartTheme || 'light';
                document.getElementById('autoRefresh').checked = configData.visualization.autoRefresh !== false;
                document.getElementById('showExtendedViews').checked = configData.visualization.showExtendedViews || false;
            }
            
            // Populate Security form
            if (configData.security) {
                document.getElementById('enableRateLimiting').checked = configData.security.enableRateLimiting !== false;
                document.getElementById('maxRequestsPerMinute').value = configData.security.maxRequestsPerMinute || 100;
                document.getElementById('enableIPBlocking').checked = configData.security.enableIPBlocking || false;
            }
            
            // Set JSON view
            elements.configJson.value = JSON.stringify(configData, null, 2);
            
            updateStatus('connected', 'Configuration loaded');
            showStatus('info', 'Configuration loaded successfully');
        } else {
            throw new Error(result.error || 'Unknown error loading configuration');
        }
    } catch (error) {
        console.error('Error loading configuration:', error);
        updateStatus('error', 'Failed to load configuration');
        showStatus('danger', `Error: ${error.message}`);
    }
}

/**
 * Save all configuration sections
 */
async function saveAllConfig() {
    updateStatus('loading', 'Saving all configuration...');
    
    try {
        const sections = ['thingspeak', 'dataSources', 'system', 'visualization', 'security'];
        let hasErrors = false;
        
        for (const section of sections) {
            const result = await saveSectionConfig(section, false);
            if (!result) hasErrors = true;
        }
        
        if (hasErrors) {
            throw new Error('One or more sections failed to update');
        }
        
        // Reload configuration
        await loadConfig();
        showStatus('success', 'All configuration saved successfully');
    } catch (error) {
        console.error('Error saving configuration:', error);
        updateStatus('error', 'Failed to save configuration');
        showStatus('danger', `Error: ${error.message}`);
    }
}

/**
 * Save a specific configuration section
 * @param {string} section - Section name
 * @param {boolean} showMessage - Whether to show status message
 * @returns {Promise<boolean>} Success status
 */
async function saveSectionConfig(section, showMessage = true) {
    if (!elements.forms[section]) {
        console.error(`Form not found for section: ${section}`);
        return false;
    }
    
    try {
        let sectionData = {};
        
        // Gather form data based on section
        const form = elements.forms[section];
        const formElements = form.elements;
        
        for (let i = 0; i < formElements.length; i++) {
            const element = formElements[i];
            if (!element.name) continue;
            
            // Handle different input types
            if (element.type === 'checkbox') {
                sectionData[element.name] = element.checked;
            } else if (element.type === 'number') {
                sectionData[element.name] = parseInt(element.value, 10) || 0;
            } else {
                sectionData[element.name] = element.value;
            }
        }
        
        // Save section
        const response = await fetch('/api/config/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                section: section,
                updates: sectionData
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Unknown error updating configuration');
        }
        
        if (showMessage) {
            showStatus('success', `${section} configuration saved successfully`);
        }
        
        return true;
    } catch (error) {
        console.error(`Error saving ${section} configuration:`, error);
        if (showMessage) {
            showStatus('danger', `Error saving ${section} configuration: ${error.message}`);
        }
        return false;
    }
}

/**
 * Reset configuration to defaults
 */
async function resetConfig() {
    updateStatus('loading', 'Resetting configuration...');
    
    try {
        const response = await fetch('/api/config/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset configuration');
        }
        
        const result = await response.json();
        if (result.success) {
            await loadConfig();
            showStatus('success', 'Configuration reset to defaults');
        } else {
            throw new Error(result.error || 'Unknown error resetting configuration');
        }
    } catch (error) {
        console.error('Error resetting configuration:', error);
        updateStatus('error', 'Failed to reset configuration');
        showStatus('danger', `Error: ${error.message}`);
    }
}

/**
 * Export configuration to JSON
 */
async function exportConfig() {
    updateStatus('loading', 'Exporting configuration...');
    
    try {
        const response = await fetch('/api/config/export');
        if (!response.ok) {
            throw new Error('Failed to export configuration');
        }
        
        const result = await response.json();
        if (result.success) {
            elements.configJson.value = result.data;
            
            // Trigger download
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(result.data);
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "air-quality-config.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
            
            updateStatus('connected', 'Configuration exported');
            showStatus('success', 'Configuration exported successfully');
        } else {
            throw new Error(result.error || 'Unknown error exporting configuration');
        }
    } catch (error) {
        console.error('Error exporting configuration:', error);
        updateStatus('error', 'Failed to export configuration');
        showStatus('danger', `Error: ${error.message}`);
    }
}

/**
 * Import configuration from JSON
 */
async function importConfig() {
    updateStatus('loading', 'Importing configuration...');
    
    try {
        const configStr = elements.importConfigText.value.trim();
        if (!configStr) {
            throw new Error('No configuration provided');
        }
        
        // Validate JSON
        try {
            JSON.parse(configStr);
        } catch (e) {
            throw new Error('Invalid JSON format');
        }
        
        const response = await fetch('/api/config/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: configStr })
        });
        
        if (!response.ok) {
            throw new Error('Failed to import configuration');
        }
        
        const result = await response.json();
        if (result.success) {
            elements.importConfigText.value = '';
            await loadConfig();
            showStatus('success', 'Configuration imported successfully');
        } else {
            throw new Error(result.error || 'Unknown error importing configuration');
        }
    } catch (error) {
        console.error('Error importing configuration:', error);
        updateStatus('error', 'Failed to import configuration');
        showStatus('danger', `Error: ${error.message}`);
    }
}

/**
 * Apply configuration from JSON textarea
 */
async function applyJsonConfig() {
    try {
        const configStr = elements.configJson.value.trim();
        if (!configStr) {
            throw new Error('No configuration provided');
        }
        
        // Validate JSON
        try {
            JSON.parse(configStr);
        } catch (e) {
            throw new Error('Invalid JSON format');
        }
        
        updateStatus('loading', 'Applying configuration...');
        
        const response = await fetch('/api/config/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: configStr })
        });
        
        if (!response.ok) {
            throw new Error('Failed to apply configuration');
        }
        
        const result = await response.json();
        if (result.success) {
            await loadConfig();
            showStatus('success', 'Configuration applied successfully');
        } else {
            throw new Error(result.error || 'Unknown error applying configuration');
        }
    } catch (error) {
        console.error('Error applying configuration:', error);
        updateStatus('error', 'Failed to apply configuration');
        showStatus('danger', `Error: ${error.message}`);
    }
}

/**
 * Copy JSON configuration to clipboard
 */
function copyJsonToClipboard() {
    elements.configJson.select();
    document.execCommand('copy');
    showStatus('info', 'Configuration copied to clipboard');
}

/**
 * Toggle password field visibility
 */
function togglePasswordVisibility() {
    const writeApiKeyInput = document.getElementById('writeApiKey');
    const toggleBtn = elements.toggleWriteKey;
    
    if (writeApiKeyInput.type === 'password') {
        writeApiKeyInput.type = 'text';
        toggleBtn.innerHTML = '<i class="bi bi-eye-slash"></i>';
    } else {
        writeApiKeyInput.type = 'password';
        toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
    }
}

/**
 * Clear all data including cache and temporary files
 */
async function clearAllData() {
    updateStatus('loading', 'Clearing all data...');
    
    try {
        const response = await fetch('/api/clear-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
            throw new Error('Failed to clear data');
        }
        
        const result = await response.json();
        if (result.success) {
            showStatus('success', `All data cleared successfully. ${result.message || ''}`);
        } else {
            throw new Error(result.error || 'Unknown error clearing data');
        }
    } catch (error) {
        console.error('Error clearing data:', error);
        updateStatus('error', 'Failed to clear data');
        showStatus('danger', `Error: ${error.message}`);
    } finally {
        updateStatus('connected', 'Operation complete');
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
 * Show status message
 */
function showStatus(type, message) {
    elements.configStatus.className = `alert alert-${type}`;
    elements.configStatusMsg.textContent = message;
    elements.configStatus.classList.remove('d-none');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        elements.configStatus.classList.add('d-none');
    }, 5000);
}

/**
 * Toggle between light and dark theme
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
}

/**
 * Load theme preference from localStorage
 */
function loadThemePreference() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const themeIcon = elements.toggleTheme.querySelector('i');
        themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    }
}
