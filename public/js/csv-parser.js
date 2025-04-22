/**
 * CSV Parser - Client-side utility to parse CSV data files
 */

class CSVParser {
  /**
   * Parse CSV data into an array of objects
   * @param {string} csvString - CSV data as string
   * @param {Object} options - Parsing options
   * @returns {Array} Array of objects representing CSV rows
   */
  static parseCSV(csvString, options = {}) {
    // Default options
    const defaultOptions = {
      delimiter: ',',
      headerRow: true,
      trimValues: true
    };
    
    const settings = { ...defaultOptions, ...options };
    
    try {
      // Split into rows
      const rows = csvString.split(/\r?\n/);
      
      // Get header row if applicable
      let headers = [];
      let startIndex = 0;
      
      if (settings.headerRow && rows.length > 0) {
        headers = this.parseRow(rows[0], settings.delimiter, settings.trimValues);
        startIndex = 1;
      }
      
      // Parse data rows
      const data = [];
      for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue; // Skip empty rows
        
        const values = this.parseRow(row, settings.delimiter, settings.trimValues);
        
        if (settings.headerRow) {
          // Convert to object using headers
          const obj = {};
          for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = j < values.length ? values[j] : '';
          }
          data.push(obj);
        } else {
          // Just use array of values
          data.push(values);
        }
      }
      
      return data;
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }
  
  /**
   * Parse a single CSV row into an array of values
   * @private
   */
  static parseRow(rowString, delimiter, trimValues) {
    const values = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < rowString.length; i++) {
      const char = rowString[i];
      const nextChar = i < rowString.length - 1 ? rowString[i + 1] : '';
      
      if (char === '"' && inQuotes && nextChar === '"') {
        // Escaped quote
        currentValue += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        // Toggle quote state
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        // End of value
        values.push(trimValues ? currentValue.trim() : currentValue);
        currentValue = '';
      } else {
        // Regular character
        currentValue += char;
      }
    }
    
    // Add the last value
    values.push(trimValues ? currentValue.trim() : currentValue);
    
    return values;
  }
  
  /**
   * Load CSV file from a URL and parse it
   * @param {string} url - URL to the CSV file
   * @returns {Promise<Array>} Parsed CSV data
   */
  static async loadCSVFromURL(url) {
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load CSV: ${response.status} ${response.statusText}`);
      }
      
      const csvText = await response.text();
      return this.parseCSV(csvText);
    } catch (error) {
      console.error('Error loading CSV file:', error);
      throw error;
    }
  }
  
  /**
   * Process AirQuality data from the CSV format to a normalized format
   * @param {Array} data - Parsed CSV data
   * @returns {Array} Normalized data objects
   */
  static normalizeAirQualityData(data) {
    return data.map(item => {
      // Handle both naming conventions in the CSV file
      return {
        created_at: item.created_at,
        entry_id: parseInt(item.entry_id) || 0,
        humidity: parseFloat(item.humidity || item.field1) || 0,
        temperature: parseFloat(item.temperature || item.field2) || 0,
        pm25: parseFloat(item.pm25 || item.field3) || 0,
        pm10: parseFloat(item.pm10 || item.field4) || 0,
        latitude: item.latitude,
        longitude: item.longitude,
        elevation: item.elevation,
        timestamp: new Date(item.created_at)
      };
    }).filter(item => !isNaN(item.timestamp.getTime())); // Filter out invalid dates
  }
}

// Make it available globally
window.CSVParser = CSVParser;
