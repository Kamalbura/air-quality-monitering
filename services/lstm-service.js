/**
 * LSTM Model Service
 * Handles communication with Python LSTM model API
 */
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const debug = require('../helpers/debug-helper');
const fs = require('fs');

class LSTMService {
    constructor() {
        this.pythonProcess = null;
        this.apiUrl = 'http://localhost:5000';
        this.isRunning = false;
        this.modelPath = path.join(__dirname, '..', 'python', 'models', 'lstm');
    }

    async start() {
        if (this.isRunning) return;

        try {
            // Start Python API server
            const scriptPath = path.join(__dirname, '..', 'python', 'lstm_api.py');
            this.pythonProcess = spawn('python', [scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Log Python process output
            this.pythonProcess.stdout.on('data', (data) => {
                debug.log(`Python LSTM API: ${data}`, 'lstm-service');
            });

            this.pythonProcess.stderr.on('data', (data) => {
                debug.error(`Python LSTM API Error: ${data}`, 'lstm-service');
            });

            this.isRunning = true;

            // Wait for server to start
            await new Promise(resolve => setTimeout(resolve, 2000));
            debug.log('LSTM service started successfully', 'lstm-service');
        } catch (error) {
            debug.error(`Failed to start LSTM service: ${error.message}`, 'lstm-service');
            throw error;
        }
    }

    async stop() {
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.isRunning = false;
            debug.log('LSTM service stopped', 'lstm-service');
        }
    }

    async trainModel(data, options = {}) {
        try {
            if (!this.isRunning) await this.start();

            const response = await axios.post(`${this.apiUrl}/train`, {
                data: data,
                options: options
            });

            return response.data;
        } catch (error) {
            debug.error(`LSTM training error: ${error.message}`, 'lstm-service');
            throw error;
        }
    }

    async predict(data, n_future = 24) {
        try {
            if (!this.isRunning) await this.start();

            const response = await axios.post(`${this.apiUrl}/predict`, {
                data: data,
                n_future: n_future
            });

            return response.data;
        } catch (error) {
            debug.error(`LSTM prediction error: ${error.message}`, 'lstm-service');
            throw error;
        }
    }    async evaluate(testData) {
        try {
            if (!this.isRunning) await this.start();

            const response = await axios.post(`${this.apiUrl}/evaluate`, {
                data: testData
            });

            return response.data;
        } catch (error) {
            debug.error(`LSTM evaluation error: ${error.message}`, 'lstm-service');
            throw error;
        }
    }
    
    /**
     * Check LSTM model status including:
     * - If Python Flask API is running
     * - If model exists and when it was last trained
     * @returns {Object} Status information
     */    async checkStatus() {
        try {
            // Check if model file exists (updated for PyTorch)
            const modelFile = path.join(this.modelPath, 'lstm_model.pth');
            const scalerFile = path.join(this.modelPath, 'scaler.pkl');
            
            let modelExists = fs.existsSync(modelFile) && fs.existsSync(scalerFile);
            let lastTrained = null;
            
            if (modelExists) {
                // Get model creation time
                const stats = fs.statSync(modelFile);
                lastTrained = stats.mtime;
            }
            
            // Try to ping API if it's supposed to be running
            let apiRunning = this.isRunning;
            if (apiRunning) {
                try {
                    // Simple health check request
                    await axios.get(`${this.apiUrl}`, { timeout: 1000 });
                } catch (error) {
                    apiRunning = false;
                    // If API check fails but we think it's running, try to restart
                    if (this.isRunning) {
                        debug.warn('LSTM API not responding despite showing as running. Attempting restart...', 'lstm-service');
                        await this.stop();
                        await this.start();
                    }
                }
            }
            
            return {
                apiRunning,
                modelTrained: modelExists,
                lastTrained,
                readyForPrediction: apiRunning && modelExists,
                framework: 'PyTorch'
            };
        } catch (error) {
            debug.error(`Error checking LSTM status: ${error.message}`, 'lstm-service');
            return {
                apiRunning: this.isRunning,
                modelTrained: false,
                lastTrained: null,
                readyForPrediction: false,
                framework: 'PyTorch',
                error: error.toString()
            };
        }
    }
}

module.exports = new LSTMService();
