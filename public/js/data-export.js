/**
 * Data Export Module for Air Quality Dashboard
 * Provides functionality to export data in various formats
 */

// Use IIFE to avoid polluting global scope
const DataExport = (function() {
  /**
   * Export data to CSV format
   * @param {Array} data - The data to export
   * @param {string} filename - Optional filename (default: air_quality_data_DATE.csv)
   */
  function exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      showExportToast('No data available to export', 'warning');
      return;
    }
    
    // Generate filename if not provided
    if (!filename) {
      filename = `air_quality_data_${new Date().toISOString().split('T')[0]}.csv`;
    }
    
    // Convert data to CSV
    const csvContent = convertToCSV(data);
    
    // Create download link
    downloadFile(csvContent, filename, 'text/csv');
    showExportToast('CSV export complete', 'success');
  }
  
  /**
   * Export data to JSON format
   * @param {Array|Object} data - The data to export
   * @param {string} filename - Optional filename (default: air_quality_data_DATE.json)
   */
  function exportToJSON(data, filename) {
    if (!data) {
      showExportToast('No data available to export', 'warning');
      return;
    }
    
    // Generate filename if not provided
    if (!filename) {
      filename = `air_quality_data_${new Date().toISOString().split('T')[0]}.json`;
    }
    
    // Convert to JSON string with pretty formatting
    const jsonContent = JSON.stringify(data, null, 2);
    
    // Create download link
    downloadFile(jsonContent, filename, 'application/json');
    showExportToast('JSON export complete', 'success');
  }
  
  /**
   * Export current visualization as image
   * @param {HTMLCanvasElement} canvas - The canvas element containing the visualization
   * @param {string} filename - Optional filename (default: air_quality_viz_DATE.png)
   */
  function exportVisualization(canvas, filename) {
    if (!canvas) {
      showExportToast('No visualization available to export', 'warning');
      return;
    }
    
    // Generate filename if not provided
    if (!filename) {
      filename = `air_quality_viz_${new Date().toISOString().split('T')[0]}.png`;
    }
    
    try {
      // Convert canvas to data URL
      const dataURL = canvas.toDataURL('image/png');
      
      // For browsers that support direct download
      if (navigator.msSaveBlob) {
        // IE and Edge support
        const blob = dataURLToBlob(dataURL);
        navigator.msSaveBlob(blob, filename);
      } else {
        // Create an anchor and trigger download
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      
      showExportToast('Visualization exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting visualization:', error);
      showExportToast('Failed to export visualization', 'error');
    }
  }
  
  /**
   * Generate PDF report with data and visualizations
   * @param {Object} options - Report options 
   */
  function generatePDFReport(options = {}) {
    const { data, statistics, title, description, includeVisualization } = options;
    
    if (!data || data.length === 0) {
      showExportToast('No data available for report', 'warning');
      return;
    }
    
    // Open a new window for the printable report
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showExportToast('Unable to open print window. Check popup blocker settings.', 'error');
      return;
    }
    
    // Generate statistics if not provided
    const stats = statistics || calculateBasicStats(data);
    
    // Build HTML content with Bootstrap styling
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title || 'Air Quality Report'}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.3/dist/css/bootstrap.min.css">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
          .stats-card { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
          .stats-value { font-size: 24px; font-weight: bold; color: #007bff; }
          .page-break { page-break-before: always; }
          table { width: 100%; margin-bottom: 20px; }
          @media print {
            .no-print { display: none; }
            a { text-decoration: none; color: #000; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="no-print text-center mb-4">
            <button class="btn btn-primary" onclick="window.print()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-printer" viewBox="0 0 16 16">
                <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
                <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
              </svg>
              Print Report
            </button>
          </div>
          
          <div class="row mb-4">
            <div class="col">
              <h1>${title || 'Air Quality Monitoring Report'}</h1>
              <p class="text-muted">Generated on ${new Date().toLocaleString()}</p>
              ${description ? `<p>${description}</p>` : ''}
            </div>
          </div>
          
          <div class="row mb-4">
            <div class="col">
              <h2>Air Quality Summary</h2>
              <div class="stats-grid">
                <div class="stats-card">
                  <div class="stats-label">Average PM2.5</div>
                  <div class="stats-value">${stats.avgPM25?.toFixed(2) || 'N/A'}</div>
                  <div class="stats-unit">μg/m³</div>
                </div>
                <div class="stats-card">
                  <div class="stats-label">Average PM10</div>
                  <div class="stats-value">${stats.avgPM10?.toFixed(2) || 'N/A'}</div>
                  <div class="stats-unit">μg/m³</div>
                </div>
                <div class="stats-card">
                  <div class="stats-label">Peak PM2.5</div>
                  <div class="stats-value">${stats.maxPM25?.toFixed(2) || 'N/A'}</div>
                  <div class="stats-unit">μg/m³</div>
                </div>
                <div class="stats-card">
                  <div class="stats-label">Peak PM10</div>
                  <div class="stats-value">${stats.maxPM10?.toFixed(2) || 'N/A'}</div>
                  <div class="stats-unit">μg/m³</div>
                </div>
              </div>
            </div>
          </div>
    `);
    
    // Add visualization if requested
    if (includeVisualization && window.Chart) {
      printWindow.document.write(`
        <div class="row mb-4">
          <div class="col">
            <h2>Visualization</h2>
            <div>
              <img src="${document.getElementById('visualization-canvas').toDataURL('image/png')}" 
                   alt="Air Quality Visualization" class="img-fluid border">
            </div>
          </div>
        </div>
      `);
    }
    
    // Add data table (limited to 100 rows for readability)
    const dataToShow = data.slice(0, 100);
    printWindow.document.write(`
      <div class="row mb-4${includeVisualization ? ' page-break' : ''}">
        <div class="col">
          <h2>Data Records</h2>
          <p>Showing ${dataToShow.length} of ${data.length} records</p>
          <div class="table-responsive">
            <table class="table table-striped table-sm">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>PM2.5 (μg/m³)</th>
                  <th>PM10 (μg/m³)</th>
                  <th>Temperature (°C)</th>
                  <th>Humidity (%)</th>
                </tr>
              </thead>
              <tbody>
    `);
    
    // Add table rows
    dataToShow.forEach(item => {
      const timestamp = new Date(item.created_at).toLocaleString();
      const pm25 = parseFloat(item.pm25 || item.field3).toFixed(2);
      const pm10 = parseFloat(item.pm10 || item.field4).toFixed(2);
      const temp = parseFloat(item.temperature || item.field2).toFixed(2);
      const humidity = parseFloat(item.humidity || item.field1).toFixed(2);
      
      printWindow.document.write(`
        <tr>
          <td>${timestamp}</td>
          <td>${pm25}</td>
          <td>${pm10}</td>
          <td>${temp}</td>
          <td>${humidity}</td>
        </tr>
      `);
    });
    
    // Close the table and document
    printWindow.document.write(`
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <footer class="mt-5 pt-3 border-top">
        <p class="text-muted small">
          Air Quality Monitoring System | Report generated on ${new Date().toLocaleString()}
        </p>
      </footer>
      </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    showExportToast('Report generated successfully', 'success');
  }
  
  /* Helper functions */
  
  /**
   * Convert data array to CSV format
   * @param {Array} data - Array of data objects
   * @returns {string} - CSV formatted string
   */
  function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    // Get headers from first object
    const headers = Object.keys(data[0]);
    
    // Create CSV header row
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        
        // Handle special cases (strings with commas, nulls, etc.)
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          // Escape quotes and wrap in quotes
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      
      csvContent += row.join(',') + '\n';
    });
    
    return csvContent;
  }
  
  /**
   * Download a file with the given content
   * @param {string} content - File content
   * @param {string} filename - File name
   * @param {string} contentType - MIME type
   */
  function downloadFile(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  /**
   * Convert data URL to Blob (for IE support)
   * @param {string} dataURL - Data URL string
   * @returns {Blob} - Blob object
   */
  function dataURLToBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
  }
  
  /**
   * Calculate basic statistics from data
   * @param {Array} data - The data array
   * @returns {Object} - Object with basic statistics
   */
  function calculateBasicStats(data) {
    if (!data || data.length === 0) {
      return {
        avgPM25: 0,
        avgPM10: 0,
        maxPM25: 0,
        maxPM10: 0,
        count: 0
      };
    }
    
    // Extract values
    const pm25Values = data.map(item => parseFloat(item.pm25 || item.field3)).filter(val => !isNaN(val));
    const pm10Values = data.map(item => parseFloat(item.pm10 || item.field4)).filter(val => !isNaN(val));
    
    // Calculate averages
    const avgPM25 = pm25Values.length > 0 
      ? pm25Values.reduce((sum, val) => sum + val, 0) / pm25Values.length
      : 0;
      
    const avgPM10 = pm10Values.length > 0
      ? pm10Values.reduce((sum, val) => sum + val, 0) / pm10Values.length
      : 0;
      
    // Calculate max values
    const maxPM25 = pm25Values.length > 0 ? Math.max(...pm25Values) : 0;
    const maxPM10 = pm10Values.length > 0 ? Math.max(...pm10Values) : 0;
    
    return {
      avgPM25,
      avgPM10,
      maxPM25,
      maxPM10,
      count: data.length
    };
  }
  
  /**
   * Show toast notification for export operations
   * @param {string} message - Message to display
   * @param {string} type - Type of toast (success, warning, error)
   */
  function showExportToast(message, type = 'info') {
    // Try to use the dashboard's toast function if available
    if (typeof showToast === 'function') {
      showToast(message, type);
      return;
    }
    
    // Simple fallback alert if toast function isn't available
    alert(message);
  }
  
  // Public API
  return {
    toCSV: exportToCSV,
    toJSON: exportToJSON,
    visualization: exportVisualization,
    generatePDFReport: generatePDFReport
  };
})();

// Make available globally
window.DataExport = DataExport;
