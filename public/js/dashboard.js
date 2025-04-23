// Global variables
let currentDataSource = 'csv'; // Default to CSV file instead of ThingSpeak
let cachedData = [];
let currentPage = 0;
let recordsPerPage = 10;
let currentVizType = 'time_series';
let vizMode = 'client';
let realtimeUpdatesEnabled = true;
let updateInterval = null;
let currentChartInstance = null;
let isDarkMode = localStorage.getItem('darkMode') === 'true';

// DOM elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const dataTableBody = document.getElementById('data-table-body');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const dataTableInfo = document.getElementById('data-table-info');
const vizContainer = document.getElementById('visualization-container');
const vizTitle = document.getElementById('vizTitle');
const vizDescription = document.getElementById('viz-description');

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Apply theme if saved in localStorage
    applyTheme();
    
    // Initialize date range picker
    initDatePicker();
    
    // Set up event listeners
    setupEventListeners();
    
    // Fetch data sources information
    fetchDataSources().then(sourceInfo => {
        // Use the recommended source from the API
        if (sourceInfo && sourceInfo.recommendedSource) {
            currentDataSource = sourceInfo.recommendedSource;
            updateSourceIndicator(currentDataSource);
        }
        
        // Initialize the dashboard with the selected data source
        loadDashboardData();
    });
    
    // Set up real-time updates
    setupRealTimeUpdates();
});

// Fetch information about available data sources
async function fetchDataSources() {
    try {
        const response = await fetch('/api/data/source-info');
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        throw new Error('Failed to fetch data sources');
    } catch (error) {
        console.error('Error fetching data sources:', error);
        showToast('Error fetching data sources', 'error');
        return { recommendedSource: 'thingspeak' };
    }
}

// Update the UI to indicate the current data source
function updateSourceIndicator(source) {
    const sourceName = source === 'csv' ? 'Local CSV File' : 'ThingSpeak';
    statusText.textContent = `Source: ${sourceName}`;
    statusIndicator.className = 'status-indicator connected';
    
    // Add source indicator to document title
    document.title = `Air Quality Dashboard (${sourceName})`;
}

// Initialize date range picker
function initDatePicker() {
    flatpickr("#dateRange", {
        mode: "range",
        dateFormat: "Y-m-d",
        maxDate: "today",
        defaultDate: [
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 
            new Date()
        ]
    });

    flatpickr("#timeFilter", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        defaultDate: "now",
        time_24hr: true
    });
}

// Set up event listeners for buttons and controls
function setupEventListeners() {
    // Visualization type links
    document.querySelectorAll('.viz-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const vizType = e.target.closest('.viz-link').dataset.type;
            updateVisualization(vizType);
            
            // Update active class
            document.querySelectorAll('.viz-link').forEach(l => l.classList.remove('active'));
            e.target.closest('.viz-link').classList.add('active');
        });
    });
    
    // Toggle visualization mode (client-side vs server-side)
    document.getElementById('toggleVizMode').addEventListener('click', () => {
        vizMode = vizMode === 'client' ? 'server' : 'client';
        document.getElementById('vizModeText').textContent = `${vizMode === 'client' ? 'Client-side' : 'Server-side'}`;
        updateVisualization(currentVizType);
    });
    
    // Refresh visualization button
    document.getElementById('refreshViz').addEventListener('click', () => {
        updateVisualization(currentVizType);
    });
    
    // Date filter button
    document.getElementById('applyDateFilter').addEventListener('click', () => {
        loadDashboardData();
    });
    
    // Refresh table button
    document.getElementById('refreshTable').addEventListener('click', () => {
        loadDataTable();
    });
    
    // Real-time updates toggle
    document.getElementById('realtimeSwitch').addEventListener('change', (e) => {
        realtimeUpdatesEnabled = e.target.checked;
        if (realtimeUpdatesEnabled) {
            setupRealTimeUpdates();
        } else {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    });
    
    // Pagination buttons
    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 0) {
            currentPage--;
            renderDataTable();
        }
    });
    
    nextPageBtn.addEventListener('click', () => {
        const maxPage = Math.ceil(cachedData.length / recordsPerPage) - 1;
        if (currentPage < maxPage) {
            currentPage++;
            renderDataTable();
        }
    });
    
    // Toggle dark/light theme
    document.getElementById('toggleTheme').addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('darkMode', isDarkMode);
        applyTheme();
    });

    // Upload CSV button
    document.getElementById('uploadDataBtn').addEventListener('click', () => {
        // This would typically show a modal for CSV upload
        alert('CSV upload functionality can be implemented here');
    });

    // ThingSpeak Info button
    document.getElementById('thingspeakInfoBtn').addEventListener('click', () => {
        window.location.href = '/thingspeak-info';
    });
}

// Set up or reset the real-time update interval
function setupRealTimeUpdates() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    if (realtimeUpdatesEnabled) {
        updateInterval = setInterval(() => {
            loadDashboardData(true);
        }, 30000); // Update every 30 seconds
    }
}

// Apply dark or light theme
function applyTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('toggleTheme').innerHTML = '<i class="bi bi-sun-fill"></i>';
    } else {
        document.body.classList.remove('dark-mode');
        document.getElementById('toggleTheme').innerHTML = '<i class="bi bi-moon-fill"></i>';
    }
}

// Load dashboard data based on selected source and filters
async function loadDashboardData(isBackgroundUpdate = false) {
    if (!isBackgroundUpdate) {
        showLoadingState();
    }
    
    try {
        let data;
        const dateRange = document.getElementById('dateRange').value;
        
        // Fetch data from the selected source
        if (currentDataSource === 'csv') {
            const response = await fetch('/api/csv/data?limit=1000');
            if (!response.ok) throw new Error('Failed to fetch CSV data');
            const result = await response.json();
            data = result.data || [];
        } else {
            const response = await fetch('/api/thingspeak/data?results=1000');
            if (!response.ok) throw new Error('Failed to fetch ThingSpeak data');
            const result = await response.json();
            data = result.feeds || [];
        }
        
        // Apply date filter if specified
        if (dateRange) {
            const [startDate, endDate] = dateRange.split(' to ').map(date => new Date(date));
            if (endDate) endDate.setHours(23, 59, 59, 999); // End of day
            
            data = data.filter(item => {
                const itemDate = new Date(item.created_at);
                if (endDate) {
                    return itemDate >= startDate && itemDate <= endDate;
                }
                return itemDate.toDateString() === startDate.toDateString();
            });
        }
        
        // Update cached data
        cachedData = data;
        
        // Update UI components
        updateStatistics(data);
        renderDataTable();
        updateVisualization(currentVizType);
        validateData(data);
        
        // Update connection status
        statusIndicator.className = 'status-indicator connected';
        updateSourceIndicator(currentDataSource);
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Connection Error';
        
        if (!isBackgroundUpdate) {
            showToast('Failed to load data. Please try again later.', 'error');
        }
    }
}

// Show loading state
function showLoadingState() {
    // Set loading indicator for statistics
    document.getElementById('avgPM25').textContent = '...';
    document.getElementById('avgPM10').textContent = '...';
    document.getElementById('avgTemp').textContent = '...';
    document.getElementById('avgHumidity').textContent = '...';
    
    // Set loading state for data table
    dataTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading data...</td></tr>';
}

// Calculate and display statistics
function updateStatistics(data) {
    if (!data || data.length === 0) {
        document.getElementById('avgPM25').textContent = 'N/A';
        document.getElementById('avgPM10').textContent = 'N/A';
        document.getElementById('avgTemp').textContent = 'N/A';
        document.getElementById('avgHumidity').textContent = 'N/A';
        document.getElementById('peakPM25').textContent = 'N/A';
        document.getElementById('peakPM10').textContent = 'N/A';
        document.getElementById('lowPM25').textContent = 'N/A';
        document.getElementById('lowPM10').textContent = 'N/A';
        return;
    }

    // Calculate averages
    let pmSumPM25 = 0, pmSumPM10 = 0, tempSum = 0, humiditySum = 0;
    let countPM25 = 0, countPM10 = 0, countTemp = 0, countHumidity = 0;
    let maxPM25 = -Infinity, maxPM10 = -Infinity;
    let minPM25 = Infinity, minPM10 = Infinity;
    
    data.forEach(item => {
        // Handle either field3/field4 naming (ThingSpeak) or pm25/pm10 naming (CSV)
        const pm25Value = parseFloat(item.pm25 || item.field3);
        const pm10Value = parseFloat(item.pm10 || item.field4);
        const tempValue = parseFloat(item.temperature || item.field2);
        const humidityValue = parseFloat(item.humidity || item.field1);
        
        if (!isNaN(pm25Value)) {
            pmSumPM25 += pm25Value;
            countPM25++;
            maxPM25 = Math.max(maxPM25, pm25Value);
            minPM25 = Math.min(minPM25, pm25Value);
        }
        
        if (!isNaN(pm10Value)) {
            pmSumPM10 += pm10Value;
            countPM10++;
            maxPM10 = Math.max(maxPM10, pm10Value);
            minPM10 = Math.min(minPM10, pm10Value);
        }
        
        if (!isNaN(tempValue)) {
            tempSum += tempValue;
            countTemp++;
        }
        
        if (!isNaN(humidityValue)) {
            humiditySum += humidityValue;
            countHumidity++;
        }
    });
    
    // Update UI with calculated averages
    document.getElementById('avgPM25').textContent = countPM25 > 0 ? (pmSumPM25 / countPM25).toFixed(2) : 'N/A';
    document.getElementById('avgPM10').textContent = countPM10 > 0 ? (pmSumPM10 / countPM10).toFixed(2) : 'N/A';
    document.getElementById('avgTemp').textContent = countTemp > 0 ? (tempSum / countTemp).toFixed(1) : 'N/A';
    document.getElementById('avgHumidity').textContent = countHumidity > 0 ? Math.round(humiditySum / countHumidity) : 'N/A';
    
    // Update peak and low values
    document.getElementById('peakPM25').textContent = isFinite(maxPM25) ? maxPM25.toFixed(2) : 'N/A';
    document.getElementById('peakPM10').textContent = isFinite(maxPM10) ? maxPM10.toFixed(2) : 'N/A';
    document.getElementById('lowPM25').textContent = isFinite(minPM25) ? minPM25.toFixed(2) : 'N/A';
    document.getElementById('lowPM10').textContent = isFinite(minPM10) ? minPM10.toFixed(2) : 'N/A';
}

// Render the data table with current page of data
function renderDataTable() {
    if (cachedData.length === 0) {
        dataTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
        dataTableInfo.textContent = 'No records found';
        prevPageBtn.disabled = true;
        nextPageBtn.disabled = true;
        return;
    }
    
    const start = currentPage * recordsPerPage;
    const end = Math.min(start + recordsPerPage, cachedData.length);
    const pageData = cachedData.slice(start, end);
    
    dataTableBody.innerHTML = '';
    pageData.forEach(item => {
        const row = document.createElement('tr');
        
        // Format timestamp
        let timestamp = '';
        try {
            const date = new Date(item.created_at);
            timestamp = date.toLocaleString();
        } catch (e) {
            timestamp = item.created_at || 'Unknown';
        }
        
        // Add data cells
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${formatValue(item.pm25 || item.field3)}</td>
            <td>${formatValue(item.pm10 || item.field4)}</td>
            <td>${formatValue(item.temperature || item.field2)}</td>
            <td>${formatValue(item.humidity || item.field1)}</td>
        `;
        
        dataTableBody.appendChild(row);
    });
    
    // Update pagination info
    dataTableInfo.textContent = `Showing ${start + 1} to ${end} of ${cachedData.length} records`;
    prevPageBtn.disabled = currentPage === 0;
    nextPageBtn.disabled = end >= cachedData.length;
}

// Format a value for display
function formatValue(value) {
    if (value === undefined || value === null || value === '') {
        return 'N/A';
    }
    const numeric = parseFloat(value);
    if (isNaN(numeric)) {
        return value;
    }
    return numeric.toFixed(2);
}

// Update the visualization based on selected type
function updateVisualization(vizType) {
    currentVizType = vizType;
    
    // Set visualization title and description
    switch (vizType) {
        case 'time_series':
            vizTitle.textContent = 'Time Series Visualization';
            vizDescription.textContent = 'Shows PM2.5 and PM10 values over time.';
            break;
        case 'daily_pattern':
            vizTitle.textContent = 'Daily Pattern Analysis';
            vizDescription.textContent = 'Shows how air quality varies by hour of day.';
            break;
        case 'heatmap':
            vizTitle.textContent = 'Air Quality Heatmap';
            vizDescription.textContent = 'Shows the distribution and intensity of air quality measurements.';
            break;
        case 'correlation':
            vizTitle.textContent = 'Parameter Correlation';
            vizDescription.textContent = 'Shows relationships between different air quality parameters.';
            break;
    }
    
    // Show loading state
    vizContainer.innerHTML = `
        <div class="d-flex justify-content-center align-items-center h-100">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
        </div>
    `;
    
    // Destroy any existing chart
    if (currentChartInstance) {
        currentChartInstance.destroy();
        currentChartInstance = null;
    }
    
    // Create visualization based on selected mode
    if (vizMode === 'client') {
        createClientSideVisualization(vizType);
    } else {
        createServerSideVisualization(vizType);
    }
}

// Create client-side visualization
function createClientSideVisualization(vizType) {
    try {
        // Call appropriate visualization function based on type
        switch (vizType) {
            case 'time_series':
                currentChartInstance = createTimeSeriesChart(cachedData);
                break;
            case 'daily_pattern':
                currentChartInstance = createDailyPatternChart(cachedData);
                break;
            case 'heatmap':
                currentChartInstance = createHeatmapChart(cachedData);
                break;
            case 'correlation':
                currentChartInstance = createCorrelationChart(cachedData);
                break;
            default:
                currentChartInstance = createTimeSeriesChart(cachedData);
                break;
        }
    } catch (error) {
        console.error('Error creating visualization:', error);
        vizContainer.innerHTML = `
            <div class="alert alert-danger">
                Failed to create visualization. Please try another visualization type or refresh the page.
            </div>
        `;
        
        // Fall back to a more basic visualization if available
        try {
            createFallbackVisualization(vizType, cachedData, vizContainer);
        } catch (fallbackError) {
            console.error('Fallback visualization also failed:', fallbackError);
        }
    }
}

// Create time series chart for PM2.5 and PM10 data
function createTimeSeriesChart(data) {
    // Clear the container
    vizContainer.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.id = 'timeSeriesChart';
    vizContainer.appendChild(canvas);
    
    // Prepare data
    const chartData = {
        labels: [],
        pm25: [],
        pm10: []
    };
    
    // Process data in chronological order (oldest first)
    const sortedData = [...data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    sortedData.forEach(item => {
        const date = new Date(item.created_at);
        chartData.labels.push(date);
        chartData.pm25.push(parseFloat(item.pm25 || item.field3) || null);
        chartData.pm10.push(parseFloat(item.pm10 || item.field4) || null);
    });
    
    // Create chart
    return new Chart(canvas, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: [
                {
                    label: 'PM2.5 (μg/m³)',
                    data: chartData.pm25,
                    borderColor: 'rgb(53, 162, 235)',
                    backgroundColor: 'rgba(53, 162, 235, 0.5)',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 1
                },
                {
                    label: 'PM10 (μg/m³)',
                    data: chartData.pm10,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.5)',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Air Quality Over Time'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(tooltipItems) {
                            const date = new Date(tooltipItems[0].parsed.x);
                            return date.toLocaleString();
                        }
                    }
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                },
                annotation: {
                    annotations: {
                        pm25Line: {
                            type: 'line',
                            yMin: 15,
                            yMax: 15,
                            borderColor: 'rgba(53, 162, 235, 0.5)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'PM2.5 WHO Guideline',
                                enabled: true,
                                position: 'end'
                            }
                        },
                        pm10Line: {
                            type: 'line',
                            yMin: 45,
                            yMax: 45,
                            borderColor: 'rgba(255, 99, 132, 0.5)',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            label: {
                                content: 'PM10 WHO Guideline',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'hour'
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Value (μg/m³)'
                    }
                }
            }
        }
    });
}

// Implement basic versions of other charts
function createDailyPatternChart(data) {
    // Implementation for daily pattern chart...
    vizContainer.innerHTML = `<div class="alert alert-info">Daily pattern chart would be shown here.</div>`;
    return null;
}

function createHeatmapChart(data) {
    // Implementation for heatmap chart...
    vizContainer.innerHTML = `<div class="alert alert-info">Heatmap chart would be shown here.</div>`;
    return null;
}

function createCorrelationChart(data) {
    // Implementation for correlation chart...
    vizContainer.innerHTML = `<div class="alert alert-info">Correlation chart would be shown here.</div>`;
    return null;
}

// Create server-side visualization
function createServerSideVisualization(vizType) {
    const endpoint = `/api/visualization/${vizType}?source=${currentDataSource}`;
    vizContainer.innerHTML = `<img class="img-fluid" src="${endpoint}" alt="${vizType} visualization" />`;
}

// Validate data quality
function validateData(data) {
    const validationBadge = document.getElementById('validation-badge');
    const validationDetails = document.getElementById('validation-details');
    
    // Simple validation logic - check for missing values
    let missingCount = 0;
    let totalFields = 0;
    let unrealisticValues = 0;
    
    data.forEach(item => {
        // Check PM2.5
        const pm25 = parseFloat(item.pm25 || item.field3);
        if (isNaN(pm25)) missingCount++;
        else if (pm25 < 0 || pm25 > 1000) unrealisticValues++;
        totalFields++;
        
        // Check PM10
        const pm10 = parseFloat(item.pm10 || item.field4);
        if (isNaN(pm10)) missingCount++;
        else if (pm10 < 0 || pm10 > 2000) unrealisticValues++;
        totalFields++;
        
        // Check temperature
        const temp = parseFloat(item.temperature || item.field2);
        if (isNaN(temp)) missingCount++;
        else if (temp < -50 || temp > 60) unrealisticValues++;
        totalFields++;
        
        // Check humidity
        const humidity = parseFloat(item.humidity || item.field1);
        if (isNaN(humidity)) missingCount++;
        else if (humidity < 0 || humidity > 100) unrealisticValues++;
        totalFields++;
    });
    
    const completeness = totalFields > 0 ? 100 - (missingCount / totalFields * 100) : 0;
    const realisticRate = totalFields > 0 ? 100 - (unrealisticValues / totalFields * 100) : 0;
    
    // Update the validation badge and details
    let qualityStatus;
    let badgeClass;
    
    if (completeness > 95 && realisticRate > 98) {
        qualityStatus = 'Excellent';
        badgeClass = 'bg-success';
    } else if (completeness > 85 && realisticRate > 90) {
        qualityStatus = 'Good';
        badgeClass = 'bg-primary';
    } else if (completeness > 70 && realisticRate > 80) {
        qualityStatus = 'Acceptable';
        badgeClass = 'bg-warning';
    } else {
        qualityStatus = 'Poor';
        badgeClass = 'bg-danger';
    }
    
    validationBadge.textContent = qualityStatus;
    validationBadge.className = `badge ${badgeClass}`;
    
    validationDetails.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">Data Completeness</label>
                    <div class="progress">
                        <div class="progress-bar bg-info" role="progressbar" style="width: ${completeness}%"
                             aria-valuenow="${completeness}" aria-valuemin="0" aria-valuemax="100">
                            ${completeness.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="mb-3">
                    <label class="form-label">Data Realism</label>
                    <div class="progress">
                        <div class="progress-bar bg-info" role="progressbar" style="width: ${realisticRate}%"
                             aria-valuenow="${realisticRate}" aria-valuemin="0" aria-valuemax="100">
                            ${realisticRate.toFixed(1)}%
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="small text-muted">
            Based on ${data.length} records with ${totalFields} total data points.
            <br>${missingCount} missing values and ${unrealisticValues} potentially unrealistic values detected.
        </div>
    `;
}

// Show a toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast align-items-center border-0 show`;
    toast.classList.add(`bg-${type === 'error' ? 'danger' : type}`);
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body text-white">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// Function to download current data as CSV
function downloadData() {
    if (cachedData.length === 0) {
        showToast('No data available to download', 'warning');
        return;
    }
    
    try {
        // Convert data to CSV
        const headers = ['Timestamp', 'PM2.5', 'PM10', 'Temperature', 'Humidity'];
        const csvRows = [];
        
        // Add headers
        csvRows.push(headers.join(','));
        
        // Add data rows
        cachedData.forEach(item => {
            const pm25 = parseFloat(item.pm25 || item.field3);
            const pm10 = parseFloat(item.pm10 || item.field4);
            const temp = parseFloat(item.temperature || item.field2);
            const humidity = parseFloat(item.humidity || item.field1);
            
            const row = [
                item.created_at || new Date().toISOString(),
                isNaN(pm25) ? '' : pm25,
                isNaN(pm10) ? '' : pm10,
                isNaN(temp) ? '' : temp,
                isNaN(humidity) ? '' : humidity
            ];
            
            csvRows.push(row.join(','));
        });
        
        // Create and download the CSV file
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `air_quality_data_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Data downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading data:', error);
        showToast('Error downloading data', 'error');
    }
}
