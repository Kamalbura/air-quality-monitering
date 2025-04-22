/**
 * Enhanced dashboard with real-time updates, improved UX and better memory management
 */
document.addEventListener('DOMContentLoaded', function() {
  // State management
  const appState = {
    lastEntryId: 0,
    realtimeEnabled: true,
    updateInterval: null,
    darkMode: localStorage.getItem('darkMode') === 'true',
    charts: {},
    failedUpdateAttempts: 0,
    isVisible: true,
    currentVizType: 'time_series',
    dataTablePage: 1,
    dataTableLimit: 10
  };
  
  // Handle page visibility changes
  document.addEventListener('visibilitychange', function() {
    appState.isVisible = !document.hidden;
    
    if (appState.isVisible) {
      console.log('Page is now visible, updating data...');
      loadData();
      loadAnalysis();
      
      if (appState.realtimeEnabled) {
        initializeRealtimeUpdates();
      }
    } else {
      console.log('Page is now hidden, pausing updates');
      clearInterval(appState.updateInterval);
    }
  });

  // Initialize date picker with better defaults
  const dateRangePicker = flatpickr('#dateRange', {
    mode: 'range',
    dateFormat: 'Y-m-d',
    defaultDate: [
      new Date(new Date().setDate(new Date().getDate() - 7)),
      new Date()
    ],
    maxDate: new Date(),
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) {
        console.log('Date range selected:', selectedDates);
      }
    }
  });
  
  // Initialize time picker
  const timePicker = flatpickr('#timeFilter', {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    defaultDate: "12:00",
    time_24hr: true
  });
  
  // Initialize tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Set up event listeners
  document.getElementById('applyDateFilter').addEventListener('click', function() {
    const dates = dateRangePicker.selectedDates;
    if (dates.length === 2) {
      const startDate = formatDate(dates[0]);
      const endDate = formatDate(dates[1]);
      loadDataByDateRange(startDate, endDate);
      loadAnalysisByDateRange(startDate, endDate);
      loadVisualization(appState.currentVizType, {startDate, endDate});
    }
  });
  
  document.getElementById('applyTimeFilter').addEventListener('click', function() {
    const time = timePicker.selectedDates[0];
    if (time) {
      const timeString = formatTime(time);
      loadDataByTime(timeString);
    }
  });
  
  document.getElementById('toggleTheme').addEventListener('click', function() {
    appState.darkMode = !appState.darkMode;
    localStorage.setItem('darkMode', appState.darkMode);
    applyTheme();
  });
  
  document.getElementById('realtimeSwitch').addEventListener('change', function() {
    appState.realtimeEnabled = this.checked;
    if (appState.realtimeEnabled) {
      initializeRealtimeUpdates();
      showToast('Real-time updates enabled', 'info');
    } else {
      clearInterval(appState.updateInterval);
      showToast('Real-time updates disabled', 'info');
    }
  });
  
  // Set up visualization switch handlers
  const vizLinks = document.querySelectorAll('.viz-link');
  vizLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      vizLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');
      
      const vizType = this.getAttribute('data-type');
      appState.currentVizType = vizType;
      
      // Update visualization title
      const vizTitles = {
        'time_series': 'Time Series Visualization',
        'daily_pattern': 'Daily Pattern Analysis',
        'heatmap': 'Weekly Heatmap Analysis',
        'correlation': 'Environmental Correlation Analysis'
      };
      document.getElementById('vizTitle').textContent = vizTitles[vizType] || 'Visualization';
      
      // Get current date range if exists
      const dates = dateRangePicker.selectedDates;
      let options = {};
      if (dates.length === 2) {
        options.startDate = formatDate(dates[0]);
        options.endDate = formatDate(dates[1]);
      }
      
      loadVisualization(vizType, options);
    });
  });
  
  // Data table navigation
  document.getElementById('prev-page').addEventListener('click', function() {
    if (appState.dataTablePage > 1) {
      appState.dataTablePage--;
      loadDataTable(appState.dataTablePage);
    }
  });
  
  document.getElementById('next-page').addEventListener('click', function() {
    appState.dataTablePage++;
    loadDataTable(appState.dataTablePage);
  });
  
  document.getElementById('refreshTable').addEventListener('click', function() {
    loadDataTable(appState.dataTablePage);
  });
  
  document.getElementById('refreshViz').addEventListener('click', function() {
    // Get current date range if exists
    const dates = dateRangePicker.selectedDates;
    let options = {};
    if (dates.length === 2) {
      options.startDate = formatDate(dates[0]);
      options.endDate = formatDate(dates[1]);
    }
    
    loadVisualization(appState.currentVizType, options);
  });
  
  // Apply theme on load
  applyTheme();
  
  // Load initial data with explicit debug messages
  console.log("Starting to load initial dashboard data");
  loadAnalysis();
  loadData();
  loadVisualization('time_series');
  loadDataSource();
  loadDataTable(1);
  validateData();
  initializeRealtimeUpdates();
  
  /**
   * Load basic analysis data (averages, min, max)
   */
  function loadAnalysis(options = {}) {
    console.log("Loading analysis data");
    const queryParams = new URLSearchParams({ quick: 'true', ...options }).toString();
    
    fetch(`/api/analysis?${queryParams}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          console.log("Analysis data loaded successfully", data);
          
          // Update the UI with analysis results - add explicit fallbacks for all values
          document.getElementById('avgPM25').textContent = formatValue(data.average_pm25 || 0);
          document.getElementById('avgPM10').textContent = formatValue(data.average_pm10 || 0);
          document.getElementById('avgTemp').textContent = formatValue(data.average_temperature || 0);
          document.getElementById('avgHumidity').textContent = formatValue(data.average_humidity || 0);
          
          // Update peak and low values with fallbacks
          document.getElementById('peakPM25').textContent = formatValue(data.max_pm25 || 0);
          document.getElementById('peakPM10').textContent = formatValue(data.max_pm10 || 0);
          document.getElementById('lowPM25').textContent = formatValue(data.min_pm25 || 0);
          document.getElementById('lowPM10').textContent = formatValue(data.min_pm10 || 0);
        } else {
          console.error("Failed to load analysis data:", data.error);
          showToast('Error loading analysis data', 'error');
          
          // Set default values on failure
          document.getElementById('avgPM25').textContent = '--';
          document.getElementById('avgPM10').textContent = '--';
          document.getElementById('peakPM25').textContent = '--';
          document.getElementById('peakPM10').textContent = '--';
          document.getElementById('lowPM25').textContent = '--';
          document.getElementById('lowPM10').textContent = '--';
        }
      })
      .catch(error => {
        console.error("Error in analysis data fetch:", error);
        showToast('Error fetching analysis data', 'error');
        
        // Set default values on error
        document.getElementById('avgPM25').textContent = '--';
        document.getElementById('avgPM10').textContent = '--';
        document.getElementById('peakPM25').textContent = '--';
        document.getElementById('peakPM10').textContent = '--';
        document.getElementById('lowPM25').textContent = '--';
        document.getElementById('lowPM10').textContent = '--';
      });
  }
  
  /**
   * Load analysis by date range
   */
  function loadAnalysisByDateRange(startDate, endDate) {
    loadAnalysis({ startDate, endDate });
  }
  
  /**
   * Load current data
   */
  function loadData() {
    console.log("Loading current data");
    
    fetch('/api/data?results=10')
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          console.log("Data loaded successfully");
          
          // Update the latest entry ID for realtime updates
          const data = result.data.data;
          if (data && data.length > 0) {
            // Get the highest entry ID
            const highestId = Math.max(...data.map(item => parseInt(item.entry_id) || 0));
            if (highestId > appState.lastEntryId) {
              appState.lastEntryId = highestId;
              console.log("Updated last entry ID:", appState.lastEntryId);
            }
          }
          
          // Update connection status
          document.getElementById('status-indicator').className = 'status-indicator connected';
          document.getElementById('status-text').textContent = 'Connected';
        } else {
          console.error("Failed to load data:", result.error);
          
          // Update connection status
          document.getElementById('status-indicator').className = 'status-indicator error';
          document.getElementById('status-text').textContent = 'Connection Error';
        }
      })
      .catch(error => {
        console.error("Error in data fetch:", error);
        
        // Update connection status
        document.getElementById('status-indicator').className = 'status-indicator disconnected';
        document.getElementById('status-text').textContent = 'Disconnected';
      });
  }
  
  /**
   * Load data by date range
   */
  function loadDataByDateRange(startDate, endDate) {
    console.log(`Loading data for range: ${startDate} to ${endDate}`);
    
    // Update the visualization and data table
    loadDataTable(1, { startDate, endDate });
  }
  
  /**
   * Load data by time
   */
  function loadDataByTime(time) {
    console.log(`Loading data for time: ${time}`);
    
    fetch(`/api/data/time?startTime=${time}&endTime=${time}`)
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          console.log(`Found ${result.data.data.length} records at time ${time}`);
          loadDataTable(1, { time });
        } else {
          console.error("Failed to load data by time:", result.error);
          showToast(`No data found at time ${time}`, 'warning');
        }
      })
      .catch(error => {
        console.error("Error in time-based fetch:", error);
        showToast('Error fetching time-based data', 'error');
      });
  }
  
  /**
   * Load data table
   */
  function loadDataTable(page = 1, filters = {}) {
    console.log(`Loading data table, page ${page}`);
    appState.dataTablePage = page;
    
    // Build query parameters
    let params = new URLSearchParams({
      page: page,
      limit: appState.dataTableLimit
    });
    
    // Add any filters
    if (filters.startDate && filters.endDate) {
      params.append('startDate', filters.startDate);
      params.append('endDate', filters.endDate);
    }
    
    if (filters.time) {
      params.append('startTime', filters.time);
      params.append('endTime', filters.time);
    }
    
    // Show loading state
    document.getElementById('data-table-body').innerHTML = 
      '<tr><td colspan="5" class="text-center"><div class="spinner-border spinner-border-sm" role="status"></div> Loading...</td></tr>';
    
    fetch(`/api/data?${params.toString()}`)
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data && result.data.data) {
          const data = result.data.data;
          const tableBody = document.getElementById('data-table-body');
          
          if (data.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
            document.getElementById('data-table-info').textContent = 'No records found';
            return;
          }
          
          tableBody.innerHTML = '';
          
          data.forEach(item => {
            const row = document.createElement('tr');
            
            // Format timestamp
            const date = new Date(item.created_at);
            const formattedDate = date.toLocaleString();
            
            row.innerHTML = `
              <td>${formattedDate}</td>
              <td>${formatValue(item.pm25 || item.field3)}</td>
              <td>${formatValue(item.pm10 || item.field4)}</td>
              <td>${formatValue(item.temperature || item.field2)}</td>
              <td>${formatValue(item.humidity || item.field1)}</td>
            `;
            
            tableBody.appendChild(row);
          });
          
          // Update pagination info
          const pagination = result.data.pagination || {};
          document.getElementById('data-table-info').textContent = 
            `Showing ${data.length} records of ${pagination.total || 'unknown'} total`;
          
          // Update pagination buttons
          document.getElementById('prev-page').disabled = page <= 1;
          document.getElementById('next-page').disabled = !pagination.total || (page * appState.dataTableLimit) >= pagination.total;
          
        } else {
          console.error("Failed to load data table:", result.error);
          document.getElementById('data-table-body').innerHTML = 
            '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
        }
      })
      .catch(error => {
        console.error("Error in data table fetch:", error);
        document.getElementById('data-table-body').innerHTML = 
          '<tr><td colspan="5" class="text-center text-danger">Connection error</td></tr>';
      });
  }
  
  /**
   * Load data source info
   */
  function loadDataSource() {
    fetch('/api/data-source')
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          const source = result.data.dataSource;
          console.log("Data source info:", source);
        } else {
          console.error("Failed to load data source:", result.error);
        }
      })
      .catch(error => {
        console.error("Error fetching data source:", error);
      });
  }
  
  /**
   * Validate data quality
   */
  function validateData() {
    console.log("Validating data quality");
    
    fetch('/api/validate')
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          const data = result.data;
          const badge = document.getElementById('validation-badge');
          const detailsContainer = document.getElementById('validation-details');
          
          // Update badge
          if (data.valid) {
            badge.className = 'badge bg-success';
            badge.textContent = 'Valid';
          } else {
            badge.className = 'badge bg-warning';
            badge.textContent = 'Issues Found';
          }
          
          // Update details
          let detailsHtml = '';
          
          if (data.valid) {
            detailsHtml = `
              <div class="alert alert-success">
                <h5><i class="bi bi-check-circle"></i> Data validation successful</h5>
                <p>All ${data.recordCount} records were found to be valid and complete.</p>
                <div class="progress mb-2">
                  <div class="progress-bar bg-success" role="progressbar" style="width: ${data.completion}%" aria-valuenow="${data.completion}" aria-valuemin="0" aria-valuemax="100">
                    ${data.completion}% Complete
                  </div>
                </div>
                <p class="mb-0">Field Coverage:</p>
                <ul>
                  <li>PM2.5: ${data.fieldStatistics.field3_coverage}%</li>
                  <li>PM10: ${data.fieldStatistics.field4_coverage}%</li>
                  <li>Temperature: ${data.fieldStatistics.field2_coverage}%</li>
                  <li>Humidity: ${data.fieldStatistics.field1_coverage}%</li>
                </ul>
              </div>
            `;
          } else {
            detailsHtml = `
              <div class="alert alert-warning">
                <h5><i class="bi bi-exclamation-triangle"></i> Data validation issues found</h5>
                <p>${data.validRecords} of ${data.recordCount} records (${data.completion}%) are valid and complete.</p>
                <div class="progress mb-2">
                  <div class="progress-bar bg-warning" role="progressbar" style="width: ${data.completion}%" aria-valuenow="${data.completion}" aria-valuemin="0" aria-valuemax="100">
                    ${data.completion}% Complete
                  </div>
                </div>
                <p>Issues found:</p>
                <ul>
                  ${data.issues.map(issue => `<li>${issue}</li>`).join('')}
                </ul>
              </div>
            `;
          }
          
          detailsContainer.innerHTML = detailsHtml;
        } else {
          console.error("Failed to validate data:", result.error);
          document.getElementById('validation-badge').className = 'badge bg-danger';
          document.getElementById('validation-badge').textContent = 'Error';
          document.getElementById('validation-details').innerHTML = 
            '<div class="alert alert-danger">Error validating data. The validation service may be unavailable.</div>';
        }
      })
      .catch(error => {
        console.error("Error in data validation:", error);
        document.getElementById('validation-badge').className = 'badge bg-danger';
        document.getElementById('validation-badge').textContent = 'Error';
        document.getElementById('validation-details').innerHTML = 
          '<div class="alert alert-danger">Connection error while validating data.</div>';
      });
  }
  
  /**
   * Load visualization
   */
  function loadVisualization(type = 'time_series', options = {}) {
    console.log(`Loading visualization: ${type}`);
    document.getElementById('viz-description').textContent = 'Loading visualization...';
    
    const vizContainer = document.getElementById('visualization-container');
    vizContainer.innerHTML = `
      <div class="d-flex justify-content-center align-items-center h-100">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
      </div>
    `;
    
    // Build query parameters
    const params = new URLSearchParams({ ...options });
    
    // Direct path loading for standard visualizations
    if (type === 'time_series' || type === 'pm25_trend') {
      // Add debug logging to help troubleshoot
      console.log(`Fetching standard visualization: ${type} with params:`, options);
      console.log(`Endpoint URL: /api/visualizations/standard?${params.toString()}`);
      
      fetch(`/api/visualizations/standard?${params.toString()}`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
          return response.json();
        })
        .then(result => {
          console.log("Visualization result:", result);
          
          if (result.success && result.data) {
            let imageUrl = result.data.timeSeries;
            if (type === 'pm25_trend' && result.data.pm25Trend) {
              imageUrl = result.data.pm25Trend;
            }
            
            // Verify image exists by trying to load it first
            const img = new Image();
            img.onload = function() {
              // Image exists and loaded successfully
              vizContainer.innerHTML = `<img src="${imageUrl}" class="img-fluid" alt="${type} visualization">`;
              
              // Set description based on statistics
              const stats = result.data.stats || {};
              let description = '';
              if (type === 'time_series') {
                description = `Time series analysis of air quality data`;
                if (stats.date_range) {
                  description += ` from ${stats.date_range.start || 'N/A'} to ${stats.date_range.end || 'N/A'}.`;
                }
                if (stats.average_pm25 !== undefined) {
                  description += ` Average PM2.5: ${Number(stats.average_pm25).toFixed(2)} μg/m³,`;
                }
                if (stats.average_pm10 !== undefined) {
                  description += ` Average PM10: ${Number(stats.average_pm10).toFixed(2)} μg/m³.`;
                }
              } else {
                description = `PM2.5 trend analysis with rolling average.`;
                if (stats.min_pm25 !== undefined && stats.max_pm25 !== undefined) {
                  description += ` Range: ${Number(stats.min_pm25).toFixed(2)} to ${Number(stats.max_pm25).toFixed(2)} μg/m³.`;
                }
              }
              
              document.getElementById('viz-description').textContent = description;
              
              // Update dashboard stats
              updateDashboardStats(stats);
            };
            
            img.onerror = function() {
              // Image failed to load
              console.error(`Failed to load image: ${imageUrl}`);
              vizContainer.innerHTML = `
                <div class="alert alert-warning">
                  <h5>Visualization Not Available</h5>
                  <p>The generated image could not be loaded. The file may be missing or corrupted.</p>
                  <p>Try refreshing the visualization or check server logs.</p>
                  <p>Path: ${imageUrl}</p>
                </div>
              `;
              document.getElementById('viz-description').textContent = 'Error loading visualization image.';
            };
            
            // Start the image loading
            img.src = imageUrl;
          } else {
            vizContainer.innerHTML = `
              <div class="alert alert-danger">
                <h5>Visualization Error</h5>
                <p>${result.error || 'Failed to load visualization'}</p>
                <p>Details: ${JSON.stringify(result.error || {})}</p>
              </div>
            `;
            document.getElementById('viz-description').textContent = 'Error loading visualization.';
          }
        })
        .catch(error => {
          console.error("Error in visualization fetch:", error);
          vizContainer.innerHTML = `
            <div class="alert alert-danger">
              <h5>Connection Error</h5>
              <p>Could not connect to visualization service: ${error.message}</p>
              <p>Make sure Python is running and the server is set up correctly</p>
            </div>
          `;
          document.getElementById('viz-description').textContent = 'Connection error while loading visualization.';
        });
    } else {
      // Use the regular visualization API for other types
      console.log(`Fetching non-standard visualization: ${type} with params:`, options);
      console.log(`Endpoint URL: /api/visualizations/${type}?${params.toString()}`);
      
      fetch(`/api/visualizations/${type}?${params.toString()}`)
        .then(response => response.json())
        .then(result => {
          // ...existing code for other visualization types...
        })
        .catch(error => {
          // ...existing error handling...
        });
    }
  }

  /**
   * Update dashboard statistics from analysis results
   */
  function updateDashboardStats(stats) {
    // Make sure we have stats before trying to update
    if (!stats) return;
    
    // Update PM2.5 stats
    if (stats.average_pm25) {
      document.getElementById('avgPM25').textContent = stats.average_pm25.toFixed(2);
    }
    
    if (stats.max_pm25) {
      const peakPM25El = document.getElementById('peakPM25');
      if (peakPM25El) peakPM25El.textContent = stats.max_pm25.toFixed(2);
    }
    
    if (stats.min_pm25) {
      const lowPM25El = document.getElementById('lowPM25');
      if (lowPM25El) lowPM25El.textContent = stats.min_pm25.toFixed(2);
    }
    
    // Update PM10 stats
    if (stats.average_pm10) {
      document.getElementById('avgPM10').textContent = stats.average_pm10.toFixed(2);
    }
    
    if (stats.max_pm10) {
      const peakPM10El = document.getElementById('peakPM10');
      if (peakPM10El) peakPM10El.textContent = stats.max_pm10.toFixed(2);
    }
    
    if (stats.min_pm10) {
      const lowPM10El = document.getElementById('lowPM10');
      if (lowPM10El) lowPM10El.textContent = stats.min_pm10.toFixed(2);
    }
    
    // Update temperature and humidity
    if (stats.average_temperature) {
      const avgTempEl = document.getElementById('avgTemp');
      if (avgTempEl) avgTempEl.textContent = stats.average_temperature.toFixed(2);
    }
    
    if (stats.average_humidity) {
      const avgHumidityEl = document.getElementById('avgHumidity');
      if (avgHumidityEl) avgHumidityEl.textContent = stats.average_humidity.toFixed(2);
    }
  }

  // Add function to load the extended visualizations
  function loadExtendedVisualizations(options = {}) {
    console.log('Loading extended visualizations');
    
    // Build query parameters
    const params = new URLSearchParams({ ...options });
    
    fetch(`/api/visualizations/extended?${params.toString()}`)
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data) {
          // Show all available visualizations in a gallery format
          const vizGallery = document.getElementById('visualization-gallery');
          if (vizGallery) {
            let galleryHtml = '<div class="row">';
            
            // Time Series
            if (result.data.timeSeries) {
              galleryHtml += `
                <div class="col-md-6 mb-4">
                  <div class="card">
                    <div class="card-header">Time Series Analysis</div>
                    <div class="card-body">
                      <img src="${result.data.timeSeries}" class="img-fluid" alt="Time Series">
                    </div>
                  </div>
                </div>
              `;
            }
            
            // PM2.5 Trend
            if (result.data.pm25Trend) {
              galleryHtml += `
                <div class="col-md-6 mb-4">
                  <div class="card">
                    <div class="card-header">PM2.5 Trend Analysis</div>
                    <div class="card-body">
                      <img src="${result.data.pm25Trend}" class="img-fluid" alt="PM2.5 Trend">
                    </div>
                  </div>
                </div>
              `;
            }
            
            // Add other visualizations if available
            if (result.data.heatmap) {
              galleryHtml += `
                <div class="col-md-6 mb-4">
                  <div class="card">
                    <div class="card-header">Daily Heatmap</div>
                    <div class="card-body">
                      <img src="${result.data.heatmap}" class="img-fluid" alt="Heatmap">
                    </div>
                  </div>
                </div>
              `;
            }
            
            if (result.data.correlationHeatmap) {
              galleryHtml += `
                <div class="col-md-6 mb-4">
                  <div class="card">
                    <div class="card-header">Correlation Analysis</div>
                    <div class="card-body">
                      <img src="${result.data.correlationHeatmap}" class="img-fluid" alt="Correlation Heatmap">
                    </div>
                  </div>
                </div>
              `;
            }
            
            galleryHtml += '</div>';
            vizGallery.innerHTML = galleryHtml;
          }
        }
      })
      .catch(error => {
        console.error("Error loading extended visualizations:", error);
      });
  }

  // Initialize more visualizations on page load
  document.addEventListener('DOMContentLoaded', function() {
    // ...existing initialization code...
    
    // Add button for extended visualizations if it exists
    const extendedVizBtn = document.getElementById('load-extended-visualizations');
    if (extendedVizBtn) {
      extendedVizBtn.addEventListener('click', function() {
        // Get current date range if exists
        const dates = dateRangePicker.selectedDates;
        let options = {};
        if (dates.length === 2) {
          options.startDate = formatDate(dates[0]);
          options.endDate = formatDate(dates[1]);
        }
        
        loadExtendedVisualizations(options);
      });
    }
    
    // ...existing code...
  });

  /**
   * Initialize real-time updates
   */
  function initializeRealtimeUpdates() {
    // Clear existing interval if any
    if (appState.updateInterval) {
      clearInterval(appState.updateInterval);
    }
    
    console.log("Setting up real-time updates");
    
    // Set up polling for updates
    appState.updateInterval = setInterval(() => {
      if (!appState.isVisible || !appState.realtimeEnabled) {
        return; // Skip updates if page is hidden or realtime is disabled
      }
      
      console.log("Checking for real-time updates, last entry:", appState.lastEntryId);
      
      fetch(`/api/realtime?lastEntryId=${appState.lastEntryId}`)
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            if (result.data && result.data.newEntries > 0) {
              console.log(`Received ${result.data.newEntries} new entries`);
              
              // Update the latest entry ID
              if (result.data.channel && result.data.channel.last_entry_id) {
                appState.lastEntryId = parseInt(result.data.channel.last_entry_id);
              }
              
              // Update the UI with new data
              loadAnalysis();
              loadDataTable(1); // Reload first page of data table
              
              // Show a notification
              showToast(`Received ${result.data.newEntries} new data points`, 'success');
              
              // Update status indicator
              document.getElementById('status-indicator').className = 'status-indicator connected';
              document.getElementById('status-text').textContent = 'Connected';
              
              // Reset failed attempts counter
              appState.failedUpdateAttempts = 0;
            } else {
              // No new entries
              console.log("No new entries available");
              
              // Still update the status as connected
              document.getElementById('status-indicator').className = 'status-indicator connected';
              document.getElementById('status-text').textContent = 'Connected';
            }
          } else {
            console.error("Failed to check for updates:", result.error);
            
            // Increment failed attempts counter
            appState.failedUpdateAttempts++;
            
            // Update status indicator based on failed attempts
            if (appState.failedUpdateAttempts > 3) {
              document.getElementById('status-indicator').className = 'status-indicator error';
              document.getElementById('status-text').textContent = 'Connection Error';
            }
          }
        })
        .catch(error => {
          console.error("Error checking for updates:", error);
          
          // Increment failed attempts counter
          appState.failedUpdateAttempts++;
          
          // Update status indicator based on failed attempts
          if (appState.failedUpdateAttempts > 3) {
            document.getElementById('status-indicator').className = 'status-indicator disconnected';
            document.getElementById('status-text').textContent = 'Disconnected';
          }
        });
    }, 30000); // Check every 30 seconds
  }
  
  /**
   * Format date to YYYY-MM-DD
   */
  function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }
  
  /**
   * Format time to HH:MM
   */
  function formatTime(date) {
    const d = new Date(date);
    let hours = '' + d.getHours();
    let minutes = '' + d.getMinutes();

    if (hours.length < 2) hours = '0' + hours;
    if (minutes.length < 2) minutes = '0' + minutes;

    return `${hours}:${minutes}`;
  }
  
  /**
   * Format value to 2 decimal places
   */
  function formatValue(value) {
    if (value === null || value === undefined) return '--';
    const numValue = parseFloat(value);
    return isNaN(numValue) ? '--' : numValue.toFixed(2);
  }
  
  /**
   * Show a toast notification
   */
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toastId = `toast-${Date.now()}`;
    
    const bgClass = type === 'error' ? 'bg-danger' : 
                  type === 'success' ? 'bg-success' : 
                  type === 'warning' ? 'bg-warning' :
                  'bg-info';
    
    const html = `
      <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="toast-header ${bgClass} text-white">
          <strong class="me-auto">Air Quality Monitor</strong>
          <small>${new Date().toLocaleTimeString()}</small>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
          ${message}
        </div>
      </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', html);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 5000 });
    toast.show();
    
    // Remove toast from DOM after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
      this.remove();
    });
  }
  
  /**
   * Apply theme (dark/light mode)
   */
  function applyTheme() {
    if (appState.darkMode) {
      document.body.classList.add('dark-mode');
      document.getElementById('toggleTheme').innerHTML = '<i class="bi bi-sun-fill"></i>';
    } else {
      document.body.classList.remove('dark-mode');
      document.getElementById('toggleTheme').innerHTML = '<i class="bi bi-moon-fill"></i>';
    }
  }
  
  /**
   * Download current data as CSV
   */
  function downloadData() {
    console.log("Preparing data download");
    
    fetch('/api/data?results=1000')
      .then(response => response.json())
      .then(result => {
        if (result.success && result.data && result.data.data) {
          const data = result.data.data;
          
          // Convert to CSV
          const headers = ['Timestamp', 'PM2.5', 'PM10', 'Temperature', 'Humidity'];
          const csvRows = [headers.join(',')];
          
          data.forEach(item => {
            const row = [
              item.created_at,
              item.pm25 || item.field3 || '',
              item.pm10 || item.field4 || '',
              item.temperature || item.field2 || '',
              item.humidity || item.field1 || ''
            ];
            csvRows.push(row.join(','));
          });
          
          const csvContent = csvRows.join('\n');
          
          // Create download link
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `air_quality_data_${formatDate(new Date())}.csv`;
          link.click();
          URL.revokeObjectURL(url);
          
          showToast(`Downloaded ${data.length} records as CSV`, 'success');
        } else {
          console.error("Failed to download data:", result.error);
          showToast('Error preparing data for download', 'error');
        }
      })
      .catch(error => {
        console.error("Error in data download:", error);
        showToast('Error fetching data for download', 'error');
      });
  }
});
