/**
 * API Routes for Air Quality Forecasting
 */
const express = require('express');
const router = express.Router();
const predictionHelper = require('../../helpers/prediction-helper');
const dataService = require('../../services/local-data-service');
const debug = require('../../helpers/debug-helper');

/**
 * GET /api/forecast
 * Generate forecast for air quality parameters
 */
router.get('/', async (req, res) => {
  try {
    // Get query parameters with defaults
    const horizon = parseInt(req.query.horizon) || 24; // Default 24 hours
    const interval = parseInt(req.query.interval) || 60; // Default 60 minutes
    const modelType = req.query.model || 'exponentialSmoothing'; // Default model
    const dataHours = parseInt(req.query.dataHours) || 168; // Default 1 week of data
    
    // Get historical data for modeling
    const historicalData = await dataService.getRecentData(dataHours);
    
    if (!historicalData || historicalData.length < 24) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient historical data for forecasting'
      });
    }
    
    // Generate forecast
    const forecastResult = predictionHelper.generateCompleteForecast(historicalData, {
      modelType,
      horizonHours: horizon,
      intervalMinutes: interval
    });
    
    if (!forecastResult.success) {
      return res.status(500).json({
        success: false,
        message: forecastResult.message || 'Failed to generate forecast'
      });
    }
    
    // Return forecast
    return res.json({
      success: true,
      forecast: forecastResult.forecast,
      generated_at: forecastResult.generated_at,
      model_type: forecastResult.model_type,
      horizon_hours: forecastResult.horizon_hours
    });
  } catch (error) {
    debug.log(`Forecast API error: ${error.message}`, 'forecast-api');
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while generating forecast',
      error: error.message
    });
  }
});

/**
 * GET /api/forecast/evaluate
 * Evaluate forecast model accuracy
 */
router.get('/evaluate', async (req, res) => {
  try {
    // Get query parameters
    const modelType = req.query.model || 'exponentialSmoothing';
    const testHours = parseInt(req.query.testHours) || 24; // Hours of test data
    const trainHours = parseInt(req.query.trainHours) || 168; // Hours of training data
    
    // Get data for training and testing
    const allData = await dataService.getRecentData(trainHours + testHours);
    
    if (!allData || allData.length < (trainHours + testHours) / 2) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient data for model evaluation'
      });
    }
    
    // Split into training and test sets
    const splitIndex = Math.floor(allData.length * (trainHours / (trainHours + testHours)));
    const trainingData = allData.slice(0, splitIndex);
    const testData = allData.slice(splitIndex);
    
    if (trainingData.length < 24 || testData.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient data split for evaluation'
      });
    }
    
    // Create models for evaluation
    const modelsResult = predictionHelper.createForecastModels(trainingData, modelType);
    
    if (!modelsResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create forecast models for evaluation'
      });
    }
    
    // Evaluate each model
    const fields = ['pm25', 'pm10', 'temperature', 'humidity'];
    const evaluations = {};
    
    for (const field of fields) {
      const model = modelsResult.models[field];
      if (model && model.success) {
        evaluations[field] = predictionHelper.evaluateModelAccuracy(model, testData, field);
      }
    }
    
    return res.json({
      success: true,
      evaluations,
      model_type: modelType,
      training_points: trainingData.length,
      test_points: testData.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    debug.log(`Forecast evaluation API error: ${error.message}`, 'forecast-api');
    return res.status(500).json({
      success: false,
      message: 'Server error occurred while evaluating forecast models',
      error: error.message
    });
  }
});

/**
 * GET /api/forecast/models
 * Get available prediction model types
 */
router.get('/models', (req, res) => {
  const models = [
    {
      id: 'linear',
      name: 'Linear Regression',
      description: 'Simple linear trend forecasting. Good for short-term trends with minimal seasonal patterns.',
      min_data_points: 5
    },
    {
      id: 'exponentialSmoothing',
      name: 'Exponential Smoothing',
      description: 'Seasonal forecasting with trend and seasonal components. Good for data with daily or weekly patterns.',
      min_data_points: 48,
      recommended: true
    },
    {
      id: 'arima',
      name: 'ARIMA',
      description: 'Auto-Regressive Integrated Moving Average. Good for complex time series with seasonality removed.',
      min_data_points: 72
    }
  ];
  
  return res.json({
    success: true,
    models
  });
});

module.exports = router;