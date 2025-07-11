/**
 * LSTM Dashboard JavaScript
 * Handles LSTM model training, prediction, and evaluation
 */

// Charts for predictions and evaluations
let predictionChart = null;
let evaluationChart = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    document.getElementById('startTrainingBtn').addEventListener('click', trainModel);
    document.getElementById('trainModelBtn').addEventListener('click', showTrainingSection);
    document.getElementById('modelInfoBtn').addEventListener('click', showModelInfo);
    document.getElementById('exportForecastBtn').addEventListener('click', exportForecast);
    
    // Set up parameter button listeners
    document.querySelectorAll('.parameter-btn').forEach(button => {
        button.addEventListener('click', switchParameter);
    });
    
    // Set up forecast option links
    document.querySelectorAll('.lstm-option-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Update active class
            document.querySelectorAll('.lstm-option-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Refresh predictions
            refreshPredictions();
        });
    });
    
    // Initialize charts
    initCharts();
    
    // Check LSTM status
    checkLstmStatus();
    
    // Generate initial predictions
    refreshPredictions();
});

/**
 * Initialize charts for displaying predictions and evaluations
 */
function initCharts() {
    // Set up prediction chart
    const predictionCtx = document.getElementById('lstmPredictionChart').getContext('2d');
    predictionChart = new Chart(predictionCtx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'PM2.5 Actual',
                    data: [],
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderWidth: 2,
                    tension: 0.1
                },
                {
                    label: 'PM2.5 Predicted',
                    data: [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1
                },
                {
                    label: 'PM10 Actual',
                    data: [],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    tension: 0.1,
                    hidden: true
                },
                {
                    label: 'PM10 Predicted',
                    data: [],
                    borderColor: 'rgba(255, 159, 64, 1)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    hidden: true
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
                        unit: 'hour',
                        displayFormats: {
                            hour: 'MMM d, HH:mm'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Value (μg/m³)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy'
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy'
                    }
                }
            }
        }
    });
    
    // Set up training loss chart (will be initialized when training starts)
    // The training chart container might not exist yet
    const trainingChartEl = document.getElementById('trainingLossChart');
    if (trainingChartEl) {
        const trainingCtx = trainingChartEl.getContext('2d');
        window.trainingLossChart = new Chart(trainingCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Training Loss',
                        data: [],
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: 'Validation Loss',
                        data: [],
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.2)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Epoch'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Loss'
                        }
                    }
                }
            }
        });
    }
    
    // Set up evaluation chart
    const evaluationChartEl = document.getElementById('evaluation-chart');
    if (evaluationChartEl) {
        const evaluationCtx = evaluationChartEl.getContext('2d');
        evaluationChart = new Chart(evaluationCtx, {
            type: 'bar',
            data: {
                labels: ['PM2.5', 'PM10', 'Temperature', 'Humidity'],
                datasets: [
                    {
                        label: 'Mean Absolute Error (MAE)',
                        data: [],
                        backgroundColor: 'rgba(75, 192, 192, 0.7)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'Root Mean Squared Error (RMSE)',
                        data: [],
                        backgroundColor: 'rgba(255, 99, 132, 0.7)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Error Value'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Parameter'
                        }
                    }
                }
            }
        });
    }
}

/**
 * Check if LSTM model is trained and ready
 */
async function checkLstmStatus() {
    try {
        // Try direct LSTM model status endpoint first
        let response = await fetch('/api/lstm/status').catch(() => null);
        
        // If direct endpoint fails, try analytics status
        if (!response) {
            response = await fetch('/api/analytics/status');
        }
        
        const data = await response.json();
        
        // Update UI with model status
        const statusBadge = document.getElementById('model-status-badge');
        if (!statusBadge) return; // Safety check
        
        if (data.success) {
            // Clear loading spinner
            statusBadge.innerHTML = '';
            
            if ((data.modelStatus && data.modelStatus.trained) || 
                (data.status && data.status.predictionServiceActive && data.status.modelsLoaded)) {
                // Model is trained and ready
                statusBadge.innerHTML = `
                    <span class="badge bg-success">
                        <i class="bi bi-check-circle"></i> Model Trained
                    </span>
                `;
                
                // Update last trained date if available
                const lastTrainedElement = document.getElementById('last-trained-date');
                if (lastTrainedElement) {
                    const lastTrainedDate = data.modelStatus?.lastTrained || data.status?.lastModelTraining || 'Unknown';
                    lastTrainedElement.textContent = typeof lastTrainedDate === 'string' ? 
                        lastTrainedDate : new Date(lastTrainedDate).toLocaleString();
                }
                
                // Auto-refresh predictions
                setTimeout(() => {
                    refreshPredictions();
                }, 500);
            } else {
                // Model not trained
                statusBadge.innerHTML = `
                    <span class="badge bg-warning">
                        <i class="bi bi-exclamation-triangle"></i> Not Trained
                    </span>
                    <span class="ms-2">Please train the model first</span>
                `;
            }
        } else {
            // Error state
            statusBadge.innerHTML = `
                <span class="badge bg-danger">
                    <i class="bi bi-x-circle"></i> Error
                </span>
                <span class="ms-2">${data.message || 'Could not check model status'}</span>
            `;
        }
    } catch (error) {
        console.error('Error checking LSTM status:', error);
        
        // Update UI with error
        const statusBadge = document.getElementById('model-status-badge');
        if (statusBadge) {
            statusBadge.innerHTML = `
                <span class="badge bg-danger">
                    <i class="bi bi-x-circle"></i> Error
                </span>
                <span class="ms-2">Could not connect to LSTM service</span>
            `;
        }
    }
}

/**
 * Train the LSTM model
 */
async function trainModel() {
    try {
        // Update UI
        const trainBtn = document.getElementById('startTrainingBtn');
        const statusMessage = document.getElementById('training-status-message');
        const progressBar = document.getElementById('training-progress-bar');
        const progressContainer = document.getElementById('training-progress-container');
        
        trainBtn.disabled = true;
        trainBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Training...';
        
        // Show progress container
        progressContainer.classList.remove('d-none');
        statusMessage.textContent = 'Preparing data for training...';
        progressBar.style.width = '5%';
        progressBar.textContent = '5%';
        
        // Get training options
        const days = parseInt(document.getElementById('trainingDays').value) || 30;
        const epochs = parseInt(document.getElementById('epochs').value) || 50;
        const batchSize = parseInt(document.getElementById('batchSize').value) || 32;
        const validationSplit = parseFloat(document.getElementById('validationSplit').value) || 0.2;
        
        // Update UI to indicate data preparation
        statusMessage.textContent = `Fetching ${days} days of training data...`;
        progressBar.style.width = '10%';
        progressBar.textContent = '10%';
        
        // Send training request
        const response = await fetch('/api/lstm/train', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                days,
                options: {
                    epochs,
                    batchSize,
                    validationSplit
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update UI for success
            statusMessage.textContent = 'Training completed successfully!';
            progressBar.style.width = '100%';
            progressBar.textContent = '100%';
            progressBar.className = 'progress-bar bg-success';
            
            // Update metrics
            document.getElementById('current-epoch').textContent = epochs;
            
            // Update loss chart if data is available
            if (result.history && result.history.loss) {
                updateLossChart(result.history);
                
                // Update final metrics
                const lastLossIdx = result.history.loss.length - 1;
                document.getElementById('training-loss').textContent = 
                    result.history.loss[lastLossIdx].toFixed(4);
                document.getElementById('validation-loss').textContent = 
                    result.history.val_loss[lastLossIdx].toFixed(4);
            }
            
            // Update LSTM status
            checkLstmStatus();
            
            // Show success toast
            showToast('Training Complete', 'The LSTM model has been successfully trained and is ready for predictions.', 'success');
            
            // Auto-refresh predictions
            setTimeout(() => {
                refreshPredictions();
            }, 1000);
        } else {
            // Update UI for failure
            statusMessage.textContent = `Training failed: ${result.message || 'Unknown error'}`;
            progressBar.className = 'progress-bar bg-danger';
            
            // Show error toast
            showToast('Training Failed', result.message || 'Unknown error occurred during training', 'error');
        }
    } catch (error) {
        console.error('Error training model:', error);
        
        // Update UI for error
        const statusMessage = document.getElementById('training-status-message');
        const progressBar = document.getElementById('training-progress-bar');
        
        statusMessage.textContent = `Error: ${error.message}`;
        progressBar.className = 'progress-bar bg-danger';
        
        // Show error toast
        showToast('Training Error', `An error occurred: ${error.message}`, 'error');
    } finally {
        // Reset button
        const trainBtn = document.getElementById('startTrainingBtn');
        trainBtn.disabled = false;
        trainBtn.innerHTML = '<i class="bi bi-play-fill"></i> Start Training';
    }
}

/**
 * Update the loss chart with training history
 */
function updateLossChart(history) {
    const lossChartEl = document.getElementById('loss-chart');
    if (!lossChartEl) {
        // If the chart element doesn't exist, we need to create it
        const container = document.querySelector('#training-metrics');
        if (container) {
            const canvas = document.createElement('canvas');
            canvas.id = 'loss-chart';
            canvas.height = 200;
            container.appendChild(canvas);
        } else {
            return; // Cannot find container to add chart
        }
    }
    
    const ctx = document.getElementById('loss-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (window.lossChart) {
        window.lossChart.destroy();
    }
    
    // Create new chart
    window.lossChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: history.loss.length }, (_, i) => i + 1),
            datasets: [
                {
                    label: 'Training Loss',
                    data: history.loss,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    tension: 0.1
                },
                {
                    label: 'Validation Loss',
                    data: history.val_loss,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Epoch'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Loss'
                    }
                }
            }
        }
    });
    
    // Update date and time of training
    const lastTrainedDateEl = document.getElementById('last-trained-date');
    if (lastTrainedDateEl) {
        const now = new Date();
        lastTrainedDateEl.textContent = now.toLocaleString();
    }
}

/**
 * Show the training section
 */
function showTrainingSection() {
    // Find the training section by header text content
    const trainingHeaders = document.querySelectorAll('.card-header');
    let trainingSection = null;
    
    trainingHeaders.forEach(header => {
        if (header.textContent.includes('LSTM Model Training')) {
            trainingSection = header.closest('.card');
        }
    });
    
    // Scroll to training section if found
    if (trainingSection) {
        trainingSection.scrollIntoView({ behavior: 'smooth' });
    }
}

/**
 * Show model information
 */
function showModelInfo() {
    // Create a modal with model information
    const modalHtml = `
    <div class="modal fade" id="modelInfoModal" tabindex="-1" aria-labelledby="modelInfoModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modelInfoModalLabel">LSTM Model Information</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6">
                            <h6>Model Architecture</h6>
                            <ul class="list-group">
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Model Type
                                    <span class="badge bg-primary">LSTM (Long Short-Term Memory)</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    First Layer
                                    <span>LSTM(64, return_sequences=True)</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Dropout
                                    <span>0.2</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Second Layer
                                    <span>LSTM(32)</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Dropout
                                    <span>0.2</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Output Layer
                                    <span>Dense(4)</span>
                                </li>
                            </ul>
                        </div>
                        <div class="col-md-6">
                            <h6>Training Parameters</h6>
                            <ul class="list-group">
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Loss Function
                                    <span>Mean Squared Error (MSE)</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Optimizer
                                    <span>Adam</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Metrics
                                    <span>Mean Absolute Error (MAE)</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Default Epochs
                                    <span>50</span>
                                </li>
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    Default Batch Size
                                    <span>32</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <hr>
                    <h6>Key Features</h6>
                    <ul>
                        <li>Multivariate time series prediction (PM2.5, PM10, Temperature, Humidity)</li>
                        <li>Automatic data preprocessing and normalization</li>
                        <li>Sequence-based predictions (using last 24 hours to predict next values)</li>
                        <li>Self-adapting to seasonal and daily patterns</li>
                        <li>Customizable prediction horizon</li>
                    </ul>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>
    `;
    
    // Add modal to body if it doesn't exist
    if (!document.getElementById('modelInfoModal')) {
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer.firstElementChild);
    }
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('modelInfoModal'));
    modal.show();
}

/**
 * Export forecast data
 */
function exportForecast() {
    // Get the selected parameters
    const forecastHorizon = document.querySelector('.lstm-option-link.active').dataset.option || '24h';
    
    // Redirect to export endpoint
    window.location.href = `/api/analytics/export?type=forecast&format=csv&timeframe=${forecastHorizon}`;
}

/**
 * Generate predictions using the LSTM model
 */
async function refreshPredictions() {
    try {
        // Get prediction options from active link
        const forecastOption = document.querySelector('.lstm-option-link.active').dataset.option || '24h';
        let hours = 24;
        
        if (forecastOption === '48h') {
            hours = 48;
        } else if (forecastOption === '7d') {
            hours = 168; // 7 days * 24 hours
        }
        
        // Show loading indicator
        const predictionContainer = document.querySelector('.viz-container');
        predictionContainer.innerHTML = `
            <div class="d-flex justify-content-center align-items-center" style="height: 400px;">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading predictions...</span>
                </div>
                <span class="ms-3">Generating ${hours}-hour forecast...</span>
            </div>
        `;
        
        // Send prediction request
        const response = await fetch(`/api/lstm/predict?hours=${hours}&dataHours=${48}`);
        const result = await response.json();
        
        if (result.success && result.predictions) {
            // Restore the chart canvas
            predictionContainer.innerHTML = '<canvas id="lstmPredictionChart"></canvas>';
            
            // Reinitialize chart
            initCharts();
            
            // Update prediction chart and table
            updatePredictionChart(result.predictions);
            updatePredictionTable(result.predictions);
            
            // Show toast notification
            showToast('Forecast updated', 'Predictions have been successfully generated and updated.', 'success');
        } else {
            // Show error message
            predictionContainer.innerHTML = `
                <div class="alert alert-danger text-center">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    Failed to generate predictions: ${result.message || 'Unknown error'}
                </div>
                <div class="text-center mt-3">
                    <button class="btn btn-sm btn-primary" onclick="refreshPredictions()">
                        <i class="bi bi-arrow-clockwise"></i> Try Again
                    </button>
                </div>
            `;
            
            showToast('Forecast Error', result.message || 'Failed to generate predictions', 'error');
        }
    } catch (error) {
        console.error('Error generating predictions:', error);
        
        // Show error message
        const predictionContainer = document.querySelector('.viz-container');
        predictionContainer.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="bi bi-exclamation-triangle-fill"></i>
                Error: ${error.message}
            </div>
            <div class="text-center mt-3">
                <button class="btn btn-sm btn-primary" onclick="refreshPredictions()">
                    <i class="bi bi-arrow-clockwise"></i> Try Again
                </button>
            </div>
        `;
        
        showToast('Error', `Failed to generate predictions: ${error.message}`, 'error');
    }
}

/**
 * Update the prediction chart with new data
 */
function updatePredictionChart(predictions) {
    // Clear existing data
    predictionChart.data.labels = [];
    predictionChart.data.datasets.forEach(dataset => {
        dataset.data = [];
    });
    
    // Add prediction times
    const baseTime = new Date();
    
    // Add prediction data points
    predictions.forEach((point, index) => {
        const time = new Date(baseTime);
        time.setHours(time.getHours() + index);
        
        predictionChart.data.datasets[1].data.push({
            x: time,
            y: point.pm25
        });
        
        predictionChart.data.datasets[3].data.push({
            x: time,
            y: point.pm10
        });
    });
    
    // Update chart
    predictionChart.update();
}

/**
 * Update the prediction table with forecast data
 */
function updatePredictionTable(predictions) {
    const tableBody = document.getElementById('prediction-table-body');
    if (!tableBody) return;
    
    // Clear existing table rows
    tableBody.innerHTML = '';
    
    // Add prediction rows
    const baseTime = new Date();
    
    // Only show first 12 predictions in the table
    const displayPredictions = predictions.slice(0, 12);
    
    displayPredictions.forEach((point, index) => {
        const time = new Date(baseTime);
        time.setHours(time.getHours() + index);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${time.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</td>
            <td>${point.pm25.toFixed(1)}</td>
            <td>${point.pm10.toFixed(1)}</td>
            <td>${point.temperature ? point.temperature.toFixed(1) : 'N/A'}</td>
            <td>${point.humidity ? point.humidity.toFixed(1) : 'N/A'}</td>
        `;
        
        tableBody.appendChild(row);
    });
}

/**
 * Switch between different parameters in the prediction chart
 */
function switchParameter(event) {
    // Update active class
    document.querySelectorAll('.parameter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.currentTarget.classList.add('active');
    
    // Get selected parameter
    const param = event.currentTarget.dataset.param;
    
    // Show/hide relevant datasets in the chart
    switch(param) {
        case 'pm25':
            predictionChart.data.datasets[0].hidden = false;
            predictionChart.data.datasets[1].hidden = false;
            predictionChart.data.datasets[2].hidden = true;
            predictionChart.data.datasets[3].hidden = true;
            predictionChart.options.scales.y.title.text = 'PM2.5 (μg/m³)';
            break;
            
        case 'pm10':
            predictionChart.data.datasets[0].hidden = true;
            predictionChart.data.datasets[1].hidden = true;
            predictionChart.data.datasets[2].hidden = false;
            predictionChart.data.datasets[3].hidden = false;
            predictionChart.options.scales.y.title.text = 'PM10 (μg/m³)';
            break;
            
        case 'temperature':
            // We would need to add temperature datasets here
            break;
            
        case 'humidity':
            // We would need to add humidity datasets here
            break;
    }
    
    // Update chart
    predictionChart.update();
}

/**
 * Show a toast notification
 */
function showToast(title, message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    // Set background color based on type
    let bgColor = 'bg-info';
    if (type === 'success') bgColor = 'bg-success';
    if (type === 'error') bgColor = 'bg-danger';
    if (type === 'warning') bgColor = 'bg-warning';
    
    // Set toast content
    toast.innerHTML = `
        <div class="toast-header ${bgColor} text-white">
            <strong class="me-auto">${title}</strong>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
        <div class="toast-body">
            ${message}
        </div>
    `;
    
    // Add to toast container
    const toastContainer = document.getElementById('toast-container');
    toastContainer.appendChild(toast);
    
    // Initialize and show toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 5000
    });
    bsToast.show();
    
    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', function() {
        toast.remove();
    });
}

/**
 * Evaluate the LSTM model performance
 */
async function evaluateModel() {
    try {
        // Update UI
        const evaluateBtn = document.getElementById('evaluate-btn');
        const statusText = document.getElementById('evaluation-status');
        
        evaluateBtn.disabled = true;
        evaluateBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Evaluating...';
        statusText.textContent = 'Evaluating model...';
        statusText.className = 'text-info';
        
        // Get evaluation options
        const days = parseInt(document.getElementById('evaluation-days').value) || 7;
        
        // Send evaluation request
        const response = await fetch('/api/lstm/evaluate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days })
        });
        
        const result = await response.json();
        
        if (result.success && result.metrics) {
            statusText.textContent = 'Evaluation completed successfully!';
            statusText.className = 'text-success';
            
            // Update evaluation chart
            updateEvaluationChart(result.metrics);
            
            // Show the chart section
            document.getElementById('evaluation-chart-container').classList.remove('d-none');
        } else {
            statusText.textContent = `Evaluation failed: ${result.message || 'Unknown error'}`;
            statusText.className = 'text-danger';
        }
    } catch (error) {
        console.error('Error evaluating model:', error);
        const statusText = document.getElementById('evaluation-status');
        statusText.textContent = `Error: ${error.message}`;
        statusText.className = 'text-danger';
    } finally {
        // Reset button
        const evaluateBtn = document.getElementById('evaluate-btn');
        evaluateBtn.disabled = false;
        evaluateBtn.innerHTML = 'Evaluate Model';
    }
}

/**
 * Update the evaluation chart with new data
 */
function updateEvaluationChart(metrics) {
    // Extract metrics
    const features = Object.keys(metrics.mae);
    const maeValues = features.map(feature => metrics.mae[feature]);
    const rmseValues = features.map(feature => metrics.rmse[feature]);
    
    // Update chart data
    evaluationChart.data.labels = features;
    evaluationChart.data.datasets[0].data = maeValues;
    evaluationChart.data.datasets[1].data = rmseValues;
    
    // Update chart
    evaluationChart.update();
}
