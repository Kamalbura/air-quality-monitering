/**
 * Enhanced Fallback Visualization System
 * Provides powerful client-side visualization when Python processing fails
 */
(function() {
  // Initialize the module
  console.log("Enhanced visualization module loaded");
  
  // Register required Chart.js plugins if available
  if (Chart) {
    if (Chart.registry && Chart.registry.plugins) {
      // Check for and register annotation plugin
      if (window.ChartAnnotation && !Chart.registry.plugins.get('annotation')) {
        Chart.register(window.ChartAnnotation);
        console.log("Registered Chart.js annotation plugin");
      }
      
      // Check for and register zoom plugin
      if (window.ChartZoom && !Chart.registry.plugins.get('zoom')) {
        Chart.register(window.ChartZoom);
        console.log("Registered Chart.js zoom plugin");
      }
      
      // Check for and register matrix plugin
      if (window.ChartMatrixController && !Chart.registry.controllers.get('matrix')) {
        Chart.register(window.ChartMatrixController);
        console.log("Registered Chart.js matrix plugin");
      }
    }
  } else {
    console.error("Chart.js not found! Visualizations will not work correctly.");
  }
  
  /**
   * Render a chart using client-side fallback
   * @param {string} type - Chart type (time_series, daily_pattern, etc.)
   * @param {Array} rawData - Data points
   * @param {HTMLElement} container - Container element
   */
  function renderChart(type, rawData, container) {
    console.log(`Rendering enhanced ${type} chart with ${rawData?.length || 0} points`);
    
    // Clear the container and create canvas
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    
    // Get the context for drawing
    const ctx = canvas.getContext('2d');
    
    // Check if we have usable data
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      showNoDataMessage(ctx, canvas);
      return;
    }
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'spinner-border text-primary';
    loadingIndicator.setAttribute('role', 'status');
    loadingIndicator.style.position = 'absolute';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.innerHTML = '<span class="visually-hidden">Processing...</span>';
    container.appendChild(loadingIndicator);
    
    // Process data in a setTimeout to avoid blocking the UI
    setTimeout(() => {
      try {
        // Process the raw data into the expected format
        const points = processData(rawData);
        
        if (points.dates.length === 0) {
          showNoDataMessage(ctx, canvas);
          container.removeChild(loadingIndicator);
          return;
        }
        
        // Remove loading indicator after processing
        container.removeChild(loadingIndicator);
        
        // Select the appropriate visualization based on type
        switch(type) {
          case 'time_series':
            renderEnhancedTimeSeries(canvas, points);
            break;
          case 'daily_pattern':
            renderEnhancedDailyPattern(canvas, points);
            break;
          case 'correlation':
            renderEnhancedCorrelation(canvas, points);
            break;
          case 'heatmap':
            renderEnhancedHeatmap(canvas, points);
            break;
          case 'aqi':
            renderAQIGauge(canvas, points);
            break;
          case 'pm25_trend':
            renderPM25Trend(canvas, points);
            break;
          case 'standard':
            renderEnhancedTimeSeries(canvas, points);
            break;
          default:
            console.warn(`Unsupported visualization type: ${type}, falling back to time series`);
            renderEnhancedTimeSeries(canvas, points);
        }
      } catch (error) {
        console.error("Error rendering visualization:", error);
        showErrorMessage(ctx, canvas, error.message);
        if (loadingIndicator.parentNode) {
          container.removeChild(loadingIndicator);
        }
      }
    }, 10);
  }
  
  /**
   * Render enhanced time series chart with annotation support and WHO guidelines
   */
  function renderEnhancedTimeSeries(canvas, data) {
    // Resample data if there are too many points
    let displayData = data;
    if (data.dates.length > 500) {
      displayData = resampleData(data, 500);
    }
    
    // Add WHO guideline values
    const whoGuidelines = [{
      label: 'WHO PM2.5 Guideline',
      value: 15,
      borderColor: 'rgba(255, 0, 0, 0.7)',
      borderWidth: 2,
      borderDash: [5, 5]
    }, {
      label: 'WHO PM10 Guideline',
      value: 45,
      borderColor: 'rgba(255, 165, 0, 0.7)',
      borderWidth: 2,
      borderDash: [5, 5]
    }];
    
    // Create annotations for guidelines
    const annotations = {};
    whoGuidelines.forEach((guideline, index) => {
      annotations[`line${index}`] = {
        type: 'line',
        yMin: guideline.value,
        yMax: guideline.value,
        borderColor: guideline.borderColor,
        borderWidth: guideline.borderWidth,
        borderDash: guideline.borderDash,
        label: {
          display: true,
          content: guideline.label,
          position: 'end',
          backgroundColor: 'rgba(255, 255, 255, 0.7)',
          color: guideline.borderColor,
          font: {
            weight: 'bold'
          }
        }
      };
    });
    
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: displayData.dates,
        datasets: [
          {
            label: 'PM2.5',
            data: displayData.pm25,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.4,
            fill: true,
            pointRadius: Math.min(3, Math.max(1, Math.floor(300 / displayData.dates.length)))
          },
          {
            label: 'PM10',
            data: displayData.pm10,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.4,
            fill: true,
            pointRadius: Math.min(3, Math.max(1, Math.floor(300 / displayData.dates.length)))
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: determineTimeUnit(displayData.dates)
            },
            title: {
              display: true,
              text: 'Date/Time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Concentration (μg/m³)'
            },
            beginAtZero: true
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Air Quality Time Series'
          },
          annotation: {
            annotations: annotations
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || '';
                const value = context.raw !== null ? context.raw.toFixed(2) : 'N/A';
                return `${label}: ${value} μg/m³`;
              }
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
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
          }
        }
      }
    });
  }
  
  // ...other existing helper functions...
  
  /**
   * Process raw data into usable format with validation and field mapping
   * @param {Array} rawData - The raw data from the API or CSV
   * @returns {Object} Processed data with date objects and validated values
   */
  function processData(rawData) {
    const result = {
      dates: [],
      pm25: [],
      pm10: [],
      temp: [],
      humidity: []
    };
    
    // Handle undefined or null data
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.warn("No data provided to process or data is not an array");
      return result;
    }
    
    // Debug to verify data structure
    console.log(`Processing ${rawData.length} data points, first item:`, 
                rawData[0] ? JSON.stringify(rawData[0]) : 'undefined');
    
    // Process each data point into visualization-friendly format
    rawData.forEach(item => {
      if (!item || !item.created_at) return; // Skip invalid items
      
      // Parse date
      const date = new Date(item.created_at);
      if (isNaN(date.getTime())) return; // Skip invalid dates
      
      // Extract values with fallbacks for different field names
      const pm25 = parseFloat(item.pm25 || item.field3);
      const pm10 = parseFloat(item.pm10 || item.field4);
      const temp = parseFloat(item.temperature || item.field2);
      const humidity = parseFloat(item.humidity || item.field1);
      
      // Only add if PM data is valid
      if (!isNaN(pm25) || !isNaN(pm10)) {
        result.dates.push(date);
        result.pm25.push(isNaN(pm25) ? null : pm25);
        result.pm10.push(isNaN(pm10) ? null : pm10);
        result.temp.push(isNaN(temp) ? null : temp);
        result.humidity.push(isNaN(humidity) ? null : humidity);
      }
    });
    
    console.log(`Processed data contains ${result.dates.length} valid points`);
    return result;
  }
  
  /**
   * Display error message on canvas
   */
  function showErrorMessage(ctx, canvas, message) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw error icon
    ctx.beginPath();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 30;
    const radius = 30;
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(220, 53, 69, 0.1)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(220, 53, 69, 1)';
    ctx.stroke();
    
    // Draw exclamation mark
    ctx.font = 'bold 40px Arial';
    ctx.fillStyle = 'rgba(220, 53, 69, 1)';
    ctx.fillText('!', centerX, centerY);
    
    // Draw error message
    ctx.font = '16px Arial';
    ctx.fillText('Visualization Error', centerX, centerY + 50);
    ctx.font = '14px Arial';
    ctx.fillText(message, centerX, centerY + 75);
    ctx.fillText('Try refreshing or selecting a different date range', centerX, centerY + 95);
  }
  
  /**
   * Display no data message on canvas
   */
  function showNoDataMessage(ctx, canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw icon
    ctx.beginPath();
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const radius = 30;
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(108, 117, 125, 0.1)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(108, 117, 125, 0.6)';
    ctx.stroke();
    
    // Draw icon content
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = 'rgba(108, 117, 125, 0.6)';
    ctx.fillText('?', centerX, centerY);
    
    // Draw message
    ctx.font = '16px Arial';
    ctx.fillStyle = 'rgba(108, 117, 125, 0.8)';
    ctx.fillText('No data available for visualization', centerX, centerY + 60);
    ctx.font = '14px Arial';
    ctx.fillText('Try selecting a different date range', centerX, centerY + 85);
  }
  
  // Export API
  window.FallbackViz = {
    renderChart,
    version: '2.0.0'
  };
})();
