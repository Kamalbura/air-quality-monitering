/**
 * Air Quality Monitoring System - Connection Checker
 * Simplified connection status wrapper for backward compatibility
 * Uses the centralized ConnectionStatusManager
 */

// For backward compatibility with older code that might reference these functions
function updateStatus(status, message) {
    ConnectionStatusManager.updateStatus(status, message);
}

function checkConnection() {
    return ConnectionStatusManager.checkConnection();
}

// Initialize connection status functionality - this happens automatically in ConnectionStatusManager
// Left here for backward compatibility in case it's called explicitly
function initConnectionChecker() {
    // Nothing to do here, ConnectionStatusManager.init() is called automatically
}
