/**
 * ThingSpeak Configuration Manager
 * Handles configuration settings for ThingSpeak API access
 */

const ThingSpeakConfig = (function() {
    // Private configuration storage
    let config = {
        channelId: null,
        readApiKey: null,
        writeApiKey: null,
        updateInterval: 30000,
        fields: {
            humidity: 'field1',
            temperature: 'field2',
            pm25: 'field3',
            pm10: 'field4'
        }
    };
    
    // Event listeners for config changes
    const listeners = [];
    
    /**
     * Initialize configuration from server
     * @returns {Promise<Object>} The loaded configuration
     */
    async function init() {
        try {
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`Failed to fetch configuration: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success && result.data && result.data.thingspeak) {
                config = { 
                    ...config, 
                    ...result.data.thingspeak 
                };
                
                // Notify listeners
                notifyListeners();
                return config;
            } else {
                console.warn('No ThingSpeak configuration found in server response');
                return config;
            }
        } catch (error) {
            console.error('Error loading ThingSpeak configuration:', error);
            return config;
        }
    }
    
    /**
     * Get current configuration
     * @returns {Object} Current configuration
     */
    function getConfig() {
        return {...config};
    }
    
    /**
     * Update configuration
     * @param {Object} newConfig - New configuration values
     * @returns {Promise<boolean>} Success status
     */
    async function updateConfig(newConfig) {
        try {
            const response = await fetch('/api/thingspeak/update-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newConfig)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update configuration: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Update local config
                config = { ...config, ...newConfig };
                
                // Notify listeners
                notifyListeners();
                return true;
            } else {
                console.error('Failed to update ThingSpeak configuration:', result.error);
                return false;
            }
        } catch (error) {
            console.error('Error updating ThingSpeak configuration:', error);
            return false;
        }
    }
    
    /**
     * Add a configuration change listener
     * @param {function} callback - Function to call when config changes
     */
    function addChangeListener(callback) {
        if (typeof callback === 'function' && !listeners.includes(callback)) {
            listeners.push(callback);
        }
    }
    
    /**
     * Remove a configuration change listener
     * @param {function} callback - Listener to remove
     */
    function removeChangeListener(callback) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
            listeners.splice(index, 1);
        }
    }
    
    /**
     * Notify all listeners of configuration change
     */
    function notifyListeners() {
        listeners.forEach(listener => {
            try {
                listener(config);
            } catch (error) {
                console.error('Error in ThingSpeak config change listener:', error);
            }
        });
    }
    
    // Initialize on load
    init().catch(error => console.error('Failed to initialize ThingSpeak config:', error));
    
    // Public API
    return {
        init,
        getConfig,
        updateConfig,
        addChangeListener,
        removeChangeListener
    };
})();
