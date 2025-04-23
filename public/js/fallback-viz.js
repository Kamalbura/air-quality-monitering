/**
 * Client-side visualization module using Chart.js
 * Renamed from "fallback-viz" but kept filename for compatibility
 * This is now the primary visualization engine
 */

// Chart theme configurations
const chartThemes = {
    light: {
        backgroundColor: 'white',
        color: '#333',
        gridColor: 'rgba(0, 0, 0, 0.1)',
        axisColor: '#666',
        fontColor: '#333'
    },
    dark: {
        backgroundColor: '#2c3e50',
        color: '#ecf0f1',
        gridColor: 'rgba(255, 255, 255, 0.1)',
        axisColor: '#bdc3c7',
        fontColor: '#ecf0f1'
    }
};

// AQI Color scheme
const aqiColorRanges = {
    pm25: [
        { min: 0, max: 12, color: 'rgba(0, 228, 0, 0.7)', label: 'Good' },
        { min: 12.1, max: 35.4, color: 'rgba(255, 255, 0, 0.7)', label: 'Moderate' },
        { min: 35.5, max: 55.4, color: 'rgba(255, 126, 0, 0.7)', label: 'Unhealthy for Sensitive Groups' },
        { min: 55.5, max: 150.4, color: 'rgba(255, 0, 0, 0.7)', label: 'Unhealthy' },
        { min: 150.5, max: 250.4, color: 'rgba(143, 63, 151, 0.7)', label: 'Very Unhealthy' },
        { min: 250.5, max: 999, color: 'rgba(126, 0, 35, 0.7)', label: 'Hazardous' }
    ],
    pm10: [
        { min: 0, max: 54, color: 'rgba(0, 228, 0, 0.7)', label: 'Good' },
        { min: 55, max: 154, color: 'rgba(255, 255, 0, 0.7)', label: 'Moderate' },
        { min: 155, max: 254, color: 'rgba(255, 126, 0, 0.7)', label: 'Unhealthy for Sensitive Groups' },
        { min: 255, max: 354, color: 'rgba(255, 0, 0, 0.7)', label: 'Unhealthy' },
        { min: 355, max: 424, color: 'rgba(143, 63, 151, 0.7)', label: 'Very Unhealthy' },
        { min: 425, max: 999, color: 'rgba(126, 0, 35, 0.7)', label: 'Hazardous' }
    ]
};

// WHO guidelines
const whoGuidelines = {
    pm25: { daily: 15, annual: 5 },  // µg/m³
    pm10: { daily: 45, annual: 15 }   // µg/m³
};

/**
 * Create time series visualization using Chart.js
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Air quality data
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createTimeSeriesVisualization(canvasId, data, options = {}) {
    // Get canvas context
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    if (!data || data.length === 0) {
        // Display no data message
        return renderNoDataMessage(canvasId);
    }
    
    // Process data
    const timestamps = data.map(d => new Date(d.created_at || d.timestamp));
    const pm25Values = data.map(d => parseFloat(d.pm25 || d.field3));
    const pm10Values = data.map(d => parseFloat(d.pm10 || d.field4));
    const tempValues = data.map(d => parseFloat(d.temperature || d.field2));
    const humidityValues = data.map(d => parseFloat(d.humidity || d.field1));
    
    // Create chart configuration
    const chartConfig = {
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
                    borderWidth: 2,
                    pointRadius: options.pointRadius || 1,
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'PM10',
                    data: pm10Values,
                    borderColor: 'rgba(255, 159, 64, 1)',
                    backgroundColor: 'rgba(255, 159, 64, 0.1)',
                    yAxisID: 'y',
                    borderWidth: 2,
                    pointRadius: options.pointRadius || 1,
                    tension: 0.2,
                    fill: true
                },
                {
                    label: 'Temperature',
                    data: tempValues,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    yAxisID: 'y1',
                    borderWidth: 2,
                    pointRadius: options.pointRadius || 1,
                    tension: 0.2,
                    fill: false,
                    hidden: options.hideTemp === true
                },
                {
                    label: 'Humidity',
                    data: humidityValues,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    yAxisID: 'y2',
                    borderWidth: 2,
                    pointRadius: options.pointRadius || 1,
                    tension: 0.2,
                    fill: false,
                    hidden: options.hideHumidity === true
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
                title: {
                    display: !!options.title,
                    text: options.title || '',
                    color: themeConfig.fontColor
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: themeConfig.fontColor
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: { enabled: true },
                        pinch: { enabled: true },
                        mode: 'x',
                    },
                    limits: {
                        x: { min: 'original', max: 'original' }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: themeConfig.backgroundColor,
                    titleColor: themeConfig.fontColor,
                    bodyColor: themeConfig.fontColor,
                    callbacks: {
                        title: function(context) {
                            const date = new Date(context[0].label);
                            return date.toLocaleString();
                        }
                    }
                },
                annotation: {
                    annotations: {
                        who_pm25: {
                            type: 'line',
                            yMin: whoGuidelines.pm25.daily,
                            yMax: whoGuidelines.pm25.daily,
                            yScaleID: 'y',
                            borderColor: 'rgba(255, 99, 132, 0.6)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'WHO PM2.5 Daily Limit',
                                position: 'end',
                                backgroundColor: 'rgba(255, 99, 132, 0.8)',
                                color: 'white'
                            }
                        },
                        who_pm10: {
                            type: 'line',
                            yMin: whoGuidelines.pm10.daily,
                            yMax: whoGuidelines.pm10.daily,
                            yScaleID: 'y',
                            borderColor: 'rgba(255, 159, 64, 0.6)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                display: true,
                                content: 'WHO PM10 Daily Limit',
                                position: 'end',
                                backgroundColor: 'rgba(255, 159, 64, 0.8)',
                                color: 'white'
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: options.timeUnit || 'hour'
                    },
                    title: {
                        display: true,
                        text: 'Date/Time',
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor,
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'PM Concentration (μg/m³)',
                        color: themeConfig.fontColor
                    },
                    min: 0,
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Temperature (°C)',
                        color: themeConfig.fontColor
                    },
                    grid: {
                        drawOnChartArea: false,
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                },
                y2: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)',
                        color: themeConfig.fontColor
                    },
                    min: 0,
                    max: 100,
                    grid: {
                        drawOnChartArea: false,
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                }
            }
        }
    };
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Create daily pattern visualization using Chart.js
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Air quality data
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createDailyPatternVisualization(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    if (!data || data.length === 0) {
        return renderNoDataMessage(canvasId);
    }
    
    // Group data by hour of day
    const hourlyData = Array(24).fill().map(() => ({
        pm25Sum: 0, pm10Sum: 0, tempSum: 0, humiditySum: 0, count: 0
    }));
    
    // Process data for each hour
    data.forEach(item => {
        const date = new Date(item.created_at || item.timestamp);
        const hour = date.getHours();
        
        const pm25 = parseFloat(item.pm25 || item.field3);
        const pm10 = parseFloat(item.pm10 || item.field4);
        const temp = parseFloat(item.temperature || item.field2);
        const humidity = parseFloat(item.humidity || item.field1);
        
        if (!isNaN(pm25)) {
            hourlyData[hour].pm25Sum += pm25;
            hourlyData[hour].count++;
        }
        
        if (!isNaN(pm10)) hourlyData[hour].pm10Sum += pm10;
        if (!isNaN(temp)) hourlyData[hour].tempSum += temp;
        if (!isNaN(humidity)) hourlyData[hour].humiditySum += humidity;
    });
    
    // Calculate averages for each hour
    const hourlyPM25Avg = hourlyData.map(d => d.count > 0 ? d.pm25Sum / d.count : 0);
    const hourlyPM10Avg = hourlyData.map(d => d.count > 0 ? d.pm10Sum / d.count : 0);
    const hourlyTempAvg = hourlyData.map(d => d.count > 0 ? d.tempSum / d.count : 0);
    const hourlyHumidityAvg = hourlyData.map(d => d.count > 0 ? d.humiditySum / d.count : 0);
    
    // Format hour labels (00:00, 01:00, etc.)
    const hourLabels = Array(24).fill().map((_, i) => 
        `${String(i).padStart(2, '0')}:00`
    );
    
    // Create chart configuration
    const chartConfig = {
        type: 'bar',
        data: {
            labels: hourLabels,
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
                    backgroundColor: 'rgba(255, 159, 64, 0.7)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: !!options.title,
                    text: options.title || 'Daily Pattern Analysis',
                    color: themeConfig.fontColor
                },
                legend: {
                    position: 'top',
                    labels: {
                        color: themeConfig.fontColor
                    }
                },
                tooltip: {
                    backgroundColor: themeConfig.backgroundColor,
                    titleColor: themeConfig.fontColor,
                    bodyColor: themeConfig.fontColor,
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.raw.toFixed(2);
                            const hourIndex = context.dataIndex;
                            const sampleCount = hourlyData[hourIndex].count;
                            return `${label}: ${value} μg/m³ (${sampleCount} samples)`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Hour of Day',
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                },
                y: {
                    min: 0,
                    title: {
                        display: true,
                        text: 'PM Concentration (μg/m³)',
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                }
            }
        }
    };
    
    // Optional: Add temperature and humidity datasets if requested
    if (options.includeTemp) {
        chartConfig.data.datasets.push({
            label: 'Average Temperature',
            data: hourlyTempAvg,
            backgroundColor: 'rgba(75, 192, 192, 0.7)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
            type: 'line',
            yAxisID: 'y1'
        });
        
        // Add temperature y-axis
        chartConfig.options.scales.y1 = {
            position: 'right',
            title: {
                display: true,
                text: 'Temperature (°C)',
                color: themeConfig.fontColor
            },
            grid: {
                drawOnChartArea: false,
                color: themeConfig.gridColor
            },
            ticks: {
                color: themeConfig.fontColor
            }
        };
    }
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Create heatmap visualization using Chart.js
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Air quality data
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createHeatmapVisualization(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    if (!data || data.length === 0) {
        return renderNoDataMessage(canvasId);
    }
    
    // Sort data by date
    data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    // Group data by day and hour
    const heatmapData = [];
    const dayMap = new Map();
    let dayIndex = 0;
    
    data.forEach(item => {
        const date = new Date(item.created_at || item.timestamp);
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
    
    // Prepare matrix data
    const chartData = heatmapData.map(point => ({
        x: point.x,
        y: point.y,
        v: point.v
    }));
    
    // Create chart configuration
    const chartConfig = {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'PM2.5 Heatmap',
                data: chartData,
                backgroundColor(context) {
                    const value = context.dataset.data[context.dataIndex].v;
                    
                    // Get appropriate color based on AQI
                    for (const range of aqiColorRanges.pm25) {
                        if (value >= range.min && value <= range.max) {
                            return range.color;
                        }
                    }
                    // Fallback color
                    return 'rgba(0, 0, 0, 0.2)';
                },
                borderColor: themeConfig.backgroundColor === 'white' ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                borderWidth: 1,
                width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
                height: ({ chart }) => (chart.chartArea || {}).height / Math.max(1, days.length) - 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: !!options.title,
                    text: options.title || 'PM2.5 Concentration Heatmap',
                    color: themeConfig.fontColor
                },
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title() {
                            return '';
                        },
                        label(context) {
                            const data = heatmapData[context.dataIndex];
                            const value = data.v.toFixed(2);
                            const hour = data.x.toString().padStart(2, '0') + ':00';
                            return [
                                `Date: ${data.day}`,
                                `Time: ${hour}`,
                                `PM2.5: ${value} μg/m³`
                            ];
                        }
                    }
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
                        callback: value => value.toString().padStart(2, '0') + ':00',
                        color: themeConfig.fontColor
                    },
                    title: {
                        display: true,
                        text: 'Hour of Day',
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    }
                },
                y: {
                    type: 'linear',
                    offset: true,
                    min: 0,
                    max: days.length - 1,
                    ticks: {
                        stepSize: 1,
                        callback: value => days[value],
                        color: themeConfig.fontColor
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: themeConfig.fontColor
                    },
                    reverse: true,
                    grid: {
                        color: themeConfig.gridColor
                    }
                }
            }
        }
    };
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Create correlation visualization using Chart.js
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Air quality data
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createCorrelationVisualization(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    if (!data || data.length === 0) {
        return renderNoDataMessage(canvasId);
    }
    
    // Extract clean data arrays
    const pm25Values = [];
    const pm10Values = [];
    const tempValues = [];
    const humidityValues = [];
    
    data.forEach(item => {
        const pm25 = parseFloat(item.pm25 || item.field3);
        const pm10 = parseFloat(item.pm10 || item.field4);
        const temp = parseFloat(item.temperature || item.field2);
        const humidity = parseFloat(item.humidity || item.field1);
        
        if (!isNaN(pm25) && !isNaN(temp)) {
            pm25Values.push(pm25);
            tempValues.push(temp);
        }
        
        if (!isNaN(pm10) && !isNaN(humidity)) {
            pm10Values.push(pm10);
            humidityValues.push(humidity);
        }
    });
    
    // Default to temperature/PM2.5 correlation, but allow options to change it
    const xAxis = options.xAxis || 'temperature';
    const yAxis = options.yAxis || 'pm25';
    
    // Determine which data arrays to use
    let xValues, yValues, xLabel, yLabel;
    if (xAxis === 'temperature') {
        xValues = tempValues;
        xLabel = 'Temperature (°C)';
    } else if (xAxis === 'humidity') {
        xValues = humidityValues;
        xLabel = 'Humidity (%)';
    }
    
    if (yAxis === 'pm25') {
        yValues = pm25Values;
        yLabel = 'PM2.5 (μg/m³)';
    } else if (yAxis === 'pm10') {
        yValues = pm10Values;
        yLabel = 'PM10 (μg/m³)';
    }
    
    // Generate scatter plot data
    const scatterData = [];
    const minLength = Math.min(xValues.length, yValues.length);
    for (let i = 0; i < minLength; i++) {
        scatterData.push({
            x: xValues[i],
            y: yValues[i]
        });
    }
    
    // Create chart configuration
    const chartConfig = {
        type: 'scatter',
        data: {
            datasets: [{
                label: `${xLabel} vs ${yLabel}`,
                data: scatterData,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: options.title || `Correlation: ${xLabel} vs ${yLabel}`,
                    color: themeConfig.fontColor
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: themeConfig.backgroundColor,
                    titleColor: themeConfig.fontColor,
                    bodyColor: themeConfig.fontColor,
                    callbacks: {
                        label: function(context) {
                            const x = context.parsed.x.toFixed(1);
                            const y = context.parsed.y.toFixed(2);
                            return `${xLabel}: ${x}, ${yLabel}: ${y}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel,
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                }
            }
        }
    };
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Create AQI gauge visualization
 * @param {string} canvasId - Canvas element ID
 * @param {number} pm25Value - PM2.5 value
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createAQIGaugeVisualization(canvasId, pm25Value, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    // Define AQI levels and colors
    const aqiRanges = aqiColorRanges.pm25;
    
    // Find current AQI level
    let currentLevel = aqiRanges[aqiRanges.length - 1];
    for (const range of aqiRanges) {
        if (pm25Value >= range.min && pm25Value <= range.max) {
            currentLevel = range;
            break;
        }
    }
    
    // Create gauge segments
    const gaugeData = aqiRanges.map((range, index) => ({
        value: range.max - range.min,
        color: range.color,
        label: range.label
    }));
    
    // Normalize the data to percentages
    const maxAQI = 300; // Set a reasonable max for the gauge
    const normalizedValue = Math.min(pm25Value, maxAQI) / maxAQI;
    
    // Create chart configuration
    const chartConfig = {
        type: 'doughnut',
        data: {
            datasets: [{
                data: gaugeData.map(segment => segment.value),
                backgroundColor: gaugeData.map(segment => segment.color),
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                title: {
                    display: true,
                    text: options.title || 'Air Quality Index',
                    color: themeConfig.fontColor
                },
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        generateLabels: function(chart) {
                            return gaugeData.map((segment, i) => ({
                                text: segment.label,
                                fillStyle: segment.color,
                                strokeStyle: segment.color,
                                lineWidth: 0,
                                index: i
                            }));
                        },
                        color: themeConfig.fontColor
                    }
                },
                tooltip: {
                    enabled: false
                },
                needle: {
                    // Custom plugin to draw the needle
                    gaugeValue: normalizedValue,
                    color: themeConfig.fontColor
                },
                centerText: {
                    // Custom plugin to display value in center
                    display: true,
                    text: `${pm25Value.toFixed(1)}`,
                    label: 'PM2.5',
                    color: currentLevel.color,
                    quality: currentLevel.label
                }
            },
            layout: {
                padding: 20
            }
        },
        plugins: [{
            id: 'needle',
            afterDatasetDraw(chart, args, options) {
                const { ctx, config, data, chartArea } = chart;
                const dataset = data.datasets[0];
                const gaugeValue = config.options.plugins.needle.gaugeValue;
                
                // Draw needle
                const gaugeRadius = Math.min(chartArea.width, chartArea.height) / 2;
                const centreX = chartArea.width / 2;
                const centreY = chartArea.height;
                
                ctx.save();
                
                // Draw needle
                const needleLength = gaugeRadius * 0.8;
                const needleRadius = gaugeRadius * 0.04;
                const angle = Math.PI * (1 - gaugeValue);
                
                // Draw triangle needle
                ctx.translate(centreX, centreY);
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.moveTo(0, -5);
                ctx.lineTo(needleLength, 0);
                ctx.lineTo(0, 5);
                ctx.fillStyle = config.options.plugins.needle.color;
                ctx.fill();
                
                // Draw needle center
                ctx.translate(-0, -0);
                ctx.beginPath();
                ctx.arc(0, 0, needleRadius, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.restore();
            }
        }, {
            id: 'centerText',
            afterDatasetDraw(chart, args, options) {
                const { ctx, config, chartArea } = chart;
                const centerConfig = config.options.plugins.centerText;
                
                if (!centerConfig.display) return;
                
                const centreX = chartArea.width / 2;
                const centreY = chartArea.height;
                
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                // Draw main value
                ctx.font = '24px Arial';
                ctx.fillStyle = centerConfig.color;
                ctx.fillText(centerConfig.text, centreX, centreY - 30);
                
                // Draw label
                ctx.font = '14px Arial';
                ctx.fillStyle = themeConfig.fontColor;
                ctx.fillText(centerConfig.label, centreX, centreY - 10);
                
                // Draw quality text
                ctx.font = '16px Arial';
                ctx.fillStyle = centerConfig.color;
                ctx.fillText(centerConfig.quality, centreX, centreY + 15);
                
                ctx.restore();
            }
        }]
    };
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Create radial view of multiple parameters
 * @param {string} canvasId - Canvas element ID
 * @param {Object} data - Data object with current values for each parameter
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createRadarVisualization(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    if (!data) {
        return renderNoDataMessage(canvasId);
    }
    
    // Normalize values for radar chart
    // PM2.5: WHO guideline is 15 μg/m³, so 100% would be 30 μg/m³
    // PM10: WHO guideline is 45 μg/m³, so 100% would be 90 μg/m³
    // Temp: Normalized to 0-40 scale (0% = 0°C, 100% = 40°C)
    // Humidity: Already on a 0-100 scale
    
    const pm25 = parseFloat(data.pm25 || data.field3) || 0;
    const pm10 = parseFloat(data.pm10 || data.field4) || 0;
    const temp = parseFloat(data.temperature || data.field2) || 0;
    const humidity = parseFloat(data.humidity || data.field1) || 0;
    
    const normalizedPM25 = Math.min(100, (pm25 / 30) * 100);
    const normalizedPM10 = Math.min(100, (pm10 / 90) * 100);
    const normalizedTemp = Math.min(100, (temp / 40) * 100);
    const normalizedHumidity = Math.min(100, humidity);
    
    // Create chart configuration
    const chartConfig = {
        type: 'radar',
        data: {
            labels: ['PM2.5', 'PM10', 'Temperature', 'Humidity'],
            datasets: [{
                label: 'Current Values',
                data: [
                    normalizedPM25,
                    normalizedPM10,
                    normalizedTemp,
                    normalizedHumidity
                ],
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(54, 162, 235, 1)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: options.title || 'Environmental Parameters',
                    color: themeConfig.fontColor
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const labels = ['μg/m³', 'μg/m³', '°C', '%'];
                            const values = [pm25, pm10, temp, humidity];
                            return `${context.chart.data.labels[index]}: ${values[index].toFixed(1)} ${labels[index]}`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    angleLines: {
                        color: themeConfig.gridColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    pointLabels: {
                        color: themeConfig.fontColor
                    },
                    ticks: {
                        color: themeConfig.fontColor,
                        backdropColor: 'transparent'
                    }
                }
            }
        }
    };
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Create historical trend visualization (line chart with trend line)
 * @param {string} canvasId - Canvas element ID
 * @param {Array} data - Air quality data
 * @param {object} options - Configuration options
 * @returns {Chart} Chart.js instance
 */
function createTrendVisualization(canvasId, data, options = {}) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (!ctx) return null;
    
    // Configure theme
    const theme = options.theme || 'light';
    const themeConfig = chartThemes[theme];
    
    if (!data || data.length < 2) {
        return renderNoDataMessage(canvasId);
    }
    
    // Process data
    const parameter = options.parameter || 'pm25';
    const timestamps = data.map(d => new Date(d.created_at || d.timestamp));
    
    let values;
    let label;
    let color;
    
    switch (parameter) {
        case 'pm25':
            values = data.map(d => parseFloat(d.pm25 || d.field3));
            label = 'PM2.5 (μg/m³)';
            color = 'rgba(255, 99, 132, 1)';
            break;
        case 'pm10':
            values = data.map(d => parseFloat(d.pm10 || d.field4));
            label = 'PM10 (μg/m³)';
            color = 'rgba(255, 159, 64, 1)';
            break;
        case 'temperature':
            values = data.map(d => parseFloat(d.temperature || d.field2));
            label = 'Temperature (°C)';
            color = 'rgba(75, 192, 192, 1)';
            break;
        case 'humidity':
            values = data.map(d => parseFloat(d.humidity || d.field1));
            label = 'Humidity (%)';
            color = 'rgba(54, 162, 235, 1)';
            break;
    }
    
    // Calculate trend line
    const trendPoints = calculateTrendLine(timestamps, values);
    
    // Create chart configuration
    const chartConfig = {
        type: 'line',
        data: {
            labels: timestamps,
            datasets: [
                {
                    label: label,
                    data: values,
                    borderColor: color,
                    backgroundColor: color.replace('1)', '0.1)'),
                    tension: 0.2,
                    fill: true,
                    pointRadius: 2
                },
                {
                    label: 'Trend',
                    data: trendPoints,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: options.title || `${label} Trend Analysis`,
                    color: themeConfig.fontColor
                },
                legend: {
                    labels: {
                        color: themeConfig.fontColor
                    }
                },
                tooltip: {
                    backgroundColor: themeConfig.backgroundColor,
                    titleColor: themeConfig.fontColor,
                    bodyColor: themeConfig.fontColor
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: options.timeUnit || 'day'
                    },
                    title: {
                        display: true,
                        text: 'Date',
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: label,
                        color: themeConfig.fontColor
                    },
                    grid: {
                        color: themeConfig.gridColor
                    },
                    ticks: {
                        color: themeConfig.fontColor
                    }
                }
            }
        }
    };
    
    // Create and return chart
    return new Chart(ctx, chartConfig);
}

/**
 * Calculate trend line points for a dataset
 * @param {Array} xValues - X-axis values (dates)
 * @param {Array} yValues - Y-axis values (measurements)
 * @returns {Array} Trend line points
 */
function calculateTrendLine(xValues, yValues) {
    if (xValues.length !== yValues.length || xValues.length < 2) {
        return [];
    }
    
    // Convert dates to numeric values (milliseconds since epoch)
    const xNumeric = xValues.map(date => date.getTime());
    
    // Calculate averages
    const n = xNumeric.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += xNumeric[i];
        sumY += yValues[i];
        sumXY += xNumeric[i] * yValues[i];
        sumXX += xNumeric[i] * xNumeric[i];
    }
    
    // Calculate slope and y-intercept
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const yIntercept = (sumY - slope * sumX) / n;
    
    // Generate trend line points
    const trendPoints = xValues.map(date => {
        const x = date.getTime();
        return {
            x: date,
            y: slope * x + yIntercept
        };
    });
    
    return trendPoints;
}

/**
 * Display a message when no data is available
 * @param {string} canvasId - Canvas element ID
 * @returns {null}
 */
function renderNoDataMessage(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw message
    ctx.font = '20px Arial';
    ctx.fillStyle = '#888';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
    
    return null;
}

// Export functions for use in other modules
window.AirQualityViz = {
    createTimeSeriesVisualization,
    createDailyPatternVisualization,
    createHeatmapVisualization,
    createCorrelationVisualization,
    createAQIGaugeVisualization,
    createRadarVisualization,
    createTrendVisualization,
    chartThemes,
    aqiColorRanges,
    whoGuidelines
};
