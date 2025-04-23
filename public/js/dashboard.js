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
    this.data = [];
    this.lastEntryId = 0;
    this.filters = {
      startDate: null,
      endDate: null,
      startTime: null,
      endTime: null
    };
    this.pagination = {
      currentPage: 1,
      itemsPerPage: 10,
      totalItems: 0
    };
    this.realtime = true;
    this.activeChart = null;
    this.lastUpdated = null;

    // DOM Elements
    this.elements = {
      vizContainer: document.getElementById('visualization-container'),
      vizTitle: document.getElementById('vizTitle'),
      vizDescription: document.getElementById('viz-description'),
      dataTable: document.getElementById('data-table-body'),
      statusIndicator: document.getElementById('status-indicator'),
      statusText: document.getElementById('status-text'),
      realtimeSwitch: document.getElementById('realtimeSwitch'),
      dataTableInfo: document.getElementById('data-table-info'),
      prevPageBtn: document.getElementById('prev-page'),
      nextPageBtn: document.getElementById('next-page'),
      dateRange: document.getElementById('dateRange'),
      timeFilter: document.getElementById('timeFilter'),
      refreshViz: document.getElementById('refreshViz'),
      toastContainer: document.getElementById('toast-container'),
      showExtendedViz: document.getElementById('showExtendedViz'),
      vizGallery: document.getElementById('visualization-gallery'),
      avgPM25: document.getElementById('avgPM25'),
      avgPM10: document.getElementById('avgPM10'),
      avgTemp: document.getElementById('avgTemp'),
      avgHumidity: document.getElementById('avgHumidity'),
      peakPM25: document.getElementById('peakPM25'),
      peakPM10: document.getElementById('peakPM10'),
      lowPM25: document.getElementById('lowPM25'),
      lowPM10: document.getElementById('lowPM10'),
      toggleTheme: document.getElementById('toggleTheme'),
      applyDateFilter: document.getElementById('applyDateFilter'),
      applyTimeFilter: document.getElementById('applyTimeFilter'),
      refreshTable: document.getElementById('refreshTable'),
      validationBadge: document.getElementById('validation-badge'),
      validationDetails: document.getElementById('validation-details')
    };
    
    // Remove toggle viz mode button and functionality
    const toggleVizBtn = document.getElementById('toggleVizMode');
    if (toggleVizBtn) {
      toggleVizBtn.parentNode.removeChild(toggleVizBtn);
    }
  }
  
  /**
   * Initialize the dashboard
   */
  init() {
    // Initialize date pickers
    this.initializeDatePickers();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize dashboard
    this.initializeDashboard();
    
    // Apply saved theme
    this.loadThemePreference();
  }
  
  /**
   * Initialize date pickers
   */
  initializeDatePickers() {
    if (this.elements.dateRange) {
      flatpickr(this.elements.dateRange, {
        mode: "range",
        dateFormat: "Y-m-d",
        maxDate: "today"
      });
    }

    if (this.elements.timeFilter) {
      flatpickr(this.elements.timeFilter, {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true
      });
    }
  }
  
  /**
   * Setup event listeners for UI interactions
   */
  setupEventListeners() {
    // Theme toggle
    this.elements.toggleTheme.addEventListener('click', () => this.toggleTheme());
    
    // Visualization type selection
    document.querySelectorAll('.viz-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.selectVisualization(e.currentTarget.dataset.type);
      });
    });
    
    // Real-time toggle
    this.elements.realtimeSwitch.addEventListener('change', () => this.toggleRealtime());
    
    // Filter application
    this.elements.applyDateFilter.addEventListener('click', () => this.applyFilters());
    this.elements.applyTimeFilter.addEventListener('click', () => this.applyFilters());
    
    // Pagination
    this.elements.prevPageBtn.addEventListener('click', () => this.changePage(-1));
    this.elements.nextPageBtn.addEventListener('click', () => this.changePage(1));
    
    // Refresh buttons
    this.elements.refreshViz.addEventListener('click', () => this.loadVisualization(this.currentVizType));
    this.elements.refreshTable.addEventListener('click', () => this.refreshData());
    
    // Extended visualizations
    this.elements.showExtendedViz.addEventListener('click', () => this.toggleExtendedVisualizations());
    
    // Download data (window function)
    window.downloadData = () => this.downloadData();
  }
  
  /**
   * Initialize the dashboard
   */
  async initializeDashboard() {
    try {
      await this.loadData();
      this.updateStatus('connected', 'Connected');
      this.selectVisualization('time_series');
      this.validateData();
      
      if (this.realtime) {
        this.startRealtimeUpdates();
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      this.updateStatus('error', 'Error loading data');
      this.showToast('Error', 'Failed to load initial data. Please try refreshing the page.', 'danger');
    }
  }
  
  /**
   * Load data from API
   */
  async loadData() {
    this.updateStatus('loading', 'Loading data...');
    
    let url = `/api/data?results=${100}`;
    
    // Apply filters if they exist
    if (this.filters.startDate) {
      url += `&start=${this.filters.startDate}`;
      if (this.filters.endDate) {
        url += `&end=${this.filters.endDate}`;
      }
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('Invalid data format received');
      }
      
      this.data = result.data.data || [];
      this.pagination.totalItems = this.data.length;
      this.lastEntryId = this.data[0]?.entry_id || 0;
      this.lastUpdated = new Date();
      
      this.updateDataTable();
      this.updateStatistics();
      this.updateStatus('connected', `Last updated: ${this.formatTime(this.lastUpdated)}`);
      
      return this.data;
    } catch (error) {
      console.error('Error loading data:', error);
      this.updateStatus('error', 'Data loading error');
      throw error;
    }
  }
  
  /**
   * Start real-time updates
   */
  startRealtimeUpdates() {
    this.updateInterval = setInterval(async () => {
      if (!this.realtime) {
        clearInterval(this.updateInterval);
        return;
      }
      
      try {
        const response = await fetch(`/api/latest-data?last_entry_id=${this.lastEntryId}`);
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        
        if (!result.success) {
          throw new Error('Failed to get latest data');
        }
        
        // If there are new entries
        if (result.data && result.data.feeds && result.data.feeds.length > 0) {
          const newEntries = result.data.feeds;
          this.data = [...newEntries.reverse(), ...this.data];
          this.lastEntryId = result.data.channel.last_entry_id;
          this.lastUpdated = new Date();
          
          this.updateDataTable();
          this.updateStatistics();
          this.updateStatus('connected', `Updated: ${this.formatTime(this.lastUpdated)}`);
          
          // Update active visualization if needed
          if (this.activeChart) {
            this.updateActiveChart(newEntries);
          }
          
          if (newEntries.length > 0) {
            this.showToast('Data Updated', `Received ${newEntries.length} new data points`, 'success');
          }
        }
      } catch (error) {
        console.error('Error fetching real-time updates:', error);
        this.updateStatus('warning', 'Update failed');
      }
    }, 60000); // 1 minute refresh
  }
  
  /**
   * Toggle real-time updates
   */
  toggleRealtime() {
    this.realtime = this.elements.realtimeSwitch.checked;
    
    if (this.realtime) {
      this.startRealtimeUpdates();
      this.showToast('Real-time Updates', 'Real-time updates enabled', 'info');
    } else {
      clearInterval(this.updateInterval);
      this.showToast('Real-time Updates', 'Real-time updates disabled', 'info');
    }
  }
  
  /**
   * Apply date and time filters
   */
  applyFilters() {
    const dateValue = this.elements.dateRange.value;
    const timeValue = this.elements.timeFilter.value;
    
    // Parse date range
    if (dateValue) {
      const dates = dateValue.split(' to ');
      this.filters.startDate = dates[0];
      this.filters.endDate = dates.length > 1 ? dates[1] : dates[0];
    } else {
      this.filters.startDate = null;
      this.filters.endDate = null;
    }
    
    // Parse time filter
    if (timeValue) {
      this.filters.startTime = timeValue;
    } else {
      this.filters.startTime = null;
    }
    
    // Reset pagination
    this.pagination.currentPage = 1;
    
    // Load filtered data
    this.loadData().then(() => {
      this.loadVisualization(this.currentVizType);
      this.showToast('Filters Applied', 'Data filtered successfully', 'success');
    }).catch(error => {
      console.error('Error applying filters:', error);
      this.showToast('Filter Error', 'Failed to apply filters', 'danger');
    });
  }
  
  /**
   * Update data table with current data
   */
  updateDataTable() {
    const start = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
    const end = start + this.pagination.itemsPerPage;
    const pageData = this.data.slice(start, end);
    
    if (pageData.length === 0) {
      this.elements.dataTable.innerHTML = `<tr><td colspan="5" class="text-center">No data available</td></tr>`;
      this.elements.dataTableInfo.textContent = 'No data to display';
      return;
    }
    
    this.elements.dataTable.innerHTML = pageData.map(item => {
      const timestamp = new Date(item.created_at).toLocaleString();
      return `
        <tr>
          <td>${timestamp}</td>
          <td>${this.formatValue(item.pm25 || item.field3)}</td>
          <td>${this.formatValue(item.pm10 || item.field4)}</td>
          <td>${this.formatValue(item.temperature || item.field2)}</td>
          <td>${this.formatValue(item.humidity || item.field1)}</td>
        </tr>
      `;
    }).join('');
    
    // Update pagination information
    this.elements.dataTableInfo.textContent = `Showing ${start + 1} to ${Math.min(end, this.data.length)} of ${this.data.length} records`;
    
    // Update pagination buttons
    this.elements.prevPageBtn.disabled = this.pagination.currentPage === 1;
    this.elements.nextPageBtn.disabled = end >= this.data.length;
  }
  
  /**
   * Change data table page
   */
  changePage(direction) {
    const newPage = this.pagination.currentPage + direction;
    
    if (newPage < 1 || newPage > Math.ceil(this.data.length / this.pagination.itemsPerPage)) {
      return;
    }
    
    this.pagination.currentPage = newPage;
    this.updateDataTable();
  }
  
  /**
   * Update statistics display
   */
  updateStatistics() {
    if (this.data.length === 0) {
      return;
    }
    
    try {
      // Calculate statistics
      const pm25Values = this.data.map(d => parseFloat(d.pm25 || d.field3)).filter(x => !isNaN(x));
      const pm10Values = this.data.map(d => parseFloat(d.pm10 || d.field4)).filter(x => !isNaN(x));
      const tempValues = this.data.map(d => parseFloat(d.temperature || d.field2)).filter(x => !isNaN(x));
      const humidityValues = this.data.map(d => parseFloat(d.humidity || d.field1)).filter(x => !isNaN(x));
      
      // Calculate averages
      const avgPM25 = pm25Values.length > 0 ? pm25Values.reduce((a, b) => a + b, 0) / pm25Values.length : 0;
      const avgPM10 = pm10Values.length > 0 ? pm10Values.reduce((a, b) => a + b, 0) / pm10Values.length : 0;
      const avgTemp = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 0;
      const avgHumidity = humidityValues.length > 0 ? humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length : 0;
      
      // Find max and min values
      const maxPM25 = pm25Values.length > 0 ? Math.max(...pm25Values) : 0;
      const maxPM10 = pm10Values.length > 0 ? Math.max(...pm10Values) : 0;
      const minPM25 = pm25Values.length > 0 ? Math.min(...pm25Values) : 0;
      const minPM10 = pm10Values.length > 0 ? Math.min(...pm10Values) : 0;
      
      // Update DOM elements
      this.elements.avgPM25.textContent = avgPM25.toFixed(2);
      this.elements.avgPM10.textContent = avgPM10.toFixed(2);
      this.elements.avgTemp.textContent = avgTemp.toFixed(1);
      this.elements.avgHumidity.textContent = avgHumidity.toFixed(1);
      
      this.elements.peakPM25.textContent = maxPM25.toFixed(2);
      this.elements.peakPM10.textContent = maxPM10.toFixed(2);
      this.elements.lowPM25.textContent = minPM25.toFixed(2);
      this.elements.lowPM10.textContent = minPM10.toFixed(2);
      
      // Add Air Quality Index badges based on PM2.5 values
      this.updateAQIBadges(avgPM25);
    } catch (error) {
      console.error('Error calculating statistics:', error);
    }
  }
  
  /**
   * Add Air Quality Index badges based on PM2.5 values
   * @param {number} pm25 - PM2.5 value
   */
  updateAQIBadges(pm25) {
    // Simple AQI classification based on PM2.5 (simplified scale)
    let aqiClass = 'bg-good';
    let aqiText = 'Good';
    
    if (pm25 <= 12) {
      aqiClass = 'bg-good';
      aqiText = 'Good';
    } else if (pm25 <= 35.4) {
      aqiClass = 'bg-moderate';
      aqiText = 'Moderate';
    } else if (pm25 <= 55.4) {
      aqiClass = 'bg-unhealthy';
      aqiText = 'Unhealthy';
    } else if (pm25 <= 150.4) {
      aqiClass = 'bg-very-unhealthy';
      aqiText = 'Very Unhealthy';
    } else {
      aqiClass = 'bg-hazardous';
      aqiText = 'Hazardous';
    }
    
    // Add the badge near PM2.5 value
    const badge = `<span class="ms-2 badge ${aqiClass}">${aqiText}</span>`;
    this.elements.avgPM25.innerHTML = `${parseFloat(this.elements.avgPM25.textContent).toFixed(2)}${badge}`;
  }
  
  /**
   * Update the status indicator
   */
  updateStatus(status, message) {
    this.elements.statusIndicator.className = `status-indicator ${status}`;
    this.elements.statusText.textContent = message;
  }
  
  /**
   * Select visualization type
   */
  selectVisualization(type) {
    // Update active link styling
    document.querySelectorAll('.viz-link').forEach(link => {
      if (link.dataset.type === type) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
    
    this.currentVizType = type;
    this.loadVisualization(type);
  }
  
  /**
   * Load the selected visualization type
   */
  loadVisualization(type) {
    if (this.data.length === 0) {
      this.elements.vizContainer.innerHTML = `<div class="alert alert-warning">No data available for visualization</div>`;
      return;
    }
    
    // Show loading indicator
    this.elements.vizContainer.innerHTML = `
      <div class="d-flex justify-content-center align-items-center h-100">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
    
    // Set title and prepare container
    let title = 'Air Quality Visualization';
    switch (type) {
      case 'time_series':
        title = 'Time Series Visualization';
        this.elements.vizDescription.textContent = 'Shows PM2.5, PM10, Temperature and Humidity measurements over time.';
        this.elements.vizContainer.innerHTML = `<canvas id="timeSeriesChart"></canvas>`;
        this.createTimeSeriesChart();
        break;
        
      case 'daily_pattern':
        title = 'Daily Pattern Analysis';
        this.elements.vizDescription.textContent = 'Shows average PM2.5 and PM10 levels by hour of day.';
        this.elements.vizContainer.innerHTML = `<canvas id="dailyPatternChart"></canvas>`;
        this.createDailyPatternChart();
        break;
        
      case 'heatmap':
        title = 'Pollution Heatmap';
        this.elements.vizDescription.textContent = 'Visualizes PM2.5 pollution intensity over time.';
        this.elements.vizContainer.innerHTML = `<canvas id="heatmapChart"></canvas>`;
        this.createHeatmapChart();
        break;
        
      case 'correlation':
        title = 'Parameter Correlation';
        this.elements.vizDescription.textContent = 'Shows relationships between different air quality parameters.';
        this.elements.vizContainer.innerHTML = `<canvas id="correlationChart"></canvas>`;
        this.createCorrelationChart();
        break;
        
      default:
        this.elements.vizContainer.innerHTML = `<div class="alert alert-danger">Unknown visualization type</div>`;
        break;
    }
    
    this.elements.vizTitle.textContent = title;
  }
  
  /**
   * Show toast notification
   */
  showToast(title, message, type = 'info') {
    const toastId = `toast-${Date.now()}`;
    
    const toastHtml = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header bg-${type} text-white">
          <strong class="me-auto">${title}</strong>
          <small>${this.formatTime(new Date())}</small>
          <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    this.elements.toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Auto-remove after shown
    toastElement.addEventListener('hidden.bs.toast', () => {
      toastElement.remove();
    });
  }
  
  /**
   * Toggle theme between light and dark
   */
  toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', newTheme);
    
    // Update theme icon
    const themeIcon = this.elements.toggleTheme.querySelector('i');
    if (newTheme === 'dark') {
      themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    } else {
      themeIcon.classList.replace('bi-sun-fill', 'bi-moon-fill');
    }
    
    // If there's an active chart, recreate it with the new theme
    if (this.activeChart) {
      this.loadVisualization(this.currentVizType);
    }
  }
  
  /**
   * Load theme preference from localStorage
   */
  loadThemePreference() {
    if (localStorage.getItem('theme') === 'dark') {
      document.body.classList.add('dark-mode');
      const themeIcon = this.elements.toggleTheme.querySelector('i');
      themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
    }
  }
  
  /**
   * Format time for display
   */
  formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Format numeric value for display
   */
  formatValue(value) {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    const num = parseFloat(value);
    return isNaN(num) ? 'N/A' : num.toFixed(2);
  }
  
  /**
   * Refresh data from the server
   */
  refreshData() {
    this.loadData().then(() => {
      this.loadVisualization(this.currentVizType);
      this.showToast('Data Refreshed', 'Data has been successfully refreshed', 'success');
    }).catch(error => {
      console.error('Error refreshing data:', error);
      this.showToast('Refresh Error', 'Failed to refresh data', 'danger');
    });
  }

  /**
   * Toggle extended visualizations
   */
  toggleExtendedVisualizations() {
    const button = this.elements.showExtendedViz;
    const gallery = this.elements.vizGallery;
    
    if (gallery.classList.contains('d-none')) {
      // Show extended visualizations
      gallery.classList.remove('d-none');
      button.innerHTML = '<i class="bi bi-eye-slash"></i> Hide Extended Views';
      this.loadExtendedVisualizations();
    } else {
      // Hide extended visualizations
      gallery.classList.add('d-none');
      button.innerHTML = '<i class="bi bi-grid-3x3"></i> Extended Views';
    }
  }
  
  /**
   * Load extended visualizations
   */
  loadExtendedVisualizations() {
    this.elements.vizGallery.innerHTML = `
      <div class="col-12 text-center mb-3">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Loading additional visualizations...</p>
      </div>
    `;
    
    // Prepare gallery items
    setTimeout(() => {
      const galleryItems = [
        { id: 'pm25-trend', title: 'PM2.5 Trend Analysis', type: 'line' },
        { id: 'temp-humidity-correlation', title: 'Temperature vs. Humidity', type: 'scatter' },
        { id: 'hourly-distribution', title: 'Hourly Distribution', type: 'bar' },
        { id: 'daily-averages', title: 'Daily Averages', type: 'bar' }
      ];
      
      this.elements.vizGallery.innerHTML = galleryItems.map(item => `
        <div class="col-md-6 mb-4">
          <div class="card">
            <div class="card-header">${item.title}</div>
            <div class="card-body" style="height: 300px;">
              <canvas id="${item.id}-chart"></canvas>
            </div>
          </div>
        </div>
      `).join('');
      
      // Render each extended visualization
      this.renderExtendedViz();
    }, 500);
  }

  /**
   * Render extended visualizations
   */
  renderExtendedViz() {
    if (this.data.length === 0) return;
    
    // Use the AirQualityViz global object if available
    if (window.AirQualityViz) {
      const theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
      
      // Create PM2.5 trend chart
      try {
        window.AirQualityViz.createTrendVisualization(
          'pm25-trend-chart',
          this.data,
          { 
            parameter: 'pm25',
            title: 'PM2.5 Trend Analysis',
            theme: theme
          }
        );
      } catch (err) {
        console.error('Error creating PM2.5 trend chart', err);
      }
      
      // Create temperature vs humidity correlation chart
      try {
        window.AirQualityViz.createCorrelationVisualization(
          'temp-humidity-correlation-chart',
          this.data,
          {
            xAxis: 'temperature',
            yAxis: 'humidity',
            title: 'Temperature vs. Humidity',
            theme: theme
          }
        );
      } catch (err) {
        console.error('Error creating temperature vs humidity chart', err);
      }
      
      // Create hourly distribution chart
      this.createHourlyDistributionChart();
      
      // Create daily averages chart
      this.createDailyAveragesChart();
    } else {
      console.error('AirQualityViz library not available');
      this.elements.vizGallery.innerHTML = `
        <div class="col-12">
          <div class="alert alert-warning">
            Visualization library not available. Please refresh the page.
          </div>
        </div>
      `;
    }
  }
  
  /**
   * Create hourly distribution chart for PM2.5
   */
  createHourlyDistributionChart() {
    const hourlyDistributionCtx = document.getElementById('hourly-distribution-chart');
    if (!hourlyDistributionCtx) return;
    
    // Group data by hour
    const hourlyData = Array(24).fill(0);
    const hourlyCount = Array(24).fill(0);
    
    this.data.forEach(d => {
      const pm25 = parseFloat(d.pm25 || d.field3);
      if (!isNaN(pm25)) {
        const hour = new Date(d.created_at).getHours();
        hourlyData[hour] += pm25;
        hourlyCount[hour]++;
      }
    });
    
    // Calculate average for each hour
    const hourlyAvg = hourlyData.map((sum, hour) => 
      hourlyCount[hour] > 0 ? sum / hourlyCount[hour] : 0
    );
    
    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00');
    
    const chart = new Chart(hourlyDistributionCtx, {
      type: 'bar',
      data: {
        labels: hours,
        datasets: [{
          label: 'Average PM2.5 by Hour',
          data: hourlyAvg,
          backgroundColor: 'rgba(54, 162, 235, 0.7)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: {
              display: true,
              text: 'Average PM2.5 (μg/m³)'
            },
            beginAtZero: true
          },
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          }
        }
      }
    });
  }
  
  /**
   * Create daily averages chart
   */
  createDailyAveragesChart() {
    const dailyAvgCtx = document.getElementById('daily-averages-chart');
    if (!dailyAvgCtx) return;
    
    // Group data by day
    const dailyData = {};
    
    this.data.forEach(d => {
      const date = new Date(d.created_at).toISOString().split('T')[0];
      const pm25 = parseFloat(d.pm25 || d.field3);
      const pm10 = parseFloat(d.pm10 || d.field4);
      
      if (!dailyData[date]) {
        dailyData[date] = { pm25Sum: 0, pm10Sum: 0, count: 0 };
      }
      
      if (!isNaN(pm25)) dailyData[date].pm25Sum += pm25;
      if (!isNaN(pm10)) dailyData[date].pm10Sum += pm10;
      dailyData[date].count++;
    });
    
    // Calculate averages
    const dates = Object.keys(dailyData).sort();
    const pm25Avgs = dates.map(date => 
      dailyData[date].count > 0 ? dailyData[date].pm25Sum / dailyData[date].count : 0
    );
    const pm10Avgs = dates.map(date => 
      dailyData[date].count > 0 ? dailyData[date].pm10Sum / dailyData[date].count : 0
    );
    
    const chart = new Chart(dailyAvgCtx, {
      type: 'bar',
      data: {
        labels: dates.map(date => new Date(date).toLocaleDateString()),
        datasets: [
          {
            label: 'Average PM2.5',
            data: pm25Avgs,
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: 'Average PM10',
            data: pm10Avgs,
            backgroundColor: 'rgba(255, 159, 64, 0.7)',
            borderColor: 'rgba(255, 159, 64, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            title: {
              display: true,
              text: 'Concentration (μg/m³)'
            },
            beginAtZero: true
          },
          x: {
            title: {
              display: true,
              text: 'Date'
            }
          }
        }
      }
    });
  }

  /**
   * Create time series chart
   */
  createTimeSeriesChart() {
    if (this.data.length === 0) return;
    
    const ctx = document.getElementById('timeSeriesChart');
    
    if (!ctx) {
      console.error('Canvas element not found for time series chart');
      return;
    }
    
    try {
      // Process data for Chart.js
      const timestamps = this.data.map(d => new Date(d.created_at));
      const pm25Values = this.data.map(d => parseFloat(d.pm25 || d.field3));
      const pm10Values = this.data.map(d => parseFloat(d.pm10 || d.field4));
      const tempValues = this.data.map(d => parseFloat(d.temperature || d.field2));
      const humidityValues = this.data.map(d => parseFloat(d.humidity || d.field1));
      
      // Create chart
      const chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: timestamps,
          datasets: [
            {
              label: 'PM2.5',
              data: pm25Values,
              borderColor: 'rgba(255, 99, 132, 1)',
              backgroundColor: 'rgba(255, 99, 132, 0.1)',
              yAxisID: 'y',
              tension: 0.2,
              pointRadius: 1
            },
            {
              label: 'PM10',
              data: pm10Values,
              borderColor: 'rgba(255, 159, 64, 1)',
              backgroundColor: 'rgba(255, 159, 64, 0.1)',
              yAxisID: 'y',
              tension: 0.2,
              pointRadius: 1
            },
            {
              label: 'Temperature',
              data: tempValues,
              borderColor: 'rgba(75, 192, 192, 1)',
              backgroundColor: 'rgba(75, 192, 192, 0.1)',
              yAxisID: 'y1',
              tension: 0.2,
              pointRadius: 1,
              hidden: true
            },
            {
              label: 'Humidity',
              data: humidityValues,
              borderColor: 'rgba(54, 162, 235, 1)',
              backgroundColor: 'rgba(54, 162, 235, 0.1)',
              yAxisID: 'y2',
              tension: 0.2,
              pointRadius: 1,
              hidden: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            tooltip: {
              enabled: true
            },
            zoom: {
              pan: {
                enabled: true,
                mode: 'x'
              },
              zoom: {
                wheel: {
                  enabled: true,
                },
                pinch: {
                  enabled: true
                },
                mode: 'x',
              }
            },
            legend: {
              position: 'top',
            },
            annotation: {
              annotations: {
                who_pm25: {
                  type: 'line',
                  yMin: 15,
                  yMax: 15,
                  borderColor: 'rgba(255, 99, 132, 0.6)',
                  borderWidth: 1,
                  borderDash: [5, 5],
                  label: {
                    content: 'WHO PM2.5 Limit',
                    enabled: true,
                    position: 'end'
                  }
                }
              }
            }
          },
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'hour'
              },
              title: {
                display: true,
                text: 'Date/Time'
              }
            },
            y: {
              type: 'linear',
              display: true,
              position: 'left',
              title: {
                display: true,
                text: 'PM Concentration (μg/m³)'
              },
              min: 0
            },
            y1: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Temperature (°C)'
              },
              grid: {
                drawOnChartArea: false
              }
            },
            y2: {
              type: 'linear',
              display: true,
              position: 'right',
              title: {
                display: true,
                text: 'Humidity (%)'
              },
              grid: {
                drawOnChartArea: false
              },
              min: 0,
              max: 100
            }
          }
        }
      });
      
      // Save reference to current chart
      this.activeChart = chart;
    } catch (error) {
      console.error('Error creating time series chart:', error);
      const container = document.getElementById('timeSeriesChart').parentNode;
      container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
    }
  }

  /**
   * Create daily pattern chart
   */
  createDailyPatternChart() {
    if (this.data.length === 0) return;
    
    const ctx = document.getElementById('dailyPatternChart');
    
    if (!ctx) {
      console.error('Canvas element not found for daily pattern chart');
      return;
    }
    
    try {
      // Group data by hour
      const hourlyData = Array(24).fill().map(() => ({
        pm25Sum: 0,
        pm10Sum: 0,
        count: 0
      }));
      
      this.data.forEach(item => {
        const date = new Date(item.created_at);
        const hour = date.getHours();
        const pm25 = parseFloat(item.pm25 || item.field3);
        const pm10 = parseFloat(item.pm10 || item.field4);
        
        if (!isNaN(pm25)) {
          hourlyData[hour].pm25Sum += pm25;
          hourlyData[hour].count++;
        }
        
        if (!isNaN(pm10)) {
          hourlyData[hour].pm10Sum += pm10;
        }
      });
      
      // Calculate averages
      const hourlyPM25Avg = hourlyData.map(data => 
        data.count > 0 ? data.pm25Sum / data.count : 0
      );
      
      const hourlyPM10Avg = hourlyData.map(data => 
        data.count > 0 ? data.pm10Sum / data.count : 0
      );
      
      // Create labels for hours
      const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00');
      
      // Create chart
      const chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: hours,
          datasets: [
            {
              label: 'Average PM2.5',
              data: hourlyPM25Avg,
              backgroundColor: 'rgba(255, 99, 132, 0.7)',
              borderColor: 'rgba(255, 99, 132, 1)',
              borderWidth: 1
            },
            {
              label: 'Average PM10',
              data: hourlyPM10Avg,
              backgroundColor: 'rgba(54, 162, 235, 0.7)',
              borderColor: 'rgba(54, 162, 235, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.dataset.label || '';
                  const value = context.parsed.y.toFixed(2);
                  const hourlyCount = hourlyData[context.dataIndex].count;
                  return `${label}: ${value} μg/m³ (${hourlyCount} samples)`;
                }
              }
            }
          },
          scales: {
            y: {
              title: {
                display: true,
                text: 'PM Concentration (μg/m³)'
              },
              beginAtZero: true
            },
            x: {
              title: {
                display: true,
                text: 'Hour of Day'
              }
            }
          }
        }
      });
      
      // Save reference to current chart
      this.activeChart = chart;
    } catch (error) {
      console.error('Error creating daily pattern chart:', error);
      const container = document.getElementById('dailyPatternChart').parentNode;
      container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
    }
  }
  
  /**
   * Create heatmap chart
   */
  createHeatmapChart() {
    if (this.data.length === 0) return;
    
    const ctx = document.getElementById('heatmapChart');
    
    if (!ctx) {
      console.error('Canvas element not found for heatmap chart');
      return;
    }
    
    try {
      // Group data by day and hour
      const heatmapData = [];
      const dayMap = new Map();
      let dayIndex = 0;
      
      this.data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      this.data.forEach(item => {
        const date = new Date(item.created_at);
        const day = date.toISOString().split('T')[0];
        const hour = date.getHours();
        const pm25 = parseFloat(item.pm25 || item.field3) || 0;
        
        if (!dayMap.has(day)) {
          dayMap.set(day, dayIndex++);
        }
        
        const y = dayMap.get(day);
        const existingPoint = heatmapData.find(p => p.x === hour && p.y === y);
        
        if (existingPoint) {
          existingPoint.v += pm25;
          existingPoint.count++;
        } else {
          heatmapData.push({
            x: hour,
            y: y,
            v: pm25,
            count: 1,
            day: day
          });
        }
      });
      
      // Calculate averages
      heatmapData.forEach(point => {
        point.v = point.v / point.count;
      });
      
      // Create array of days for y-axis labels
      const days = Array.from(dayMap.keys()).sort();
      
      // Create heatmap chart
      const chart = new Chart(ctx, {
        type: 'matrix',
        data: {
          datasets: [{
            label: 'PM2.5 Heatmap',
            data: heatmapData.map(point => ({
              x: point.x,
              y: point.y,
              v: point.v
            })),
            backgroundColor(context) {
              const value = context.dataset.data[context.dataIndex].v;
              const alpha = Math.min(value / 50, 1); // Scale based on PM2.5 value
              return `rgba(255, 99, 132, ${alpha})`;
            },
            borderColor: 'white',
            borderWidth: 1,
            width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
            height: ({ chart }) => (chart.chartArea || {}).height / days.length - 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            tooltip: {
              callbacks: {
                title() {
                  return '';
                },
                label(context) {
                  const data = heatmapData[context.dataIndex];
                  const value = data.v.toFixed(2);
                  const hour = data.x.toString().padStart(2, '0') + ':00';
                  return [`Date: ${data.day}`, `Time: ${hour}`, `PM2.5: ${value} μg/m³`];
                }
              }
            },
            legend: {
              display: false
            }
          },
          scales: {
            x: {
              type: 'linear',
              position: 'top',
              min: 0,
              max: 23,
              ticks: {
                stepSize: 1,
                callback: value => value.toString().padStart(2, '0') + ':00'
              },
              title: {
                display: true,
                text: 'Hour of Day'
              }
            },
            y: {
              type: 'linear',
              offset: true,
              min: 0,
              max: days.length - 1,
              ticks: {
                stepSize: 1,
                callback: value => days[value]
              },
              title: {
                display: true,
                text: 'Date'
              },
              reverse: true
            }
          }
        }
      });
      
      // Save reference to current chart
      this.activeChart = chart;
    } catch (error) {
      console.error('Error creating heatmap chart:', error);
      const container = document.getElementById('heatmapChart').parentNode;
      container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
    }
  }
  
  /**
   * Create correlation chart
   */
  createCorrelationChart() {
    if (this.data.length === 0) return;
    
    const ctx = document.getElementById('correlationChart');
    
    if (!ctx) {
      console.error('Canvas element not found for correlation chart');
      return;
    }
    
    try {
      // Prepare data for correlation
      const pm25Values = this.data.map(d => parseFloat(d.pm25 || d.field3)).filter(x => !isNaN(x));
      const pm10Values = this.data.map(d => parseFloat(d.pm10 || d.field4)).filter(x => !isNaN(x));
      const tempValues = this.data.map(d => parseFloat(d.temperature || d.field2)).filter(x => !isNaN(x));
      const humidityValues = this.data.map(d => parseFloat(d.humidity || d.field1)).filter(x => !isNaN(x));
      
      // Get min length to ensure all arrays are same length
      const minLength = Math.min(
        pm25Values.length,
        pm10Values.length,
        tempValues.length,
        humidityValues.length
      );
      
      const scatterData = [];
      for (let i = 0; i < minLength; i++) {
        scatterData.push({
          x: tempValues[i],
          y: pm25Values[i]
        });
      }
      
      // Create chart
      const chart = new Chart(ctx, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Temperature vs PM2.5',
              data: scatterData,
              backgroundColor: 'rgba(75, 192, 192, 0.6)',
              pointRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'Temperature vs PM2.5 Correlation'
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const x = context.parsed.x.toFixed(1);
                  const y = context.parsed.y.toFixed(2);
                  return `Temperature: ${x}°C, PM2.5: ${y} μg/m³`;
                }
              }
            }
          },
          scales: {
            x: {
              title: {
                display: true,
                text: 'Temperature (°C)'
              }
            },
            y: {
              title: {
                display: true,
                text: 'PM2.5 (μg/m³)'
              },
              beginAtZero: true
            }
          }
        }
      });
      
      // Save reference to current chart
      this.activeChart = chart;
    } catch (error) {
      console.error('Error creating correlation chart:', error);
      const container = document.getElementById('correlationChart').parentNode;
      container.innerHTML = `<div class="alert alert-danger">Error creating chart: ${error.message}</div>`;
    }
  }
  
  /**
   * Update active chart with new data
   */
  updateActiveChart(newEntries) {
    if (!this.activeChart || newEntries.length === 0) return;
    
    try {
      if (this.currentVizType === 'time_series') {
        // For time series chart, add new data points
        const chart = this.activeChart;
        
        newEntries.forEach(entry => {
          const timestamp = new Date(entry.created_at);
          
          // Add to each dataset
          chart.data.labels.unshift(timestamp);
          chart.data.datasets[0].data.unshift(parseFloat(entry.pm25 || entry.field3));
          chart.data.datasets[1].data.unshift(parseFloat(entry.pm10 || entry.field4));
          chart.data.datasets[2].data.unshift(parseFloat(entry.temperature || entry.field2));
          chart.data.datasets[3].data.unshift(parseFloat(entry.humidity || entry.field1));
        });
        
        // Keep the chart manageable by limiting data points
        const maxPoints = 1000;
        if (chart.data.labels.length > maxPoints) {
          chart.data.labels = chart.data.labels.slice(0, maxPoints);
          chart.data.datasets.forEach(dataset => {
            dataset.data = dataset.data.slice(0, maxPoints);
          });
        }
        
        chart.update();
      } else {
        // For other visualization types, regenerate the chart
        this.loadVisualization(this.currentVizType);
      }
    } catch (error) {
      console.error('Error updating chart with new data:', error);
    }
  }
  
  /**
   * Validate data quality
   */
  validateData() {
    if (this.data.length === 0) {
      this.elements.validationBadge.className = 'badge bg-secondary';
      this.elements.validationBadge.textContent = 'No Data';
      this.elements.validationDetails.innerHTML = `<p class="text-center">No data available for validation.</p>`;
      return;
    }
    
    try {
      // Check for missing values
      const totalRecords = this.data.length;
      let missingPM25 = 0;
      let missingPM10 = 0;
      let missingTemp = 0;
      let missingHumidity = 0;
      let outOfRangePM25 = 0;
      let outOfRangePM10 = 0;
      let outOfRangeTemp = 0;
      let outOfRangeHumidity = 0;
      
      this.data.forEach(item => {
        const pm25 = parseFloat(item.pm25 || item.field3);
        const pm10 = parseFloat(item.pm10 || item.field4);
        const temp = parseFloat(item.temperature || item.field2);
        const humidity = parseFloat(item.humidity || item.field1);
        
        // Check for missing values
        if (isNaN(pm25)) missingPM25++;
        if (isNaN(pm10)) missingPM10++;
        if (isNaN(temp)) missingTemp++;
        if (isNaN(humidity)) missingHumidity++;
        
        // Check for out of range values
        if (pm25 < 0 || pm25 > 1000) outOfRangePM25++;
        if (pm10 < 0 || pm10 > 2000) outOfRangePM10++;
        if (temp < -40 || temp > 60) outOfRangeTemp++;
        if (humidity < 0 || humidity > 100) outOfRangeHumidity++;
      });
      
      // Calculate overall data quality score (0-100%)
      const missingRate = (missingPM25 + missingPM10 + missingTemp + missingHumidity) / (totalRecords * 4);
      const errorRate = (outOfRangePM25 + outOfRangePM10 + outOfRangeTemp + outOfRangeHumidity) / (totalRecords * 4);
      const qualityScore = Math.round((1 - (missingRate + errorRate) * 0.5) * 100);
      
      // Set badge class based on quality score
      let badgeClass = 'bg-success';
      if (qualityScore < 70) badgeClass = 'bg-danger';
      else if (qualityScore < 90) badgeClass = 'bg-warning';
      
      this.elements.validationBadge.className = `badge ${badgeClass}`;
      this.elements.validationBadge.textContent = `${qualityScore}% Quality`;
      
      // Show detailed validation results
      this.elements.validationDetails.innerHTML = `
        <div class="row">
          <div class="col-md-6">
            <h5>Data Completeness</h5>
            <table class="table table-sm">
              <tr>
                <td>PM2.5 Data</td>
                <td>${totalRecords - missingPM25} / ${totalRecords}</td>
                <td>${Math.round((1 - missingPM25 / totalRecords) * 100)}%</td>
              </tr>
              <tr>
                <td>PM10 Data</td>
                <td>${totalRecords - missingPM10} / ${totalRecords}</td>
                <td>${Math.round((1 - missingPM10 / totalRecords) * 100)}%</td>
              </tr>
              <tr>
                <td>Temperature Data</td>
                <td>${totalRecords - missingTemp} / ${totalRecords}</td>
                <td>${Math.round((1 - missingTemp / totalRecords) * 100)}%</td>
              </tr>
              <tr>
                <td>Humidity Data</td>
                <td>${totalRecords - missingHumidity} / ${totalRecords}</td>
                <td>${Math.round((1 - missingHumidity / totalRecords) * 100)}%</td>
              </tr>
            </table>
          </div>
          <div class="col-md-6">
            <h5>Data Validity</h5>
            <table class="table table-sm">
              <tr>
                <td>Invalid PM2.5 Values</td>
                <td>${outOfRangePM25} / ${totalRecords}</td>
                <td>${Math.round((outOfRangePM25 / totalRecords) * 100)}%</td>
              </tr>
              <tr>
                <td>Invalid PM10 Values</td>
                <td>${outOfRangePM10} / ${totalRecords}</td>
                <td>${Math.round((outOfRangePM10 / totalRecords) * 100)}%</td>
              </tr>
              <tr>
                <td>Invalid Temperature</td>
                <td>${outOfRangeTemp} / ${totalRecords}</td>
                <td>${Math.round((outOfRangeTemp / totalRecords) * 100)}%</td>
              </tr>
              <tr>
                <td>Invalid Humidity</td>
                <td>${outOfRangeHumidity} / ${totalRecords}</td>
                <td>${Math.round((outOfRangeHumidity / totalRecords) * 100)}%</td>
              </tr>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      console.error('Error validating data:', error);
      this.elements.validationBadge.className = 'badge bg-warning';
      this.elements.validationBadge.textContent = 'Validation Error';
      this.elements.validationDetails.innerHTML = `<p class="text-center text-danger">Error validating data: ${error.message}</p>`;
    }
  }
  
  /**
   * Download current data as CSV
   */
  downloadData() {
    if (!this.data || this.data.length === 0) {
      this.showToast('Error', 'No data available to download', 'danger');
      return;
    }
    
    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Timestamp,PM2.5,PM10,Temperature,Humidity\n';
    
    this.data.forEach(item => {
      const row = [
        item.created_at,
        item.pm25 || item.field3 || '',
        item.pm10 || item.field4 || '',
        item.temperature || item.field2 || '',
        item.humidity || item.field1 || ''
      ].join(',');
      csvContent += row + '\n';
    });
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `air_quality_data_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    document.body.removeChild(link);
    
    this.showToast('Download', 'Data download started successfully', 'success');
  }
}
