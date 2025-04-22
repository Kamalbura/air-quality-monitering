/**
 * Fallback Visualization - Client-side charts
 * For when server-side visualization is unavailable
 */

class FallbackViz {
  constructor() {
    // Common chart configuration
    this.chartDefaults = {
      responsive: true,
      maintainAspectRatio: true,
      animation: {
        duration: 1000
      },
      plugins: {
        legend: {
          position: 'top',
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    };
    
    // WHO Guidelines
    this.whoGuidelines = {
      PM25: {
        daily: 15, // µg/m³ (24-hour mean)
        annual: 5  // µg/m³ (annual mean)
      },
      PM10: {
        daily: 45, // µg/m³ (24-hour mean)
        annual: 15 // µg/m³ (annual mean)
      }
    };
    
    // Air quality index colors
    this.aqiColors = {
      good: 'rgba(0, 228, 0, 0.5)',
      moderate: 'rgba(255, 255, 0, 0.5)',
      unhealthySensitive: 'rgba(255, 126, 0, 0.5)',
      unhealthy: 'rgba(255, 0, 0, 0.5)',
      veryUnhealthy: 'rgba(143, 63, 151, 0.5)',
      hazardous: 'rgba(126, 0, 35, 0.5)'
    };
    
    // Active charts for cleanup
    this.activeCharts = {};
  }
  
  /**
   * Create time series chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Array} data - Data array
   */
  createTimeSeriesChart(canvas, data) {
    // Clean up previous chart
    this.destroyChart('timeSeriesChart');
    
    // Check if we have data
    if (!data || data.length === 0) {
      this.showNoDataMessage(canvas);
      return;
    }
    
    // Process data for the chart
    const timestamps = data.map(item => new Date(item.created_at));
    const pm25Values = data.map(item => parseFloat(item.pm25 || item.field3) || null);
    const pm10Values = data.map(item => parseFloat(item.pm10 || item.field4) || null);
    
    // Create chart configuration
    const config = {
      type: 'line',
      data: {
        labels: timestamps,
        datasets: [
          {
            label: 'PM2.5',
            data: pm25Values,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4,
            yAxisID: 'y'
          },
          {
            label: 'PM10',
            data: pm10Values,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.4,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        ...this.chartDefaults,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: this.determineTimeUnit(timestamps),
              displayFormats: {
                hour: 'MMM dd HH:mm',
                day: 'MMM dd',
                week: 'MMM dd',
                month: 'MMM yyyy'
              }
            },
            title: {
              display: true,
              text: 'Date/Time'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Concentration (µg/m³)'
            }
          }
        },
        plugins: {
          ...this.chartDefaults.plugins,
          annotation: {
            annotations: {
              pm25_daily: {
                type: 'line',
                yMin: this.whoGuidelines.PM25.daily,
                yMax: this.whoGuidelines.PM25.daily,
                borderColor: 'rgba(255, 0, 0, 0.7)',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  display: true,
                  content: `WHO PM2.5 Guideline (${this.whoGuidelines.PM25.daily} µg/m³)`,
                  position: 'end'
                }
              }
            }
          }
        }
      }
    };
    
    // Create and store chart
    this.activeCharts['timeSeriesChart'] = new Chart(canvas, config);
  }
  
  /**
   * Create daily pattern chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Array} data - Data array
   */
  createDailyPatternChart(canvas, data) {
    // Clean up previous chart
    this.destroyChart('dailyPatternChart');
    
    // Check if we have data
    if (!data || data.length === 0) {
      this.showNoDataMessage(canvas);
      return;
    }
    
    // Group data by hour
    const hourlyData = Array(24).fill().map(() => ({ pm25: [], pm10: [] }));
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      const hour = date.getHours();
      
      const pm25 = parseFloat(item.pm25 || item.field3);
      const pm10 = parseFloat(item.pm10 || item.field4);
      
      if (!isNaN(pm25)) hourlyData[hour].pm25.push(pm25);
      if (!isNaN(pm10)) hourlyData[hour].pm10.push(pm10);
    });
    
    // Calculate average for each hour
    const hourLabels = Array(24).fill().map((_, i) => `${i}:00`);
    const pm25Avgs = hourlyData.map(h => 
      h.pm25.length > 0 ? h.pm25.reduce((sum, val) => sum + val, 0) / h.pm25.length : null
    );
    const pm10Avgs = hourlyData.map(h => 
      h.pm10.length > 0 ? h.pm10.reduce((sum, val) => sum + val, 0) / h.pm10.length : null
    );
    
    // Create chart configuration
    const config = {
      type: 'line',
      data: {
        labels: hourLabels,
        datasets: [
          {
            label: 'PM2.5',
            data: pm25Avgs,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'PM10',
            data: pm10Avgs,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        ...this.chartDefaults,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average Concentration (µg/m³)'
            }
          }
        },
        plugins: {
          ...this.chartDefaults.plugins,
          title: {
            display: true,
            text: 'Daily Air Quality Pattern'
          }
        }
      }
    };
    
    // Create and store chart
    this.activeCharts['dailyPatternChart'] = new Chart(canvas, config);
  }
  
  /**
   * Create correlation chart (scatter plot)
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Array} data - Data array
   */
  createCorrelationChart(canvas, data) {
    // Clean up previous chart
    this.destroyChart('correlationChart');
    
    // Check if we have data
    if (!data || data.length === 0) {
      this.showNoDataMessage(canvas);
      return;
    }
    
    // Process data for scatter plot
    const pm25Values = data.map(item => parseFloat(item.pm25 || item.field3) || null);
    const pm10Values = data.map(item => parseFloat(item.pm10 || item.field4) || null);
    
    // Create scatter plot data
    const scatterData = [];
    
    for (let i = 0; i < data.length; i++) {
      if (pm25Values[i] !== null && pm10Values[i] !== null) {
        scatterData.push({
          x: pm25Values[i],
          y: pm10Values[i]
        });
      }
    }
    
    // Create chart configuration
    const config = {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'PM2.5 vs PM10',
            data: scatterData,
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        ...this.chartDefaults,
        scales: {
          x: {
            title: {
              display: true,
              text: 'PM2.5 (µg/m³)'
            },
            beginAtZero: true
          },
          y: {
            title: {
              display: true,
              text: 'PM10 (µg/m³)'
            },
            beginAtZero: true
          }
        },
        plugins: {
          ...this.chartDefaults.plugins,
          title: {
            display: true,
            text: 'Correlation: PM2.5 vs PM10'
          }
        }
      }
    };
    
    // Create and store chart
    this.activeCharts['correlationChart'] = new Chart(canvas, config);
  }
  
  /**
   * Create heatmap chart
   * @param {HTMLCanvasElement} canvas - Canvas element
   * @param {Array} data - Data array
   */
  createHeatmapChart(canvas, data) {
    // Clean up previous chart
    this.destroyChart('heatmapChart');
    
    // Check if we have data
    if (!data || data.length === 0) {
      this.showNoDataMessage(canvas);
      return;
    }
    
    // Group data by day and hour
    const dayHourData = {};
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    data.forEach(item => {
      const date = new Date(item.created_at);
      const day = date.getDay(); // 0-6
      const hour = date.getHours(); // 0-23
      const pm25 = parseFloat(item.pm25 || item.field3);
      
      if (!isNaN(pm25)) {
        const key = `${day}-${hour}`;
        if (!dayHourData[key]) {
          dayHourData[key] = [];
        }
        dayHourData[key].push(pm25);
      }
    });
    
    // Calculate average for each day-hour combination
    const heatmapData = [];
    
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`;
        const values = dayHourData[key] || [];
        const avg = values.length > 0 ? 
                    values.reduce((sum, val) => sum + val, 0) / values.length : null;
        
        if (avg !== null) {
          heatmapData.push({
            x: hour,
            y: day,
            v: avg
          });
        }
      }
    }
    
    // Color function based on AQI levels
    const getColor = (value) => {
      if (value === null) return 'rgba(200, 200, 200, 0.5)';
      
      if (value <= 12) return this.aqiColors.good;
      if (value <= 35.4) return this.aqiColors.moderate;
      if (value <= 55.4) return this.aqiColors.unhealthySensitive;
      if (value <= 150.4) return this.aqiColors.unhealthy;
      if (value <= 250.4) return this.aqiColors.veryUnhealthy;
      return this.aqiColors.hazardous;
    };
    
    // Create chart configuration
    const config = {
      type: 'matrix',
      data: {
        datasets: [{
          label: 'PM2.5 Concentration',
          data: heatmapData,
          backgroundColor: context => getColor(context.dataset.data[context.dataIndex].v),
          borderColor: 'rgba(255, 255, 255, 0.2)',
          borderWidth: 1,
          width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
          height: ({ chart }) => (chart.chartArea || {}).height / 7 - 1
        }]
      },
      options: {
        ...this.chartDefaults,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            min: 0,
            max: 23,
            ticks: {
              stepSize: 1,
              callback: value => `${value}:00`
            },
            title: {
              display: true,
              text: 'Hour of Day'
            }
          },
          y: {
            type: 'linear',
            min: 0,
            max: 6,
            ticks: {
              stepSize: 1,
              callback: value => daysOfWeek[value]
            },
            title: {
              display: true,
              text: 'Day of Week'
            }
          }
        },
        plugins: {
          ...this.chartDefaults.plugins,
          tooltip: {
            callbacks: {
              title: () => null,
              label: (context) => {
                const v = context.dataset.data[context.dataIndex].v.toFixed(1);
                const x = context.dataset.data[context.dataIndex].x;
                const y = context.dataset.data[context.dataIndex].y;
                return [
                  `${daysOfWeek[y]} at ${x}:00`,
                  `PM2.5: ${v} µg/m³`
                ];
              }
            }
          },
          title: {
            display: true,
            text: 'PM2.5 Concentration by Day and Hour'
          },
          legend: {
            display: false
          }
        }
      }
    };
    
    // Create and store chart
    this.activeCharts['heatmapChart'] = new Chart(canvas, config);
  }
  
  /**
   * Determine appropriate time unit for chart
   * @param {Array} timestamps - Array of timestamps
   * @returns {string} Time unit
   */
  determineTimeUnit(timestamps) {
    if (!timestamps || timestamps.length < 2) return 'day';
    
    const firstDate = new Date(timestamps[0]);
    const lastDate = new Date(timestamps[timestamps.length - 1]);
    const diffDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
    
    if (diffDays < 1) return 'hour';
    if (diffDays < 7) return 'day';
    if (diffDays < 60) return 'week';
    return 'month';
  }
  
  /**
   * Show message when no data is available
   * @param {HTMLCanvasElement} canvas - Canvas element
   */
  showNoDataMessage(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '16px Arial';
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';
    ctx.fillText('No data available for visualization', canvas.width / 2, canvas.height / 2);
  }
  
  /**
   * Destroy existing chart
   * @param {string} chartId - Chart ID
   */
  destroyChart(chartId) {
    if (this.activeCharts[chartId]) {
      this.activeCharts[chartId].destroy();
      delete this.activeCharts[chartId];
    }
  }
}

// Make it available globally
window.FallbackViz = FallbackViz;
