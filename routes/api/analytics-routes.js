/**
 * Air Quality Monitoring System - Advanced Analytics API Routes
 * Provides endpoints for data cleaning, analytics, and predictions
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const AnalyticsService = require('../../services/analytics-service');
const PredictiveModeling = require('../../helpers/predictive-modeling');
const dataValidator = require('../../helpers/data-validator');
const csvDataService = require('../../services/csv-data-service');
const localDataService = require('../../services/local-data-service');

// Initialize services
const analyticsService = new AnalyticsService();
const predictiveModeling = new PredictiveModeling();

/**
 * @route   GET /api/analytics/status
 * @desc    Get status of analytics services
 * @access  Public
 */
router.get('/status', async (req, res) => {
    try {
        // Get data from last 24 hours to determine if we have enough data
        const lastDay = new Date();
        lastDay.setDate(lastDay.getDate() - 1);
        
        const recentData = await localDataService.getReadingsAfter(lastDay);
        
        return res.json({
            success: true,
            status: {
                analyticsServiceActive: true,
                predictionServiceActive: true,
                modelsLoaded: Object.keys(predictiveModeling.models).length > 0,
                availableModels: Object.keys(predictiveModeling.models),
                dataPoints24h: recentData.length,
                serverTime: new Date().toISOString(),
                dataQualitySummary: recentData.length > 10 ? 
                    dataValidator.getDataQualitySummary(recentData) : 
                    "Insufficient data for quality assessment"
            }
        });
    } catch (error) {
        console.error('Error in analytics status endpoint:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve analytics status',
            error: error.toString()
        });
    }
});

/**
 * @route   POST /api/analytics/clean-data
 * @desc    Clean and validate data
 * @access  Public
 */
router.post('/clean-data', async (req, res) => {
    try {
        const { data, options } = req.body;
        
        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Data array is required'
            });
        }
        
        // Set default options
        const cleanOptions = {
            removeOutliers: true,
            outlierMethod: 'iqr',
            interpolateMissing: true,
            noiseReduction: true,
            ...options
        };
        
        // Clean the data
        const cleanedData = dataValidator.validateAndCleanData(data, cleanOptions);
        
        return res.json({
            success: true,
            originalCount: data.length,
            cleanedCount: cleanedData.length,
            cleanedData,
            dataQualityMetrics: dataValidator.getDataQualitySummary(cleanedData)
        });
    } catch (error) {
        console.error('Error cleaning data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to clean data',
            error: error.toString()
        });
    }
});

/**
 * @route   GET /api/analytics/metrics
 * @desc    Get real-time analytics metrics
 * @access  Public
 */
router.get('/metrics', async (req, res) => {
    try {
        // Get timeframe from query params
        const timeframe = req.query.timeframe || '24h'; // Default to last 24 hours
        
        // Determine start time based on timeframe
        const startTime = new Date();
        
        if (timeframe === '1h') {
            startTime.setHours(startTime.getHours() - 1);
        } else if (timeframe === '6h') {
            startTime.setHours(startTime.getHours() - 6);
        } else if (timeframe === '24h') {
            startTime.setHours(startTime.getHours() - 24);
        } else if (timeframe === '7d') {
            startTime.setDate(startTime.getDate() - 7);
        } else if (timeframe === '30d') {
            startTime.setDate(startTime.getDate() - 30);
        }
        
        // Get data for the selected timeframe
        const data = await localDataService.getReadingsAfter(startTime);
        
        if (data.length === 0) {
            return res.json({
                success: true,
                message: 'No data available for the selected timeframe',
                metrics: {}
            });
        }
        
        // Process data through analytics service
        const analyticsResult = await analyticsService.processRealtimeData(data, false);
        
        return res.json({
            success: true,
            timeframe,
            dataPoints: data.length,
            metrics: analyticsResult.metrics,
            alerts: analyticsResult.alerts,
            generated: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error generating metrics:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate metrics',
            error: error.toString()
        });
    }
});

/**
 * @route   GET /api/analytics/trends
 * @desc    Get trend analysis
 * @access  Public
 */
router.get('/trends', async (req, res) => {
    try {
        // Get timeframe from query params
        const timeframe = req.query.timeframe || '24h';
        const timeUnit = req.query.timeUnit || 'hour';
        
        // Analyze trends
        const trendsResult = await analyticsService.analyzeTrends({
            timeRange: timeframe,
            timeUnit: timeUnit
        });
        
        return res.json(trendsResult);
    } catch (error) {
        console.error('Error analyzing trends:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to analyze trends',
            error: error.toString()
        });
    }
});

/**
 * @route   POST /api/analytics/train-models
 * @desc    Train prediction models
 * @access  Public
 */
router.post('/train-models', async (req, res) => {
    try {
        // Get training options
        const options = req.body.options || {};
        
        // Default to last 30 days of data if not specified
        const daysOfData = options.daysOfData || 30;
        
        // Get historical data for training
        const startTime = new Date();
        startTime.setDate(startTime.getDate() - daysOfData);
        
        const trainingData = await localDataService.getReadingsAfter(startTime);
        
        if (trainingData.length < 100) { // Require at least 100 data points for training
            return res.status(400).json({
                success: false,
                message: `Insufficient data for model training. Found ${trainingData.length} records, need at least 100.`
            });
        }
        
        // Train models
        const trainingResult = await predictiveModeling.trainModels(trainingData, options);
        
        return res.json(trainingResult);
    } catch (error) {
        console.error('Error training models:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to train models',
            error: error.toString()
        });
    }
});

/**
 * @route   GET /api/analytics/forecast
 * @desc    Get forecasts from trained models
 * @access  Public
 */
router.get('/forecast', async (req, res) => {
    try {
        // Get forecast options from query params
        const modelType = req.query.modelType; // Optional, will use best model if not specified
        const horizonHours = parseInt(req.query.horizon || 24); // Default 24 hours
        const intervalMinutes = parseInt(req.query.interval || 60); // Default 60 minutes
        
        // Check if we have trained models
        if (Object.keys(predictiveModeling.models).length === 0) {
            // Try to load saved models
            const modelsLoaded = await predictiveModeling.loadModels();
            
            if (!modelsLoaded) {
                return res.status(400).json({
                    success: false,
                    message: 'No trained models available. Please train models first.'
                });
            }
        }
        
        // Generate forecasts
        const forecastResult = predictiveModeling.generateForecasts({
            modelType,
            horizonHours,
            intervalMinutes
        });
        
        if (!forecastResult.success) {
            return res.status(400).json(forecastResult);
        }
        
        // Extract just the information we need
        return res.json({
            success: true,
            model_type: forecastResult.model_type,
            forecast: forecastResult.forecast,
            generated_at: forecastResult.generated_at,
            horizon_hours: forecastResult.horizon_hours
        });
    } catch (error) {
        console.error('Error generating forecast:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate forecast',
            error: error.toString()
        });
    }
});

/**
 * @route   GET /api/analytics/export
 * @desc    Export analytics data
 * @access  Public
 */
router.get('/export', async (req, res) => {
    try {
        // Get export options from query params
        const format = req.query.format || 'json'; // json or csv
        const type = req.query.type || 'metrics'; // metrics, forecast, or trends
        const timeframe = req.query.timeframe || '24h';
        
        let exportData;
        let filename;
        
        // Prepare data based on export type
        if (type === 'metrics') {
            // Get data for the selected timeframe
            const startTime = new Date();
            
            if (timeframe === '1h') {
                startTime.setHours(startTime.getHours() - 1);
            } else if (timeframe === '6h') {
                startTime.setHours(startTime.getHours() - 6);
            } else if (timeframe === '24h') {
                startTime.setHours(startTime.getHours() - 24);
            } else if (timeframe === '7d') {
                startTime.setDate(startTime.getDate() - 7);
            } else if (timeframe === '30d') {
                startTime.setDate(startTime.getDate() - 30);
            }
            
            const data = await localDataService.getReadingsAfter(startTime);
            const analyticsResult = await analyticsService.processRealtimeData(data, false);
            
            exportData = {
                timeframe,
                dataPoints: data.length,
                metrics: analyticsResult.metrics,
                alerts: analyticsResult.alerts,
                generated: new Date().toISOString()
            };
            
            filename = `air_quality_metrics_${timeframe}_${new Date().toISOString().split('T')[0]}`;
        } else if (type === 'forecast') {
            // Check if we have trained models
            if (Object.keys(predictiveModeling.models).length === 0) {
                // Try to load saved models
                const modelsLoaded = await predictiveModeling.loadModels();
                
                if (!modelsLoaded) {
                    return res.status(400).json({
                        success: false,
                        message: 'No trained models available. Please train models first.'
                    });
                }
            }
            
            // Generate forecasts
            const forecastResult = predictiveModeling.generateForecasts({
                horizonHours: parseInt(req.query.horizon || 24)
            });
            
            if (!forecastResult.success) {
                return res.status(400).json(forecastResult);
            }
            
            exportData = {
                model_type: forecastResult.model_type,
                forecast: forecastResult.forecast,
                generated_at: forecastResult.generated_at,
                horizon_hours: forecastResult.horizon_hours
            };
            
            filename = `air_quality_forecast_${forecastResult.horizon_hours}h_${new Date().toISOString().split('T')[0]}`;
        } else if (type === 'trends') {
            const trendsResult = await analyticsService.analyzeTrends({
                timeRange: timeframe,
                timeUnit: req.query.timeUnit || 'hour'
            });
            
            if (!trendsResult.success) {
                return res.status(400).json(trendsResult);
            }
            
            exportData = trendsResult;
            filename = `air_quality_trends_${timeframe}_${new Date().toISOString().split('T')[0]}`;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid export type. Must be one of: metrics, forecast, trends'
            });
        }
        
        // Generate response based on requested format
        if (format === 'json') {
            // Set response headers for file download
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
            return res.json(exportData);
        } else if (format === 'csv') {
            // Convert data to CSV format
            let csvContent = '';
            
            if (type === 'metrics') {
                // CSV header
                csvContent = 'Parameter,Latest,Mean,Median,Min,Max,StdDev\n';
                
                // Add rows for each parameter
                Object.entries(exportData.metrics.metrics).forEach(([param, values]) => {
                    csvContent += `${param},${values.latest},${values.mean},${values.median},${values.min},${values.max},${values.stdDev}\n`;
                });
            } else if (type === 'forecast') {
                // CSV header
                csvContent = 'Timestamp,PM2.5,PM10,Temperature,Humidity,AQI\n';
                
                // Add rows for each forecast point
                exportData.forecast.forEach(point => {
                    csvContent += `${point.timestamp},${point.pm25 || ''},${point.pm10 || ''},${point.temperature || ''},${point.humidity || ''},${point.aqi || ''}\n`;
                });
            } else if (type === 'trends') {
                // CSV header
                csvContent = 'Parameter,Trend,Change,PercentChange,FirstValue,LastValue\n';
                
                // Add rows for each parameter
                Object.entries(exportData.trends).forEach(([param, values]) => {
                    csvContent += `${param},${values.trend},${values.change},${values.percentChange}%,${values.firstValue},${values.lastValue}\n`;
                });
            }
            
            // Set response headers for CSV download
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
            return res.send(csvContent);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid format. Must be one of: json, csv'
            });
        }
    } catch (error) {
        console.error('Error exporting analytics data:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export analytics data',
            error: error.toString()
        });
    }
});

module.exports = router;