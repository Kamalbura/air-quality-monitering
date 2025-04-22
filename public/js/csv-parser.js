/**
 * CSV Parser Helper for Client-Side Visualizations
 * Efficiently processes CSV data directly in the browser
 */
(function() {
  /**
   * Parse a CSV string into an array of objects
   * @param {string} csvText - Raw CSV text
   * @param {Object} options - Parsing options
   * @returns {Array} Array of data objects
   */
  function parseCSV(csvText, options = {}) {
    // Default options
    const settings = {
      delimiter: options.delimiter || ',',
      header: options.header !== false,
      skipEmptyLines: options.skipEmptyLines !== false,
      transformHeader: options.transformHeader || (header => header),
      transform: options.transform || (value => value)
    };

    if (!csvText || typeof csvText !== 'string') {
      console.error('Invalid CSV text provided');
      return [];
    }

    // Split by line breaks (handle different OS line endings)
    const lines = csvText.split(/\r?\n/);
    if (lines.length === 0) return [];

    // Parse headers if present
    let headers = [];
    let startIndex = 0;

    if (settings.header) {
      headers = lines[0].split(settings.delimiter)
        .map(h => h.trim())
        .map(settings.transformHeader);
      startIndex = 1;
    }

    // Process data rows
    const results = [];
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line && settings.skipEmptyLines) continue;
      
      const values = line.split(settings.delimiter).map(v => v.trim());
      
      if (settings.header) {
        // Create object mapping headers to values
        const row = {};
        for (let j = 0; j < headers.length; j++) {
          if (j < values.length) {
            row[headers[j]] = settings.transform(values[j], headers[j], i);
          } else {
            row[headers[j]] = null; // Missing values
          }
        }
        results.push(row);
      } else {
        // Just add the array of values
        results.push(values.map(settings.transform));
      }
    }

    return results;
  }

  /**
   * Fetch and parse a CSV file
   * @param {string} url - URL of the CSV file
   * @param {Object} options - Parsing options
   * @returns {Promise<Array>} Promise resolving to array of data objects
   */
  function fetchCSV(url, options = {}) {
    return fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.text();
      })
      .then(text => parseCSV(text, options))
      .catch(error => {
        console.error('Error fetching or parsing CSV:', error);
        return [];
      });
  }

  /**
   * Process air quality CSV data with standard field mapping
   * @param {Array} data - Raw CSV data
   * @returns {Array} Processed data with consistent field names
   */
  function processAirQualityData(data) {
    if (!Array.isArray(data)) {
      console.error('Invalid data format: not an array');
      return [];
    }

    return data.map(item => {
      // Try to parse date
      let dateObj = null;
      try {
        dateObj = new Date(item.created_at);
        // Check if date is valid
        if (isNaN(dateObj.getTime())) dateObj = null;
      } catch (e) {
        console.warn('Invalid date:', item.created_at);
      }

      return {
        created_at: item.created_at,
        date: dateObj,
        entry_id: parseInt(item.entry_id) || 0,
        humidity: parseFloat(item.humidity || item.field1) || null,
        temperature: parseFloat(item.temperature || item.field2) || null,
        pm25: parseFloat(item.pm25 || item.field3) || null,
        pm10: parseFloat(item.pm10 || item.field4) || null,
        field1: parseFloat(item.field1 || item.humidity) || null,
        field2: parseFloat(item.field2 || item.temperature) || null,
        field3: parseFloat(item.field3 || item.pm25) || null,
        field4: parseFloat(item.field4 || item.pm10) || null
      };
    });
  }

  // Export the functions to the global scope
  window.CSVParser = {
    parse: parseCSV,
    fetch: fetchCSV,
    processAirQualityData: processAirQualityData
  };
})();
