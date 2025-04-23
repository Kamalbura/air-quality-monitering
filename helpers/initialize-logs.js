/**
 * Initialize log directories and files
 */
const fs = require('fs');
const path = require('path');

// Define log files
const LOG_FILES = {
  error: 'error.log',
  access: 'access.log',
  api: 'api.log'
};

// Create logs directory if it doesn't exist
function initializeLogs() {
  const logDir = path.join(__dirname, '..', 'logs');
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      console.log('Created logs directory');
    } catch (err) {
      console.error(`Error creating logs directory: ${err.message}`);
      return false;
    }
  }
  
  // Create or ensure empty log files exist
  for (const [key, filename] of Object.entries(LOG_FILES)) {
    const filepath = path.join(logDir, filename);
    
    try {
      // If file doesn't exist, create it
      if (!fs.existsSync(filepath)) {
        fs.writeFileSync(filepath, `# ${key.toUpperCase()} LOGS\n# Created ${new Date().toISOString()}\n\n`);
        console.log(`Created ${filename}`);
      }
    } catch (err) {
      console.error(`Error creating ${filename}: ${err.message}`);
    }
  }
  
  return true;
}

// Call initialization
initializeLogs();

module.exports = { LOG_FILES, initializeLogs };
