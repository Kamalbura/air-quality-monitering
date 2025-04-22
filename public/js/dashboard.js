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
    document.getElementById('vizTitle').textContent = getVizTitle(type);
    
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
    
    // Update app state to track current viz type
    appState.currentVizType = type;
    
    // Check if we're using client-side rendering
    const useClientSide = localStorage.getItem('useClientSideViz') === 'true';
    
    // Update toggle button text
    const toggleBtn = document.getElementById('toggleVizMode');
    if (toggleBtn) {
      toggleBtn.innerHTML = useClientSide ? 
        '<i class="bi bi-server"></i> Use Server Rendering' : 
        '<i class="bi bi-browser"></i> Use Client Rendering';
    }
    
    if (useClientSide) {
      console.log('Using client-side visualization rendering');
      loadDataAndRenderClientSide(type, options);
      return;
    }
    
    // Try server-side rendering first
    console.log(`Fetching ${type} visualization from server with params:`, options);
    
    // Direct path loading for standard visualizations
    if (type === 'time_series' || type === 'pm25_trend') {
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
            
            // Verify image exists by trying to load it
            const img = new Image();
            img.onload = function() {
              // Image loaded successfully
              vizContainer.innerHTML = `<img src="${imageUrl}" class="img-fluid" alt="${type} visualization">`;
              
              // Set description based on statistics
              updateVizDescription(type, result.data.stats);
              
              // Update dashboard stats
              updateDashboardStats(result.data.stats);
            };
            
            img.onerror = function() {
              console.error(`Failed to load image from ${imageUrl}, falling back to client-side`);
              loadDataAndRenderClientSide(type, options);
            };
            
            img.src = imageUrl;
          } else if (result.clientSide) {
            loadDataAndRenderClientSide(type, options);
          } else {
            console.warn('Error from standard visualization API:', result.error);
            loadDataAndRenderClientSide(type, options);
          }
        })
        .catch(error => {
          console.error("Error loading visualization:", error);
          showToast('Falling back to client-side rendering', 'warning');
          loadDataAndRenderClientSide(type, options);
        });
    } else {
      // Use the regular visualization API for other types
      fetch(`/api/visualizations/${type}?${params.toString()}`)
        .then(response => response.json())
        .then(result => {
          if (result.success && result.data) {
            vizContainer.innerHTML = `<img src="${result.data.imagePath}" class="img-fluid" alt="${type} visualization">`;
            document.getElementById('viz-description').textContent = result.data.description || '';
          } else {
            // Fall back to client-side for any error
            loadDataAndRenderClientSide(type, options);
          }
        })
        .catch(error => {
          console.error("Error in visualization fetch:", error);
          loadDataAndRenderClientSide(type, options);
        });
    }
  }
  
  /**
   * Get visualization title based on type
   */
  function getVizTitle(type) {
    const titles = {
      'time_series': 'Time Series Visualization',
      'daily_pattern': 'Daily Pattern Analysis',
      'correlation': 'Environmental Correlation Analysis',
      'heatmap': 'Weekly Heatmap',
      'pm25_trend': 'PM2.5 Trend Analysis',
      'aqi': 'Air Quality Index'
    };
    return titles[type] || 'Visualization';
  }
  
  /**
   * Update visualization description based on type and stats
   */
  function updateVizDescription(type, stats = {}) {
    let description = '';
    
    switch(type) {
      case 'time_series':
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
        break;
      case 'pm25_trend':
        description = `PM2.5 trend analysis with rolling average.`;
        if (stats.min_pm25 !== undefined && stats.max_pm25 !== undefined) {
          description += ` Range: ${Number(stats.min_pm25).toFixed(2)} to ${Number(stats.max_pm25).toFixed(2)} μg/m³.`;
        }
        break;
      default:
        description = `${getVizTitle(type)} showing air quality patterns.`;
    }
    
    document.getElementById('viz-description').textContent = description;
  }
  
  /**
   * Load data and render visualization client-side
   */
  function loadDataAndRenderClientSide(type, options = {}) {
    console.log(`Rendering client-side visualization: ${type}`);
    document.getElementById('viz-description').textContent = 'Preparing client-side visualization...';
    
    // Build the parameters for CSV data API
    const params = new URLSearchParams({
      // Pass date range if provided
      ...(options.startDate && { startDate: options.startDate }),
      ...(options.endDate && { endDate: options.endDate })
    });
    
    // Show loading indicator
    const vizContainer = document.getElementById('visualization-container');
    vizContainer.innerHTML = `
      <div class="d-flex flex-column justify-content-center align-items-center h-100">
        <div class="mb-2">Loading and processing data...</div>
        <div class="progress w-75 mb-3">
          <div class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar" style="width: 100%"></div>
        </div>
        <div id="viz-loading-status">Fetching data...</div>
      </div>
    `;
    
    // Attempt to fetch CSV data directly (most efficient)
    fetch(`/api/csv-data?${params.toString()}`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch CSV data: ${response.status}`);
        }
        return response.json();
      })
      .then(result => {
        if (!result || !result.data || result.data.length === 0) {
          throw new Error('No data available');
        }
        
        document.getElementById('viz-loading-status').innerText = `Processing ${result.data.length} data points...`;
        
        // Avoid UI blocking with setTimeout
        setTimeout(() => {
          try {
            // Render visualization with the enhanced fallback visualizer
            window.FallbackViz.renderChart(type, result.data, vizContainer);
            
            // Calculate stats for the description
            const stats = calculateStats(result.data);
            updateDashboardStats(stats);
            
            // Set description based on visualization type
            updateVizDescription(type, stats);
            
            showToast('Client-side visualization rendered successfully', 'info');
          } catch (err) {
            console.error('Error rendering client-side visualization:', err);
            vizContainer.innerHTML = `
              <div class="alert alert-danger">
                <h5>Rendering Error</h5>
                <p>Failed to render visualization: ${err.message}</p>
                <p>Try switching to server-side rendering or select a different date range.</p>
              </div>
            `;
            document.getElementById('viz-description').textContent = 'Error rendering visualization.';
            showToast('Visualization rendering failed', 'error');
          }
        }, 100);
      })
      .catch(error => {
        console.error("Error in client-side visualization:", error);
        
        // Fall back to regular data API as last resort
        fetch(`/api/data?${params.toString()}`)
          .then(response => response.json())
          .then(result => {
            if (result.success && result.data && result.data.data) {
              // Try to render using this data
              setTimeout(() => {
                try {
                  window.FallbackViz.renderChart(type, result.data.data, vizContainer);
                  document.getElementById('viz-description').textContent = `Client-side visualization using ${result.data.data.length} data points.`;
                } catch (err) {
                  vizContainer.innerHTML = `
                    <div class="alert alert-danger">
                      <h5>Visualization Error</h5>
                      <p>Failed to render: ${err.message}</p>
                    </div>
                  `;
                  document.getElementById('viz-description').textContent = 'Error rendering visualization.';
                }
              }, 100);
            } else {
              vizContainer.innerHTML = `
                <div class="alert alert-warning">
                  <h5>No Data Available</h5>
                  <p>Could not retrieve data for visualization. Try adjusting your filters.</p>
                </div>
              `;
              document.getElementById('viz-description').textContent = 'No data available for visualization.';
            }
          })
          .catch(finalError => {
            vizContainer.innerHTML = `
              <div class="alert alert-danger">
                <h5>Connection Error</h5>
                <p>Failed to load data: ${finalError.message}</p>
              </div>
            `;
            document.getElementById('viz-description').textContent = 'Connection error.';
          });
      });
  }
  
  // Initialization code - Add after the initial load code
  document.addEventListener('DOMContentLoaded', function() {
    console.log("Setting up visualization controls...");
    
    // Add visualization toggle button event handler
    const toggleBtn = document.getElementById('toggleVizMode');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function() {
        const currentMode = localStorage.getItem('useClientSideViz') === 'true';
        localStorage.setItem('useClientSideViz', !currentMode);
        
        // Update button text
        this.innerHTML = !currentMode ? 
          '<i class="bi bi-server"></i> Use Server Rendering' : 
          '<i class="bi bi-browser"></i> Use Client Rendering';
        
        // Reload current visualization
        const dates = dateRangePicker.selectedDates;
        let options = {};
        if (dates && dates.length === 2) {
          options.startDate = formatDate(dates[0]);
          options.endDate = formatDate(dates[1]);
        }
        
        loadVisualization(appState.currentVizType, options);
        
        showToast(!currentMode ? 
          'Using client-side JavaScript visualization' : 
          'Using server-side Python visualization', 'info');
      });
    }
    
    // Setup extended visualization button
    const extendedVizBtn = document.getElementById('showExtendedViz');
    if (extendedVizBtn) {
      extendedVizBtn.addEventListener('click', function() {
        const dates = dateRangePicker.selectedDates;
        let params = new URLSearchParams();
        
        if (dates && dates.length === 2) {
          params.append('startDate', formatDate(dates[0]));
          params.append('endDate', formatDate(dates[1]));
        }
        
        // Show loading state
        const galleryEl = document.getElementById('visualization-gallery');
        if (galleryEl) {
          galleryEl.innerHTML = `
            <div class="col-12 text-center p-5">
              <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading extended visualizations...</span>
              </div>
              <p class="mt-2">Loading extended visualizations...</p>
            </div>
          `;
          
          // Scroll to gallery
          galleryEl.scrollIntoView({ behavior: 'smooth' });
          
          // Determine if we should use client-side or server-side
          const useClientSide = localStorage.getItem('useClientSideViz') === 'true';
          
          if (useClientSide) {
            loadClientSideGallery(galleryEl, params);
          } else {
            loadServerSideGallery(galleryEl, params);
          }
        }
      });
    }
    
    // Make sure date selection works properly
    const dateFilterBtn = document.getElementById('applyDateFilter');
    if (dateFilterBtn) {
      dateFilterBtn.addEventListener('click', function() {
        const dates = dateRangePicker.selectedDates;
        if (dates && dates.length === 2) {
          const startDate = formatDate(dates[0]);
          const endDate = formatDate(dates[1]);
          
          // Update dashboard with date range
          loadDataByDateRange(startDate, endDate);
          loadAnalysisByDateRange(startDate, endDate);
          loadVisualization(appState.currentVizType, {startDate, endDate});
          
          showToast(`Date range applied: ${startDate} to ${endDate}`, 'success');
        } else {
          showToast('Please select a valid date range', 'warning');
        }
      });
    }
  });
  
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
