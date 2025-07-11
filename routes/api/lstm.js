/**
 * LSTM Model Routes
 * API endpoints for LSTM model training and predictions
 */
const express = require('express');
const router = express.Router();
const lstmService = require('../../services/lstm-service');
const localDataService = require('../../services/local-data-service');
const debug = require('../../helpers/debug-helper');

/**
 * @route   POST /api/lstm/train
 * @desc    Train LSTM model
 * @access  Public
 */
router.post('/train', async (req, res) => {
    try {
        const days = parseInt(req.body.days) || 30;
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - days);
        
        // Get training data
        const trainingData = await localDataService.getReadingsAfter(startTime);
        
        if (trainingData.length < 100) {
            return res.status(400).json({
                success: false,
                message: `Insufficient data for LSTM training. Found ${trainingData.length} records, need at least 100.`
            });
        }
        
        // Train model
        const result = await lstmService.trainModel(trainingData, req.body.options);
        
        return res.json(result);
    } catch (error) {
        debug.error(`LSTM training error: ${error.message}`, 'lstm-routes');
        return res.status(500).json({
            success: false,
            message: 'Failed to train LSTM model',
            error: error.toString()
        });
    }
});

/**
 * @route   GET /api/lstm/predict
 * @desc    Get LSTM predictions
 * @access  Public
 */
router.get('/predict', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours) || 24;
        const dataHours = parseInt(req.query.dataHours) || 48;
        
        // Get recent data for prediction
        const recentData = await localDataService.getRecentData(dataHours);
        
        if (!recentData || recentData.length < 24) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient recent data for prediction'
            });
        }
        
        // Generate predictions
        const result = await lstmService.predict(recentData, hours);
        
        return res.json(result);
    } catch (error) {
        debug.error(`LSTM prediction error: ${error.message}`, 'lstm-routes');
        return res.status(500).json({
            success: false,
            message: 'Failed to generate LSTM predictions',
            error: error.toString()
        });
    }
});

/**
 * @route   POST /api/lstm/evaluate
 * @desc    Evaluate LSTM model performance
 * @access  Public
 */
router.post('/evaluate', async (req, res) => {
    try {
        const days = parseInt(req.body.days) || 7;
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - days);
        
        // Get test data
        const testData = await localDataService.getReadingsAfter(startTime);
        
        if (testData.length < 48) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient test data for evaluation'
            });
        }
        
        // Evaluate model
        const result = await lstmService.evaluate(testData);
        
        return res.json(result);
    } catch (error) {
        debug.error(`LSTM evaluation error: ${error.message}`, 'lstm-routes');
        return res.status(500).json({
            success: false,
            message: 'Failed to evaluate LSTM model',
            error: error.toString()
        });
    }
});

/**
 * @route   GET /api/lstm/status
 * @desc    Check LSTM model status
 * @access  Public
 */
router.get('/status', async (req, res) => {
    try {
        // Check if Python API is running
        const apiStatus = lstmService.isRunning;
        
        // Check if model exists and get training information
        const fs = require('fs');
        const path = require('path');
        const modelPath = path.join(__dirname, '../../python/models/lstm/lstm_model.pth');
        const modelExists = fs.existsSync(modelPath);
        
        // Get model creation time if exists
        let lastTrained = null;
        if (modelExists) {
            const stats = fs.statSync(modelPath);
            lastTrained = stats.mtime;
        }
        
        return res.json({
            success: true,
            status: {
                apiRunning: apiStatus,
                modelTrained: modelExists,
                lastTrained: lastTrained,
                readyForPrediction: apiStatus && modelExists,
                framework: 'PyTorch',
                gpu: {
                    available: true, // Will be dynamically checked by Python
                    device: 'CUDA' // Will be updated by Python service
                }
            }
        });
    } catch (error) {
        debug.error(`LSTM status check error: ${error.message}`, 'lstm-routes');
        return res.status(500).json({
            success: false,
            message: 'Failed to check LSTM model status',
            error: error.toString()
        });
    }
});

module.exports = router;
