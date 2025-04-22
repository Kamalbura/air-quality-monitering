/**
 * Enhanced data rendering functions for air quality dashboard
 */

/**
 * Render air quality data table with mapped fields
 * @param {Object} dataResponse - Data response from API
 */
function renderDataTable(dataResponse) {
  const tableBody = document.getElementById('data-table-body');
  if (!tableBody) {
    console.error('Table body element not found');
    return;
  }

  // Clear existing rows
  tableBody.innerHTML = '';
  
  // Check if we have data to render
  if (!dataResponse || !dataResponse.data || dataResponse.data.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center">No data available</td>
      </tr>
    `;
    return;
  }

  // Create table rows
  dataResponse.data.forEach(item => {
    // Map data fields to ensure consistency
    const mappedItem = mapDataFields(item);
    
    // Format date and time
    const dateTime = new Date(mappedItem.created_at);
    const formattedDate = dateTime.toLocaleDateString();
    const formattedTime = dateTime.toLocaleTimeString();
    
    // Calculate AQI
    const aqi = calculateAQI(mappedItem.pm25, mappedItem.pm10);
    const aqiClass = getAqiClass(aqi);

    // Create row HTML
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${formattedTime}</td>
      <td>${mappedItem.pm25}</td>
      <td>${mappedItem.pm10}</td>
      <td><span class="badge ${aqiClass}">${aqi}</span></td>
    `;
    
    tableBody.appendChild(row);
  });
  
  // Update data stats
  updateDataStatistics(dataResponse.data);
}

/**
 * Map data fields to ensure consistent structure
 * @param {Object} item - Data item
 * @returns {Object} - Mapped data item
 */
function mapDataFields(item) {
  return {
    created_at: item.created_at,
    pm25: parseFloat(item.pm25 || item.field3 || 0).toFixed(2),
    pm10: parseFloat(item.pm10 || item.field4 || 0).toFixed(2),
    temperature: parseFloat(item.temperature || item.field2 || 0).toFixed(2),
    humidity: parseFloat(item.humidity || item.field1 || 0).toFixed(2)
  };
}

/**
 * Get CSS class for AQI badge
 * @param {string} aqi - AQI category
 * @returns {string} - CSS class
 */
function getAqiClass(aqi) {
  switch (aqi) {
    case 'Good': return 'bg-success';
    case 'Fair': return 'bg-info';
    case 'Moderate': return 'bg-warning';
    case 'Poor': return 'bg-danger';
    case 'Very Poor': return 'bg-dark';
    default: return 'bg-secondary';
  }
}

/**
 * Update statistics from the loaded data
 * @param {Array} data - Array of data items
 */
function updateDataStatistics(data) {
  if (!data || data.length === 0) {
    return;
  }

  // Map all data to ensure consistent fields
  const mappedData = data.map(item => mapDataFields(item));
  
  // Calculate statistics
  const pm25Values = mappedData.map(item => parseFloat(item.pm25)).filter(val => !isNaN(val));
  const pm10Values = mappedData.map(item => parseFloat(item.pm10)).filter(val => !isNaN(val));
  
  // Only calculate if we have values
  if (pm25Values.length > 0) {
    const avgPM25 = pm25Values.reduce((sum, val) => sum + val, 0) / pm25Values.length;
    const maxPM25 = Math.max(...pm25Values);
    
    document.getElementById('avgPM25').textContent = avgPM25.toFixed(2);
    document.getElementById('maxPM25').textContent = maxPM25.toFixed(2);
  }
  
  if (pm10Values.length > 0) {
    const avgPM10 = pm10Values.reduce((sum, val) => sum + val, 0) / pm10Values.length;
    const maxPM10 = Math.max(...pm10Values);
    
    document.getElementById('avgPM10').textContent = avgPM10.toFixed(2);
    document.getElementById('maxPM10').textContent = maxPM10.toFixed(2);
  }
}
