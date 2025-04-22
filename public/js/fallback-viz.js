/**
 * Fallback Visualization System
 * Provides client-side visualization when Python processing fails
 */
(function() {
  // Initialize the module
  console.log("Fallback visualization module loaded");
  
  /**
   * Render a chart using client-side fallback
   * @param {string} type - Chart type (time_series, daily_pattern, etc.)
   * @param {Array} rawData - Data points
   * @param {HTMLElement} container - Container element
   */
  function renderChart(type, rawData, container) {
    console.log(`Rendering fallback ${type} chart with ${rawData?.length || 0} points`);
    
    // Clear the container and create canvas
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    container.appendChild(canvas);
    
    // Get chart context
    const ctx = canvas.getContext('2d');
    
    // Check if we have usable data
    if (!rawData || rawData.length === 0) {
      showNoDataMessage(ctx, canvas);
      return;
    }
    
    try {
      // Extract data with validation
      const points = processData(rawData);
      
      if (points.dates.length === 0) {
        showNoDataMessage(ctx, canvas);
        return;
      }
      
      // Render appropriate chart based on type
      switch(type) {
        case 'time_series':
          renderTimeSeriesChart(canvas, points);
          break;
        case 'daily_pattern':
          renderDailyPatternChart(canvas, points);
          break;
        case 'correlation':
          renderCorrelationChart(canvas, points);
          break;
        case 'heatmap':
          renderHeatmapChart(canvas, points);
          break;
        default:
          renderTimeSeriesChart(canvas, points); // Default
      }
    } catch (error) {
      console.error("Error rendering fallback visualization:", error);
      showErrorMessage(ctx, canvas, error.message);
    }
  }
  
  /**
   * Process raw data into usable format with validation and field mapping
   */
  function processData(rawData) {
    const result = {
      dates: [],
      pm25: [],
      pm10: [],
      temp: [],
      humidity: []
    };
    
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
    
    return result;
  }
  
  /**
   * Render time series chart
   */
  function renderTimeSeriesChart(canvas, data) {
    new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.dates,
        datasets: [
          {
            label: 'PM2.5',
            data: data.pm25,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.4,
            pointRadius: Math.min(3, Math.max(1, Math.floor(300 / data.dates.length)))
          },
          {
            label: 'PM10',
            data: data.pm10,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.4,
            pointRadius: Math.min(3, Math.max(1, Math.floor(300 / data.dates.length)))
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: determineTimeUnit(data.dates)
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
          }
        }
      }
    });
  }
  
  /**
   * Render daily pattern chart
   */
  function renderDailyPatternChart(canvas, data) {
    // Group data by hour
    const hourlyData = Array(24).fill().map(() => ({pm25: [], pm10: []}));
    
    data.dates.forEach((date, i) => {
      const hour = date.getHours();
      hourlyData[hour].pm25.push(data.pm25[i]);
      hourlyData[hour].pm10.push(data.pm10[i]);
    });
    
    // Calculate averages
    const hours = Array(24).fill().map((_, i) => i);
    const pm25Avg = hourlyData.map(hour => {
      const validValues = hour.pm25.filter(v => v !== null);
      return validValues.length ? 
        validValues.reduce((sum, val) => sum + val, 0) / validValues.length : null;
    });
    const pm10Avg = hourlyData.map(hour => {
      const validValues = hour.pm10.filter(v => v !== null);
      return validValues.length ? 
        validValues.reduce((sum, val) => sum + val, 0) / validValues.length : null;
    });
    
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: hours.map(h => `${h}:00`),
        datasets: [
          {
            label: 'PM2.5 Average',
            data: pm25Avg,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: 'PM10 Average',
            data: pm10Avg,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average Concentration (μg/m³)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Daily Air Quality Pattern'
          }
        }
      }
    });
  }
  
  /**
   * Render correlation chart
   */
  function renderCorrelationChart(canvas, data) {
    // Create scatter plot data
    const pm25VsTemp = data.pm25.map((pm25, i) => ({
      x: data.temp[i],
      y: pm25
    })).filter(point => point.x !== null && point.y !== null);
    
    const pm25VsHumidity = data.pm25.map((pm25, i) => ({
      x: data.humidity[i],
      y: pm25
    })).filter(point => point.x !== null && point.y !== null);
    
    new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'PM2.5 vs Temperature',
            data: pm25VsTemp,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            pointRadius: 3
          },
          {
            label: 'PM2.5 vs Humidity',
            data: pm25VsHumidity,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            pointRadius: 3,
            hidden: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Temperature / Humidity'
            }
          },
          y: {
            title: {
              display: true,
              text: 'PM2.5 (μg/m³)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Correlation Analysis'
          }
        }
      }
    });
  }
  
  /**
   * Render heatmap chart (fallback as basic bar chart)
   */
  function renderHeatmapChart(canvas, data) {
    // Group data by day of week
    const dayData = Array(7).fill().map(() => ({pm25: [], pm10: []}));
    
    data.dates.forEach((date, i) => {
      const day = date.getDay();
      dayData[day].pm25.push(data.pm25[i]);
      dayData[day].pm10.push(data.pm10[i]);
    });
    
    // Calculate averages
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const pm25Avg = dayData.map(day => {
      const validValues = day.pm25.filter(v => v !== null);
      return validValues.length ? 
        validValues.reduce((sum, val) => sum + val, 0) / validValues.length : 0;
    });
    const pm10Avg = dayData.map(day => {
      const validValues = day.pm10.filter(v => v !== null);
      return validValues.length ? 
        validValues.reduce((sum, val) => sum + val, 0) / validValues.length : 0;
    });
    
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [
          {
            label: 'PM2.5 Average',
            data: pm25Avg,
            backgroundColor: 'rgba(75, 192, 192, 0.5)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
          },
          {
            label: 'PM10 Average',
            data: pm10Avg,
            backgroundColor: 'rgba(255, 99, 132, 0.5)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Concentration (μg/m³)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Day of Week'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Weekly Air Quality Pattern'
          }
        }
      }
    });
  }
  
  /**
   * Determine appropriate time unit based on data range
   */
  function determineTimeUnit(dates) {
    if (!dates || dates.length < 2) return 'hour';
    
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const diffMs = lastDate - firstDate;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffDays < 1) return 'hour';
    if (diffDays < 14) return 'day';
    if (diffDays < 60) return 'week';
    return 'month';
  }
  
  /**
   * Show message when no data is available
   */
  function showNoDataMessage(ctx, canvas) {
    canvas.width = 400;  // Set default width
    canvas.height = 200; // Set default height
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText('No data available for visualization', canvas.width / 2, canvas.height / 2);
  }
  
  /**
   * Show error message
   */
  function showErrorMessage(ctx, canvas, message) {
    canvas.width = 400;  // Set default width
    canvas.height = 200; // Set default height
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Arial';
    ctx.fillStyle = '#dc3545';
    ctx.fillText('Error rendering visualization', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '14px Arial';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 20);
  }
  
  // Export API
  window.FallbackViz = {
    renderChart: renderChart,
    version: '1.0.0'
  };
})();
