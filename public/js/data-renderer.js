/**
 * Data Renderer
 * Handles rendering data tables and charts for air quality data
 */

class DataRenderer {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '';
    this.charts = {};
    this.cachedData = null;
    this.isClientMode = options.clientMode || false;
  }
  
  /**
   * Get data from API or local file
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Data array
   */
  async getData(options = {}) {
    try {
      if (this.isClientMode) {
        // Client-side mode: Load CSV directly from the data directory
        const csvData = await CSVParser.loadCSVFromURL('/data/feeds.csv');
        const normalizedData = CSVParser.normalizeAirQualityData(csvData);
        
        // Filter by date if specified
        if (options.startDate || options.endDate) {
          const startDate = options.startDate ? new Date(options.startDate) : new Date(0);
          const endDate = options.endDate ? new Date(options.endDate) : new Date();
          
          return normalizedData.filter(item => {
            const itemDate = new Date(item.created_at);
            return itemDate >= startDate && itemDate <= endDate;
          });
        }
        
        return normalizedData;
      } else {
        // Server-side mode: Use API
        let url = `${this.baseUrl}/api/data/recent`;
        
        // Add query parameters if specified
        if (options.days) {
          url += `?days=${options.days}`;
        }
        
        if (options.limit) {
          url += `${options.days ? '&' : '?'}limit=${options.limit}`;
        }
        
        if (options.startDate) {
          url += `${url.includes('?') ? '&' : '?'}startDate=${options.startDate}`;
        }
        
        if (options.endDate) {
          url += `${url.includes('?') ? '&' : '?'}endDate=${options.endDate}`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      this.showError(`Failed to fetch data: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get statistics from API
   * @param {Object} options - Filter options
   * @returns {Promise<Object>} Statistics object
   */
  async getStats(options = {}) {
    try {
      if (this.isClientMode) {
        // Calculate statistics client-side
        const data = await this.getData(options);
        return this.calculateStatistics(data);
      } else {
        // Get statistics from API
        let url = `${this.baseUrl}/api/data/stats`;
        
        // Add query parameters if specified
        if (options.startDate) {
          url += `?startDate=${options.startDate}`;
        }
        
        if (options.endDate) {
          url += `${url.includes('?') ? '&' : '?'}endDate=${options.endDate}`;
        }
        
        if (options.extended) {
          url += `${url.includes('?') ? '&' : '?'}extended=true`;
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        return await response.json();
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      this.showError(`Failed to fetch statistics: ${error.message}`);
      return {};
    }
  }
  
  /**
   * Calculate basic statistics from data (for client-side mode)
   * @param {Array} data - Data array
   * @returns {Object} Statistics object
   */
  calculateStatistics(data) {
    if (!data || data.length === 0) {
      return {
        average_pm25: 0,
        average_pm10: 0,
        average_temperature: 0,
        average_humidity: 0,
        max_pm25: 0,
        max_pm10: 0,
        min_pm25: 0,
        min_pm10: 0,
        count: 0,
        source: 'client-calculated'
      };
    }
    
    // Extract numeric values for each measurement
    const pm25Values = data.map(item => parseFloat(item.pm25 || item.field3))
                           .filter(val => !isNaN(val) && val !== null);
                           
    const pm10Values = data.map(item => parseFloat(item.pm10 || item.field4))
                           .filter(val => !isNaN(val) && val !== null);
                           
    const tempValues = data.map(item => parseFloat(item.temperature || item.field2))
                           .filter(val => !isNaN(val) && val !== null);
                           
    const humidityValues = data.map(item => parseFloat(item.humidity || item.field1))
                                .filter(val => !isNaN(val) && val !== null);

    // Calculate means
    const average = arr => arr.length === 0 ? 0 : arr.reduce((sum, val) => sum + val, 0) / arr.length;
    
    // Calculate min/max
    const max = arr => arr.length === 0 ? 0 : Math.max(...arr);
    const min = arr => arr.length === 0 ? 0 : Math.min(...arr);
    
    return {
      average_pm25: average(pm25Values),
      average_pm10: average(pm10Values),
      average_temperature: average(tempValues),
      average_humidity: average(humidityValues),
      max_pm25: max(pm25Values),
      max_pm10: max(pm10Values),
      min_pm25: min(pm25Values),
      min_pm10: min(pm10Values),
      count: data.length,
      source: 'client-calculated'
    };
  }
  
  /**
   * Render data table
   * @param {string} tableId - Table element ID
   * @param {Array} data - Data array
   */
  renderDataTable(tableId, data, options = {}) {
    const tableBody = document.getElementById(tableId);
    if (!tableBody) {
      console.error(`Table body element not found: ${tableId}`);
      return;
    }
    
    if (!data || data.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
      return;
    }
    
    // Pagination settings
    const pageSize = options.pageSize || 10;
    const currentPage = options.currentPage || 0;
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const pagedData = data.slice(start, end);
    
    // Clear existing rows
    tableBody.innerHTML = '';
    
    // Add new rows
    pagedData.forEach(item => {
      const row = document.createElement('tr');
      
      // Format date
      const date = new Date(item.created_at);
      const formattedDate = isNaN(date.getTime()) ? 'Invalid Date' : 
                            date.toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            });
      
      // Create cells
      row.innerHTML = `
        <td>${formattedDate}</td>
        <td>${this.formatValue(item.pm25 || item.field3)}</td>
        <td>${this.formatValue(item.pm10 || item.field4)}</td>
        <td>${this.formatValue(item.temperature || item.field2)}</td>
        <td>${this.formatValue(item.humidity || item.field1)}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
    // Update pagination info
    if (options.infoElementId) {
      const infoElement = document.getElementById(options.infoElementId);
      if (infoElement) {
        infoElement.textContent = `Showing ${start + 1}-${Math.min(end, data.length)} of ${data.length} records`;
      }
    }
    
    // Update pagination buttons
    if (options.prevButtonId && options.nextButtonId) {
      const prevButton = document.getElementById(options.prevButtonId);
      const nextButton = document.getElementById(options.nextButtonId);
      
      if (prevButton) {
        prevButton.disabled = currentPage === 0;
      }
      
      if (nextButton) {
        nextButton.disabled = end >= data.length;
      }
    }
  }
  
  /**
   * Format a numeric value for display
   * @param {number|string} value - Value to format
   * @returns {string} Formatted value
   */
  formatValue(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(2);
  }
  
  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    toast.setAttribute('id', toastId);
    
    toast.innerHTML = `
      <div class="toast-header bg-danger text-white">
        <strong class="me-auto">Error</strong>
        <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${message}
      </div>
    `;
    
    toastContainer.appendChild(toast);
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Remove after hiding
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  }
}

// Make it available globally
window.DataRenderer = DataRenderer;
