/**
 * Main Dashboard JavaScript
 * Controls the dashboard interface and data loading
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize dashboard
  const dashboard = new Dashboard();
  dashboard.init();

  // Add ThingSpeak info button click handler
  document.getElementById('thingspeakInfoBtn').addEventListener('click', function() {
    window.location.href = '/thingspeak-info';
  });
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
      validationDetails: document.getElementById('validation-details'),
      aqiStatusBadge: document.getElementById('aqi-status-badge'),
      aqiProgressBar: document.getElementById('aqi-progress-bar'),
      lastUpdateTime: document.getElementById('last-update-time'),
      pm25RangeBar: document.getElementById('pm25-range-bar'),
      pm10RangeBar: document.getElementById('pm10-range-bar'),
      timeFilterBtns: document.querySelectorAll('.time-filter-btn'),
      airQualityStatusCard: document.querySelector('.air-quality-status-card'),
      exportVizBtn: document.getElementById('exportVizBtn'),
      printVizBtn: document.getElementById('printVizBtn'),
      resetZoomBtn: document.getElementById('resetZoomBtn')
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

    // ThingSpeak direct load button
    document.getElementById('loadThingspeakBtn').addEventListener('click', () => {
        // Show the ThingSpeak modal
        const thingspeakModal = new bootstrap.Modal(document.getElementById('thingspeakModal'));
        thingspeakModal.show();
    });
    
    // Load ThingSpeak data button in modal
    document.getElementById('loadThingspeakDataBtn').addEventListener('click', () => {
        // Get options from modal
        const days = document.getElementById('thingspeakDays').value;
        const results = document.getElementById('thingspeakResults').value;
        const includeAnalysis = document.getElementById('thingspeakIncludeAnalysis').checked;
        
        // Hide the modal
        bootstrap.Modal.getInstance(document.getElementById('thingspeakModal')).hide();
        
        // Load data
        this.loadThingspeakDirectData(days, results, includeAnalysis);
    });

    const uploadBtn = document.getElementById('uploadDataBtn');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', () => {
        this.showToast('Upload CSV', 'CSV upload not yet implemented.', 'info');
      });
    }

    const infoBtn = document.getElementById('thingspeakInfoBtn');
    if (infoBtn) {
      infoBtn.addEventListener('click', () => {
        this.showToast('ThingSpeak Info', 'Channel details and usage instructions.', 'info');
      });
    }

    const currentAirQualityBtn = document.getElementById('currentAirQualityBtn');
    if (currentAirQualityBtn) {
      currentAirQualityBtn.addEventListener('click', async () => {
        try {
          const response = await fetch('/api/thingspeak/latest-feed');
          if (!response.ok) {
            throw new Error('Failed to fetch current air quality data');
          }
          const data = await response.json();
          if (data.success) {
            this.showToast('Current Air Quality', `PM2.5: ${data.data.pm25}, PM10: ${data.data.pm10}`, 'success');
          } else {
            this.showToast('Error', 'Failed to fetch current air quality data', 'danger');
          }
        } catch (error) {
          console.error('Error fetching current air quality:', error);
          this.showToast('Error', 'Failed to fetch current air quality data', 'danger');
        }
      });
    }
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
   * Load data from API or CSV
   */
  async loadData() {
    this.updateStatus('loading', 'Loading data...');
    
    try {
      // Use DataLoader to get data with automatic fallback
      let result;
      
      if (window.DataLoader) {
        // Use the DataLoader utility
        result = await window.DataLoader.loadData({
          filters: this.filters,
          preferredSource: 'api',  // Try API first, fall back to CSV
          useCached: false
        });
        
        this.data = result.data;
        
        // Update status with data source info
        const sourceLabel = result.source === 'api' ? 'API' : 'Local CSV';
        this.updateStatus(
          result.source === 'api' ? 'connected' : 'warning',
          `Data source: ${sourceLabel} (${this.formatTime(result.timestamp)})`
        );
        
        // Show a toast if using fallback data
        if (result.source === 'csv' && result.error) {
          this.showToast(
            'Using Offline Data', 
            'Could not connect to API. Using local data instead.',
            'warning'
          );
        }
      } else {
        // Fallback if DataLoader isn't available
        // First try the API
        try {
          const response = await fetch('/api/data?results=100');
          if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
          }
          const apiResult = await response.json();
          
          this.data = apiResult.data.data?.feeds || [];
          this.updateStatus('connected', `Updated: ${this.formatTime(new Date())}`);
        } catch (apiError) {
          // API failed, try to load default CSV
          console.warn('API failed, loading from CSV:', apiError);
          try {
            const csvResponse = await fetch('/data/feeds.csv');
            if (!csvResponse.ok) {
              throw new Error('CSV file not found');
            }
            
            const csvText = await csvResponse.text();
            const csvData = window.CsvParser ? 
              window.CsvParser.parse(csvText) : 
              this.parseSimpleCsv(csvText);
            
            // Format CSV data to match expected format
            this.data = csvData.map((row, index) => {
              return {
                created_at: row.timestamp || new Date().toISOString(),
                entry_id: row.entry_id || index + 1,
                field1: row.humidity || row.field1 || null,
                field2: row.temperature || row.field2 || null,
                field3: row.pm25 || row.field3 || null,
                field4: row.pm10 || row.field4 || null,
                humidity: row.humidity || row.field1 || null,
                temperature: row.temperature || row.field2 || null,
                pm25: row.pm25 || row.field3 || null,
                pm10: row.pm10 || row.field4 || null
              };
            });
            
            this.updateStatus('warning', `Using local data: ${this.formatTime(new Date())}`);
            this.showToast('Using Offline Data', 'Could not connect to API. Using local data instead.', 'warning');
          } catch (csvError) {
            // Both API and CSV failed
            console.error('Both API and CSV data sources failed', csvError);
            throw new Error('Failed to load data from any source');
          }
        }
      }
      
      // Check if we have data
      if (this.data.length === 0) {
        this.showNoDataMessage();
        this.updateStatus('warning', 'No data available');
        return [];
      }
      
      this.pagination.totalItems = this.data.length;
      this.lastEntryId = this.data[0]?.entry_id || 0;
      this.lastUpdated = new Date();
      
      // Set the full dataset in VizLoader for all visualizations
      if (window.VizLoader && this.data.length > 0) {
        window.VizLoader.setFullDataset(this.data);
      }
      
      this.updateDataTable();
      this.updateStatistics();
      this.validateData();
      
      // If we're using DataLoader, update the data source indicator
      if (window.DataLoader) {
        this.updateDataSourceIndicator();
      }
      
      return this.data;
    } catch (error) {
      console.error('Error loading data:', error);
      this.updateStatus('error', 'Error loading data');
      
      if (window.ErrorHandler) {
        // Format and display the error with recovery options
        const { message, details } = window.ErrorHandler.formatApiError(error);
        window.ErrorHandler.showErrorToast(message, 'connection', {
          details: details,
          autoHide: false
        });
        
        // Show error in the visualization container
        window.ErrorHandler.showError(this.elements.vizContainer, message, 'data', {
          retryFn: () => this.loadData(),
          title: 'Data Loading Error'
        });
        
        // Show error in the data table
        this.elements.dataTableBody.innerHTML = `
          <tr><td colspan="5" class="text-center">
            ${window.ErrorHandler.createErrorHTML(message, 'data', {
              retryFn: () => this.loadData()
            })}
          </td></tr>`;
      } else {
        // Fallback to simpler error handling
        this.showToast('Error', `Failed to load data: ${error.message}`, 'danger');
        this.elements.vizContainer.innerHTML = `
          <div class="alert alert-danger">
            <h5>Data Loading Error</h5>
            <p>${error.message}</p>
            <button class="btn btn-danger btn-sm" onclick="location.reload()">Retry</button>
          </div>`;
        this.elements.dataTableBody.innerHTML = `
          <tr><td colspan="5" class="text-center text-danger">Failed to load data</td></tr>`;
      }
      
      throw error;
    }
  }

  /**
   * Load data directly from ThingSpeak
   */
  async loadThingspeakDirectData(days, results, includeAnalysis) {
    this.updateStatus('loading', 'Loading data from ThingSpeak...');
    
    try {
      // Use ThingSpeakHelper if available
      let response;
      if (window.ThingSpeakHelper) {
        response = await window.ThingSpeakHelper.fetchTimePeriod(days, results, includeAnalysis);
      } else {
        // Fallback to direct API call
        const url = `/api/thingspeak/direct?days=${days}&results=${results}&analysis=${includeAnalysis}`;
        const fetchResponse = await fetch(url);
        
        if (!fetchResponse.ok) {
          throw new Error(`API returned ${fetchResponse.status}: ${fetchResponse.statusText}`);
        }
        
        response = await fetchResponse.json();
      }
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Invalid response from server');
      }
      
      // Update data
      this.data = response.data.data || [];
      
      if (this.data.length === 0) {
        this.showNoDataMessage();
        this.updateStatus('warning', 'No ThingSpeak data available');
        return;
      }
      
      this.pagination.totalItems = this.data.length;
      this.lastEntryId = this.data[0]?.entry_id || 0;
      this.lastUpdated = new Date();
      
      // Update UI
      this.updateStatus('connected', `ThingSpeak data loaded (${this.data.length} points)`);
      this.updateDataTable();
      this.updateStatistics();
      this.loadVisualization(this.currentVizType);
      
      // Show success message
      this.showToast('ThingSpeak Data', `Successfully loaded ${this.data.length} data points from ThingSpeak channel ${response.data.channel?.id || '2863798'}`, 'success');
      
      // Show analysis if available
      if (response.data.analysis) {
        this.showAnalysisResults(response.data.analysis);
      }
    } catch (error) {
      console.error('Error loading ThingSpeak data:', error);
      this.updateStatus('error', 'Error loading ThingSpeak data');
      
      // Show error message
      this.showToast('ThingSpeak Error', `Failed to load data: ${error.message}`, 'danger');
    }
  }

  /**
   * Show analysis results
   */
  showAnalysisResults(analysis) {
    // Display analysis in validation section
    const validationDetails = document.getElementById('validation-details');
    const validationBadge = document.getElementById('validation-badge');
    
    if (validationDetails && analysis) {
        let analysisHtml = `
            <h5 class="mb-3">Data Analysis Results</h5>
            <div class="row">
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">PM2.5 Analysis</div>
                        <div class="card-body">
                            <p><strong>Average:</strong> ${analysis.average_pm25 || analysis.averages?.pm25 || 'N/A'} μg/m³</p>
                            <p><strong>Range:</strong> ${analysis.min_pm25 || analysis.min?.pm25 || 'N/A'} - ${analysis.max_pm25 || analysis.max?.pm25 || 'N/A'} μg/m³</p>
                            <p><strong>Standard Deviation:</strong> ${analysis.stddev_pm25 || analysis.stdDev?.pm25 || 'N/A'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card mb-3">
                        <div class="card-header">PM10 Analysis</div>
                        <div class="card-body">
                            <p><strong>Average:</strong> ${analysis.average_pm10 || analysis.averages?.pm10 || 'N/A'} μg/m³</p>
                            <p><strong>Range:</strong> ${analysis.min_pm10 || analysis.min?.pm10 || 'N/A'} - ${analysis.max_pm10 || analysis.max?.pm10 || 'N/A'} μg/m³</p>
                            <p><strong>Standard Deviation:</strong> ${analysis.stddev_pm10 || analysis.stdDev?.pm10 || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        validationDetails.innerHTML = analysisHtml;
        
        // Update badge based on PM2.5 levels (WHO guidelines)
        const pm25Level = analysis.average_pm25 || analysis.averages?.pm25 || 0;
        if (pm25Level <= 10) {
            validationBadge.className = 'badge bg-success';
            validationBadge.textContent = 'Good';
        } else if (pm25Level <= 25) {
            validationBadge.className = 'badge bg-warning';
            validationBadge.textContent = 'Moderate';
        } else if (pm25Level <= 50) {
            validationBadge.className = 'badge bg-danger';
            validationBadge.textContent = 'Unhealthy';
        } else {
            validationBadge.className = 'badge bg-dark';
            validationBadge.textContent = 'Very Unhealthy';
        }
    }
  }

  /**
   * Simple CSV parsing function (fallback if CsvParser not available)
   * @param {string} csvText - Raw CSV text
   * @returns {Array} Array of objects representing CSV rows
   */
  parseSimpleCsv(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(val => val.trim());
      const row = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      return row;
    });
  }

  /**
   * Update data source indicator in the UI
   */
  updateDataSourceIndicator() {
    // Only proceed if DataLoader is available
    if (!window.DataLoader) return;
    
    const sourceInfo = window.DataLoader.getDataSourceInfo();
    const sourceLabel = sourceInfo.currentSource === 'api' ? 'API' : 'Local CSV';
    const lastUpdate = sourceInfo.currentSource === 'api' ? 
      sourceInfo.lastApiUpdate : sourceInfo.lastCsvUpdate;
    
    // Add or update the data source badge
    if (!this.elements.dataSourceBadge) {
      // Create the badge if it doesn't exist
      const statusText = document.getElementById('status-text');
      if (statusText && statusText.parentNode) {
        const badge = document.createElement('span');
        badge.className = `badge ms-2 ${sourceInfo.currentSource === 'api' ? 'bg-success' : 'bg-warning'}`;
        badge.textContent = sourceLabel;
        badge.style.fontSize = '0.75rem';
        statusText.parentNode.appendChild(badge);
        this.elements.dataSourceBadge = badge;
        
        // Add click handler to toggle data source
        badge.style.cursor = 'pointer';
        badge.setAttribute('title', 'Click to toggle data source');
        badge.addEventListener('click', () => this.toggleDataSource());
      }
    } else {
      // Update existing badge
      this.elements.dataSourceBadge.className = `badge ms-2 ${sourceInfo.currentSource === 'api' ? 'bg-success' : 'bg-warning'}`;
      this.elements.dataSourceBadge.textContent = sourceLabel;
    }
    
    // Update status text with last update time
    if (lastUpdate) {
      document.getElementById('status-text').textContent = 
        `Updated: ${this.formatTime(new Date(lastUpdate))}`;
    }
  }

  /**
   * Toggle between API and CSV data sources
   */
  toggleDataSource() {
    if (!window.DataLoader) return;
    
    const sourceInfo = window.DataLoader.getDataSourceInfo();
    const newSource = sourceInfo.currentSource === 'api' ? 'csv' : 'api';
    
    // Set the new source
    window.DataLoader.setDataSource(newSource);
    
    // Reload data with the new source
    this.loadData().catch(error => {
      console.error('Error toggling data source:', error);
      
      // Show error
      this.showToast('Error', `Failed to load data from ${newSource.toUpperCase()}`, 'danger');
      
      // Switch back to the previous source if the new one failed
      window.DataLoader.setDataSource(sourceInfo.currentSource);
    });
  }

  /**
   * Show a message when no data is available
   */
  showNoDataMessage() {
    // Display a helpful message in the visualization container
    if (window.ErrorHandler) {
      window.ErrorHandler.showError(this.elements.vizContainer, 
        'No data is available for the selected filters.', 
        'data',
        {
          title: 'No Data Available',
          retryFn: () => {
            // Clear filters and try again
            this.filters.startDate = null;
            this.filters.endDate = null;
            this.loadData();
          }
        }
      );
    } else {
      this.elements.vizContainer.innerHTML = `
        <div class="alert alert-warning">
          <h5>No Data Available</h5>
          <p>No data is available for the selected filters.</p>
          <button class="btn btn-warning btn-sm" onclick="location.reload()">Reset Filters</button>
        </div>`;
    }
    
    // Clear data table
    this.elements.dataTable.innerHTML = `
      <tr><td colspan="5" class="text-center">No data available</td></tr>`;
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
   * @param {number} pm25 - PM2.5 value to use for AQI calculation
   */
  updateAQIBadges(pm25) {
    // Simple AQI classification based on PM2.5 (expanded for UI integration)
    let aqiClass = 'bg-success', aqiText = 'Good', progressPercent = 0, statusCardClass = '';
    if (pm25 <= 12) {
      aqiClass = 'bg-success'; aqiText = 'Good'; progressPercent = (pm25 / 12) * 20; statusCardClass = '';
    } else if (pm25 <= 35.4) {
      aqiClass = 'bg-warning'; aqiText = 'Moderate'; progressPercent = 20 + ((pm25 - 12) / (35.4 - 12)) * 20; statusCardClass = 'warning';
    } else if (pm25 <= 55.4) {
      aqiClass = 'bg-warning text-dark'; aqiText = 'Unhealthy for Sensitive Groups'; progressPercent = 40 + ((pm25 - 35.4) / (55.4 - 35.4)) * 20; statusCardClass = 'warning';
    } else if (pm25 <= 150.4) {
      aqiClass = 'bg-danger'; aqiText = 'Unhealthy'; progressPercent = 60 + ((pm25 - 55.4) / (150.4 - 55.4)) * 20; statusCardClass = 'danger';
    } else {
      aqiClass = 'bg-dark'; aqiText = 'Hazardous'; progressPercent = 80 + Math.min(20, ((pm25 - 150.4) / 100) * 20); statusCardClass = 'hazard';
    }
    
    // Add the badge near PM2.5 value
    const badge = `<span class="ms-2 badge ${aqiClass}">${aqiText}</span>`;
    this.elements.avgPM25.innerHTML = `${parseFloat(this.elements.avgPM25.textContent).toFixed(2)}${badge}`;
    
    // Update AQI status badge
    const aqiStatusBadge = document.getElementById('aqi-status-badge');
    if (aqiStatusBadge) {
      aqiStatusBadge.className = `badge ${aqiClass}`;
      aqiStatusBadge.textContent = aqiText;
    }
    
    // Update AQI progress bar
    const aqiProgressBar = document.getElementById('aqi-progress-bar');
    if (aqiProgressBar) {
      aqiProgressBar.style.width = `${progressPercent}%`;
      aqiProgressBar.className = 'progress-bar';
      if (aqiClass.includes('bg-success')) aqiProgressBar.classList.add('bg-success');
      else if (aqiClass.includes('bg-warning')) aqiProgressBar.classList.add('bg-warning');
      else if (aqiClass.includes('bg-danger')) aqiProgressBar.classList.add('bg-danger');
      else aqiProgressBar.classList.add('bg-dark');
    }
    
    // Update air quality status card border
    const airQualityStatusCard = document.querySelector('.air-quality-status-card');
    if (airQualityStatusCard) {
      airQualityStatusCard.className = 'card air-quality-status-card';
      if (statusCardClass) airQualityStatusCard.classList.add(statusCardClass);
    }
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
    const containerId = 'visualization-container';
    
    // Clear previous chart if it exists
    if (this.activeChart) {
      if (typeof this.activeChart.destroy === 'function') {
        this.activeChart.destroy();
      }
      this.activeChart = null;
    }
    
    // Clear canvas and create a new one
    this.elements.vizContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = `${type}-chart`;
    this.elements.vizContainer.appendChild(canvas);
    
    switch (type) {
      case 'time_series':
        title = 'Time Series Visualization';
        this.elements.vizDescription.textContent = 'Shows PM2.5, PM10, Temperature and Humidity measurements over time.';
        
        // Use the VizLoader for lazy loading
        this.activeChart = window.AirQualityViz.createTimeSeriesVisualization(
          canvas.id,
          this.data,
          {theme: ThemeManager.getCurrentTheme()}
        );
        break;
        
      case 'daily_pattern':
        title = 'Daily Pattern Analysis';
        this.elements.vizDescription.textContent = 'Shows average PM2.5 and PM10 levels by hour of day.';
        
        this.activeChart = window.AirQualityViz.createDailyPatternVisualization(
          canvas.id,
          this.data,
          {theme: ThemeManager.getCurrentTheme()}
        );
        break;
        
      case 'heatmap':
        title = 'Pollution Heatmap';
        this.elements.vizDescription.textContent = 'Visualizes PM2.5 pollution intensity over time.';
        
        this.activeChart = window.AirQualityViz.createHeatmapVisualization(
          canvas.id,
          this.data,
          {theme: ThemeManager.getCurrentTheme()}
        );
        break;
        
      case 'correlation':
        title = 'Parameter Correlation';
        this.elements.vizDescription.textContent = 'Shows relationships between different air quality parameters.';
        
        this.activeChart = window.AirQualityViz.createCorrelationVisualization(
          canvas.id,
          this.data,
          {theme: ThemeManager.getCurrentTheme()}
        );
        break;
        
      default:
        title = 'Time Series Visualization';
        this.elements.vizDescription.textContent = 'Shows PM2.5, PM10, Temperature and Humidity measurements over time.';
        
        this.activeChart = window.AirQualityViz.createTimeSeriesVisualization(
          canvas.id,
          this.data,
          {theme: ThemeManager.getCurrentTheme()}
        );
    }
    
    this.elements.vizTitle.textContent = title;
    this.currentVizType = type;
  }
  
  /**
   * Show toast notification
   */
  showToast(title, message, type = 'info') {
    // Use the ErrorHandler for consistent toast styling if available
    if (window.ErrorHandler && type === 'danger') {
      window.ErrorHandler.showErrorToast(message, 'default', { title });
      return;
    }
    
    // Original toast implementation
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
    const newTheme = ThemeManager.toggleTheme();
    
    // If there's an active chart, recreate it with the new theme
    if (this.activeChart) {
      this.loadVisualization(this.currentVizType);
    }
    
    // Update extended visualizations if they are displayed
    if (!this.elements.vizGallery.classList.contains('d-none')) {
      window.VizLoader.updateVisibility();
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
    const galleryItems = [
      { id: 'pm25-trend', title: 'PM2.5 Trend Analysis', type: 'line' },
      { id: 'temp-humidity-correlation', title: 'Temperature vs. Humidity', type: 'scatter' },
      { id: 'hourly-distribution', title: 'Hourly Distribution', type: 'bar' },
      { id: 'daily-averages', title: 'Daily Averages', type: 'bar' }
    ];
    
    // Create gallery containers
    this.elements.vizGallery.innerHTML = galleryItems.map(item => `
      <div class="col-md-6 mb-4">
        <div class="card">
          <div class="card-header">${item.title}</div>
          <div class="card-body" style="height: 300px;">
            <div id="${item.id}-chart" class="h-100"></div>
          </div>
        </div>
      </div>
    `).join('');
    
    // Use lazy loading for the extended visualizations
    this.renderExtendedViz();
  }

  /**
   * Render extended visualizations
   */
  renderExtendedViz() {
    if (this.data.length === 0) return;
    
    // Use the AirQualityViz global object if available
    if (window.AirQualityViz) {
      const theme = ThemeManager.getCurrentTheme();
      
      // Create PM2.5 trend chart using lazy loading
      window.VizLoader.observeChart(
        'pm25-trend-chart',
        (canvasId, data) => window.AirQualityViz.createTrendVisualization(
          canvasId,
          data,
          { parameter: 'pm25', title: 'PM2.5 Trend Analysis', theme }
        ),
        this.data
      );
      
      // Create temperature vs humidity correlation chart
      window.VizLoader.observeChart(
        'temp-humidity-correlation-chart',
        (canvasId, data) => window.AirQualityViz.createCorrelationVisualization(
          canvasId,
          data,
          { xAxis: 'temperature', yAxis: 'humidity', title: 'Temperature vs. Humidity', theme }
        ),
        this.data
      );
      
      // Create hourly distribution chart
      window.VizLoader.observeChart(
        'hourly-distribution-chart',
        () => this.createHourlyDistributionChart(),
        null
      );
      
      // Create daily averages chart
      window.VizLoader.observeChart(
        'daily-averages-chart',
        () => this.createDailyAveragesChart(),
        null
      );
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
      this.elements.validationBadge.className = 'badge bg-danger';
      this.elements.validationBadge.textContent = 'Validation Error';
      this.elements.validationDetails.innerHTML = `<p class="text-center text-danger">Error validating data.</p>`;
    }
  }
}
