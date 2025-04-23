/**
 * Generate sample data for diagnostics and testing
 */

/**
 * Generate sample air quality data
 * @param {number} count - Number of records to generate
 * @returns {Array} Sample data array
 */
function generateSampleAirQualityData(count = 50) {
  const data = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    // Generate timestamp starting from the past
    const timestamp = new Date(now - (count - i) * 30 * 60 * 1000);
    
    // Generate reasonable values with some fluctuation
    const pm25Base = 15 + Math.sin(i / 5) * 10;
    const pm10Base = 30 + Math.sin(i / 4) * 15;
    const tempBase = 22 + Math.sin(i / 8) * 3;
    const humidityBase = 50 + Math.sin(i / 6) * 15;
    
    data.push({
      entry_id: i + 1,
      created_at: timestamp.toISOString(),
      field1: (humidityBase + Math.random() * 2).toFixed(1), // Humidity
      field2: (tempBase + Math.random() * 0.5).toFixed(1),   // Temperature
      field3: (pm25Base + Math.random() * 3).toFixed(1),     // PM2.5
      field4: (pm10Base + Math.random() * 5).toFixed(1),     // PM10
      
      // Also add mapped fields for easier access
      humidity: (humidityBase + Math.random() * 2).toFixed(1),
      temperature: (tempBase + Math.random() * 0.5).toFixed(1),
      pm25: (pm25Base + Math.random() * 3).toFixed(1),
      pm10: (pm10Base + Math.random() * 5).toFixed(1)
    });
  }
  
  return data;
}

/**
 * Generate sample log entries for diagnostics
 * @param {string} type - Type of log ('error', 'access', 'api')
 * @param {number} count - Number of entries to generate
 * @returns {Array} Sample log entries
 */
function generateSampleLogs(type, count = 20) {
  const logs = [];
  const now = Date.now();
  
  switch (type) {
    case 'error':
      for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - i * 3600000 * Math.random()).toISOString();
        const contexts = ['thingspeak-service', 'data-validator', 'server', 'api'];
        const context = contexts[Math.floor(Math.random() * contexts.length)];
        
        const errorTypes = [
          'Connection refused',
          'API key invalid',
          'Timeout exceeded',
          'Invalid data format',
          'File not found'
        ];
        const message = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        
        logs.push({
          timestamp,
          id: `ERR-${Date.now().toString(36)}-${i}`,
          context,
          message,
          level: 'error'
        });
      }
      break;
      
    case 'access':
      for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - i * 1800000 * Math.random()).toISOString();
        const methods = ['GET', 'POST', 'PUT', 'DELETE'];
        const method = methods[Math.floor(Math.random() * methods.length)];
        
        const paths = [
          '/',
          '/api/data',
          '/api/thingspeak',
          '/config',
          '/status'
        ];
        const path = paths[Math.floor(Math.random() * paths.length)];
        
        const statuses = [200, 200, 200, 200, 404, 500];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const responseTime = Math.floor(Math.random() * 500);
        
        logs.push({
          timestamp,
          method,
          path,
          status,
          responseTime
        });
      }
      break;
      
    case 'api':
      for (let i = 0; i < count; i++) {
        const timestamp = new Date(now - i * 2400000 * Math.random()).toISOString();
        
        const endpoints = [
          'thingspeak/data',
          'thingspeak/channel',
          'local/data',
          'csv/upload',
          'analysis/stats'
        ];
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        
        const statuses = [200, 200, 200, 200, 404, 500];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        
        const success = status >= 200 && status < 300;
        const responseTime = Math.floor(Math.random() * 1000);
        const responseSize = Math.floor(Math.random() * 100000);
        
        logs.push({
          timestamp,
          endpoint,
          message: success ? 'Request successful' : 'Request failed',
          status,
          success,
          responseTime,
          responseSize
        });
      }
      break;
  }
  
  return logs;
}

module.exports = {
  generateSampleAirQualityData,
  generateSampleLogs
};
