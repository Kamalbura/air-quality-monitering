/**
 * Main Dashboard JavaScript
 * Controls the dashboard interface and data loading
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize dashboard
  const dashboard = new Dashboard();
  dashboard.init();
});

class Dashboard {
  constructor() {
    // State
    this.currentVizType = 'time_series';
    this.isClientMode = false; // Default to server-side mode
    this.dateRange = null;
    this.timeFilter = null;
    this.currentPage = 0;
    this.pageSize = 10;
    this.darkMode = false;
    
    // Initialize data renderer
    this.renderer = new DataRenderer({
      baseUrl: '',
      clientMode: this.isClientMode
    });
    
    // Fallback visualizations
    this.fallbackViz = new FallbackViz();
  }
  
  /**
   * Initialize the dashboard
   */
  init() {
    // Setup UI event listeners
    this.setupEventListeners();
    
    // Initialize date pickers
    this.initializeDatePickers();
    
    // Load initial data
    this.loadData();
    
    // Load initial visualization
    this.loadVisualization(this.currentVizType);
    
    // Check connection status
    this.checkConnection();
    
    // Apply saved theme if any
    this.loadThemePreference();
    
    // Check real-time data updates setting
    this.setupRealTimeUpdates();
  }
  
  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Visualization type links
    document.querySelectorAll('.viz-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const vizType = e.currentTarget.getAttribute('data-type');
        
        // Update active link
        document.querySelectorAll('.viz-link').forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Load visualization
        this.currentVizType = vizType;
        this.loadVisualization(vizType);
      });
    });
    
    // Toggle visualization mode (client/server)
    document.getElementById('toggleVizMode').addEventListener('click', () => {
      this.isClientMode = !this.isClientMode;
      document.getElementById('vizModeText').textContent = this.isClientMode ? 'Client-side' : 'Server-side';
      
      // Update renderer mode
      this.renderer.isClientMode = this.isClientMode;
      
      // Reload current visualization
      this.loadVisualization(this.currentVizType);
    });
    
    // Refresh visualization button
    document.getElementById('refreshViz').addEventListener('click', () => {
      this.loadVisualization(this.currentVizType);
    });
    
    // Extended visualization views
    document.getElementById('showExtendedViz').addEventListener('click', () => {
      this.toggleExtendedViews();
    });
    
    // Table refresh button
    document.getElementById('refreshTable').addEventListener('click', () => {
      this.loadData();
    });
    
    // Table pagination
    document.getElementById('prev-page').addEventListener('click', () => {
      if (this.currentPage > 0) {
        this.currentPage--;
        this.updateDataTable();
      }
    });
    
    document.getElementById('next-page').addEventListener('click', () => {
      this.currentPage++;
      this.updateDataTable();
    });
    
    // Apply date filter
    document.getElementById('applyDateFilter').addEventListener('click', () => {
      this.loadData();
      this.loadVisualization(this.currentVizType);
    });
    
    // Apply time filter
    document.getElementById('applyTimeFilter').addEventListener('click', () => {
      this.applyTimeFilter();
    });
    
    // Theme toggle
    document.getElementById('toggleTheme').addEventListener('click', () => {
      this.toggleDarkMode();
    });
    
    // Download data
    window.downloadData = () => {
      this.downloadData();
    };
  }
  
  /**
   * Initialize date pickers
   */
  initializeDatePickers() {
    // Date range picker
    flatpickr("#dateRange", {
      mode: "range",
      maxDate: "today",
      dateFormat: "Y-m-d",
      onClose: (selectedDates) => {
        if (selectedDates.length === 2) {
          this.dateRange = {
            startDate: selectedDates[0].toISOString().split('T')[0],
            endDate: selectedDates[1].toISOString().split('T')[0]
          };
        }
      }
    });
    
    // Time filter
    flatpickr("#timeFilter", {
      enableTime: true,
      noCalendar: true,
      dateFormat: "H:i",
      time_24hr: true,
      onClose: (selectedDates) => {
        if (selectedDates.length > 0) {
          const hours = selectedDates[0].getHours();
          const minutes = selectedDates[0].getMinutes();
          this.timeFilter = { hours, minutes };
        }
      }
    });
  }
  
  /**
   * Load data from API or CSV
   */
  async loadData() {
    try {
      // Show loading state
      document.getElementById('data-table-body').innerHTML = 
        '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Loading data...</td></tr>';
      
      // Prepare options
      const options = {};
      
      // Add date range if specified
      if (this.dateRange) {
        options.startDate = this.dateRange.startDate;
        options.endDate = this.dateRange.endDate;
      } else {
        // Default to last 7 days
        options.days = 7;
      }
      
      // Add limit
      options.limit = 1000; // Get more data for client-side processing
      
      // Fetch data
      this.data = await this.renderer.getData(options);
      
      // Apply time filter if specified
      if (this.timeFilter) {
        this.applyTimeFilter();
      } else {
        // Update table
        this.updateDataTable();
        
        // Update statistics
        this.updateStatistics();
      }
    } catch (error) {
      console.error('Error loading data:', error);
      document.getElementById('data-table-body').innerHTML = 
        `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
    }
  }
  
  /**
   * Update the data table with current data
   */
  updateDataTable() {
    if (!this.data) return;
    
    this.renderer.renderDataTable('data-table-body', this.data, {
      pageSize: this.pageSize,
      currentPage: this.currentPage,
      infoElementId: 'data-table-info',
      prevButtonId: 'prev-page',
      nextButtonId: 'next-page'
    });
  }
  
  /**
   * Apply time filter to the data
   */
  applyTimeFilter() {
    if (!this.data || !this.timeFilter) return;
    
    const filteredData = this.data.filter(item => {
      const date = new Date(item.created_at);
      return date.getHours() === this.timeFilter.hours && 
             date.getMinutes() === this.timeFilter.minutes;
    });
    
    // Update with filtered data
    this.filteredData = filteredData;
    
    // Reset pagination
    this.currentPage = 0;
    
    // Update table with filtered data
    this.renderer.renderDataTable('data-table-body', this.filteredData, {
      pageSize: this.pageSize,
      currentPage: this.currentPage,
      infoElementId: 'data-table-info',
      prevButtonId: 'prev-page',
      nextButtonId: 'next-page'
    });
    
    // Update statistics with filtered data
    this.updateStatistics(this.filteredData);
    
    // Update visualizations with filtered data
    if (this.isClientMode) {
      this.loadVisualization(this.currentVizType, this.filteredData);
    }
  }
  
  /**
   * Update statistics displays
   */
  async updateStatistics(dataToUse = null) {
    try {
      // Get statistics
      const dataSource = dataToUse || this.data;
      const stats = this.isClientMode ? 
                    this.renderer.calculateStatistics(dataSource) : 
                    await this.renderer.getStats(this.dateRange || {});
      
      // Update statistics cards
      document.getElementById('avgPM25').textContent = stats.average_pm25 ? stats.average_pm25.toFixed(2) : '0.00';
      document.getElementById('avgPM10').textContent = stats.average_pm10 ? stats.average_pm10.toFixed(2) : '0.00';
      document.getElementById('avgTemp').textContent = stats.average_temperature ? stats.average_temperature.toFixed(2) : '0.00';
      document.getElementById('avgHumidity').textContent = stats.average_humidity ? stats.average_humidity.toFixed(2) : '0.00';
      
      // Update peak and low values
      document.getElementById('peakPM25').textContent = stats.max_pm25 ? stats.max_pm25.toFixed(2) : '0.00';
      document.getElementById('peakPM10').textContent = stats.max_pm10 ? stats.max_pm10.toFixed(2) : '0.00';
      document.getElementById('lowPM25').textContent = stats.min_pm25 ? stats.min_pm25.toFixed(2) : '0.00';
      document.getElementById('lowPM10').textContent = stats.min_pm10 ? stats.min_pm10.toFixed(2) : '0.00';
      
      // Update data validation section
      this.updateDataValidation(stats);
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  }
  
  /**
   * Load visualization based on type
   */
  async loadVisualization(vizType, dataToUse = null) {
    // Update title
    document.getElementById('vizTitle').textContent = this.getVizTitle(vizType);
    
    // Show loading state
    document.getElementById('visualization-container').innerHTML = `
      <div class="d-flex justify-content-center align-items-center h-100">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
    
    try {
      if (this.isClientMode) {
        // Client-side visualization
        await this.loadClientVisualization(vizType, dataToUse);
      } else {
        // Server-side visualization
        await this.loadServerVisualization(vizType);
      }
    } catch (error) {
      console.error(`Error loading ${vizType} visualization:`, error);
      document.getElementById('visualization-container').innerHTML = `
        <div class="alert alert-danger">
          <h4 class="alert-heading">Visualization Error</h4>
          <p>${error.message}</p>
        </div>
      `;
    }
  }
  
  /**
   * Load client-side visualization
   */
  async loadClientVisualization(vizType, dataToUse = null) {
    // Ensure we have data
    if (!this.data && !dataToUse) {
      await this.loadData();
    }
    
    const container = document.getElementById('visualization-container');
    
    // Clear previous content
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    
    // Create canvas for chart
    const canvas = document.createElement('canvas');
    canvas.id = 'chart-canvas';
    container.appendChild(canvas);
    
    // Use provided data or main data
    const data = dataToUse || this.data;
    
    // Create visualization
    switch (vizType) {
      case 'time_series':
        this.fallbackViz.createTimeSeriesChart(canvas, data);
        document.getElementById('viz-description').textContent = 
          'Time series of PM2.5 and PM10 concentrations over the selected period.';
        break;
      case 'daily_pattern':
        this.fallbackViz.createDailyPatternChart(canvas, data);
        document.getElementById('viz-description').textContent = 
          'Average air quality readings by hour of day, showing daily patterns.';
        break;
      case 'correlation':
        this.fallbackViz.createCorrelationChart(canvas, data);
        document.getElementById('viz-description').textContent = 
          'Correlation between different measurements: PM2.5, PM10, temperature, and humidity.';
        break;
      case 'heatmap':
        this.fallbackViz.createHeatmapChart(canvas, data);
        document.getElementById('viz-description').textContent = 
          'Heatmap showing PM2.5 concentration patterns over time.';
        break;
      default:
        container.innerHTML = '<div class="alert alert-warning">Unknown visualization type</div>';
        document.getElementById('viz-description').textContent = '';
    }
  }
  
  /**
   * Load server-side visualization
   */
  async loadServerVisualization(vizType) {
    try {
      // Build the API endpoint URL
      let endpoint = `/api/visualization/${vizType}`;
      
      // Add date filter parameters if specified
      if (this.dateRange) {
        endpoint += `?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}`;
      }
      
      // Fetch visualization data from server
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const vizData = await response.json();
      
      if (vizData.error) {
        throw new Error(vizData.message || 'Unknown error');
      }
      
      // Display the visualization image
      const container = document.getElementById('visualization-container');
      container.innerHTML = `<img src="${vizData.imagePath}" class="img-fluid" alt="${this.getVizTitle(vizType)}">`;
      
      // Update description
      document.getElementById('viz-description').textContent = vizData.description || '';
    } catch (error) {
      console.error('Error loading server visualization:', error);
      // Switch to client-side visualization as fallback
      this.isClientMode = true;
      this.renderer.isClientMode = true;
      document.getElementById('vizModeText').textContent = 'Client-side';
      await this.loadClientVisualization(vizType);
    }
  }
  
  /**
   * Toggle extended visualization views
   */
  toggleExtendedViews() {
    const galleryContainer = document.getElementById('visualization-gallery');
    
    // Check if gallery is already populated
    if (galleryContainer.childNodes.length > 0) {
      galleryContainer.innerHTML = ''; // Clear gallery
      return;
    }
    
    // Show loading indicator
    galleryContainer.innerHTML = `
      <div class="col-12 text-center p-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Loading additional visualizations...</p>
      </div>
    `;
    
    // Define visualization types to load
    const vizTypes = ['time_series', 'daily_pattern', 'correlation', 'heatmap'];
    const vizTitles = {
      'time_series': 'Time Series Analysis',
      'daily_pattern': 'Daily Pattern Analysis',
      'correlation': 'Correlation Analysis',
      'heatmap': 'Heatmap Analysis'
    };
    
    // Clear gallery and create layout
    galleryContainer.innerHTML = '';
    
    // Create gallery items
    vizTypes.forEach(type => {
      // Create gallery item
      const col = document.createElement('div');
      col.className = 'col-md-6 mb-4';
      
      const card = document.createElement('div');
      card.className = 'card';
      
      const header = document.createElement('div');
      header.className = 'card-header';
      header.textContent = vizTitles[type] || type;
      
      const body = document.createElement('div');
      body.className = 'card-body';
      body.innerHTML = `
        <div id="viz-${type}-container" style="height: 300px;" class="text-center">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
      `;
      
      // Assemble card
      card.appendChild(header);
      card.appendChild(body);
      col.appendChild(card);
      
      // Add to gallery
      galleryContainer.appendChild(col);
      
      // Load visualization
      setTimeout(() => {
        this.loadGalleryVisualization(type);
      }, 100 * vizTypes.indexOf(type)); // Stagger loading to prevent browser freeze
    });
  }
  
  /**
   * Load visualization for gallery
   */
  async loadGalleryVisualization(vizType) {
    const container = document.getElementById(`viz-${vizType}-container`);
    
    try {
      if (this.isClientMode) {
        // Create canvas for chart
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${vizType}-canvas`;
        container.innerHTML = '';
        container.appendChild(canvas);
        
        // Create visualization
        switch (vizType) {
          case 'time_series':
            this.fallbackViz.createTimeSeriesChart(canvas, this.data);
            break;
          case 'daily_pattern':
            this.fallbackViz.createDailyPatternChart(canvas, this.data);
            break;
          case 'correlation':
            this.fallbackViz.createCorrelationChart(canvas, this.data);
            break;
          case 'heatmap':
            this.fallbackViz.createHeatmapChart(canvas, this.data);
            break;
        }
      } else {
        // Server-side visualization
        let endpoint = `/api/visualization/${vizType}`;
        
        // Add date filter parameters if specified
        if (this.dateRange) {
          endpoint += `?startDate=${this.dateRange.startDate}&endDate=${this.dateRange.endDate}`;
        }
        
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`API request failed: ${response.status}`);
        
        const vizData = await response.json();
        
        container.innerHTML = `<img src="${vizData.imagePath}" class="img-fluid" alt="${vizType}">`;
      }
    } catch (error) {
      console.error(`Error loading gallery visualization ${vizType}:`, error);
      container.innerHTML = `
        <div class="alert alert-danger">
          Failed to load visualization
        </div>
      `;
    }
  }
  
  /**
   * Update data validation section
   */
  updateDataValidation(stats) {
    const validationBadge = document.getElementById('validation-badge');
    const validationDetails = document.getElementById('validation-details');
    
    if (stats.validation) {
      // Show validation results
      const validation = stats.validation;
      
      // Set overall quality badge
      let badgeClass = 'bg-success';
      let badgeText = 'Good';
      
      if (validation.missing_values_percent > 5) {
        badgeClass = 'bg-danger';
        badgeText = 'Poor';
      } else if (validation.outliers_percent > 2) {
        badgeClass = 'bg-warning';
        badgeText = 'Fair';
      }
      
      validationBadge.className = `badge ${badgeClass}`;
      validationBadge.textContent = `Quality: ${badgeText}`;
      
      // Show detailed validation information
      validationDetails.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <h6>Data Completeness</h6>
            <ul class="list-group">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Missing Values
                <span class="badge ${validation.missing_values_percent > 5 ? 'bg-danger' : 'bg-success'} rounded-pill">
                  ${validation.missing_values_percent.toFixed(1)}%
                </span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Sample Count
                <span class="badge bg-secondary rounded-pill">
                  ${validation.total_samples}
                </span>
              </li>
            </ul>
          </div>
          <div class="col-md-6">
            <h6>Data Quality</h6>
            <ul class="list-group">
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Outliers
                <span class="badge ${validation.outliers_percent > 2 ? 'bg-warning' : 'bg-success'} rounded-pill">
                  ${validation.outliers_percent.toFixed(1)}%
                </span>
              </li>
              <li class="list-group-item d-flex justify-content-between align-items-center">
                Sensor Health
                <span class="badge ${validation.sensor_health ? 'bg-success' : 'bg-danger'} rounded-pill">
                  ${validation.sensor_health ? 'OK' : 'Check Required'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      `;
    } else {
      // Show default content when validation data is not available
      validationBadge.className = 'badge bg-secondary';
      validationBadge.textContent = 'Not Available';
      validationDetails.innerHTML = '<p class="text-center">Data validation is only available with server-side processing and extended statistics.</p>';
    }
  }
  
  /**
   * Get title for visualization
   */
  getVizTitle(vizType) {
    switch (vizType) {
      case 'time_series': return 'Time Series Visualization';
      case 'daily_pattern': return 'Daily Pattern Visualization';
      case 'correlation': return 'Correlation Visualization';
      case 'heatmap': return 'Heatmap Visualization';
      default: return 'Visualization';
    }
  }
  
  /**
   * Check API connection status
   */
  checkConnection() {
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    
    fetch('/health')
      .then(response => {
        if (response.ok) {
          statusIndicator.className = 'status-indicator connected';
          statusText.textContent = 'Connected';
        } else {
          statusIndicator.className = 'status-indicator error';
          statusText.textContent = 'Error';
        }
      })
      .catch(() => {
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Disconnected';
      });
  }
  
  /**
   * Toggle dark/light mode
   */
  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    const body = document.body;
    const themeIcon = document.querySelector('#toggleTheme i');
    
    if (this.darkMode) {
      body.classList.add('dark-mode');
      themeIcon.className = 'bi bi-sun-fill';
    } else {
      body.classList.remove('dark-mode');
      themeIcon.className = 'bi bi-moon-fill';
    }
    
    // Save preference
    localStorage.setItem('darkMode', this.darkMode);
  }
  
  /**
   * Load theme preference from storage
   */
  loadThemePreference() {
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      this.darkMode = false; // Will be toggled to true
      this.toggleDarkMode();
    }
  }
  
  /**
   * Setup real-time data updates
   */
  setupRealTimeUpdates() {
    const realtimeSwitch = document.getElementById('realtimeSwitch');
    
    realtimeSwitch.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.startRealTimeUpdates();
      } else {
        this.stopRealTimeUpdates();
      }
    });
    
    // Start real-time updates if switch is checked
    if (realtimeSwitch.checked) {
      this.startRealTimeUpdates();
    }
  }
  
  /**
   * Start real-time data updates
   */
  startRealTimeUpdates() {
    this.updateInterval = setInterval(() => {
      this.loadData();
      if (this.isClientMode) {
        this.loadVisualization(this.currentVizType);
      }
    }, 60000); // Update every minute
  }
  
  /**
   * Stop real-time data updates
   */
  stopRealTimeUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
  
  /**
   * Download current data as CSV
   */
  downloadData() {
    if (!this.data || this.data.length === 0) {
      alert('No data available to download');
      return;
    }
    
    // Get the data to download (filtered or all)
    const dataToDownload = this.filteredData || this.data;
    
    // Create fields array
    const fields = ['created_at', 'pm25', 'pm10', 'temperature', 'humidity'];
    
    // Create CSV content
    let csvContent = fields.join(',') + '\n';
    
    dataToDownload.forEach(item => {
      let row = [
        item.created_at,
        item.pm25 || item.field3 || '',
        item.pm10 || item.field4 || '',
        item.temperature || item.field2 || '',
        item.humidity || item.field1 || ''
      ].map(value => {
        // Quote strings with commas
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create download link
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'air_quality_data.csv');
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
  }
}
