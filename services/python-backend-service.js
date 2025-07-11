/**
 * Python Backend Service
 * Manages communication with the Python LSTM backend
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class PythonBackendService {
    constructor() {
        this.process = null;
        this.isRunning = false;
        this.baseUrl = 'http://127.0.0.1:5000';
        this.healthCheckInterval = null;
        this.lastHealthCheck = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Start the Python LSTM backend
     */
    async start() {
        const pythonScript = path.join(__dirname, '..', 'python-backend', 'lstm_server.py');
        
        // Check if Python script exists
        if (!fs.existsSync(pythonScript)) {
            console.log('❌ Failed to start Python backend: Python script not found at:', pythonScript);
            console.log('⚠️ Server will continue without LSTM predictions');
            return false;
        }

        try {
            console.log('🐍 Starting Python LSTM backend...');
            
            this.process = spawn('python', [pythonScript], {
                cwd: path.join(__dirname, '..', 'python-backend'),
                stdio: ['ignore', 'pipe', 'pipe']
            });

            this.process.stdout.on('data', (data) => {
                console.log(`[PYTHON] ${data.toString().trim()}`);
            });

            this.process.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (!message.includes('UserWarning') && !message.includes('FutureWarning')) {
                    console.log(`[PYTHON ERROR] ${message}`);
                }
            });

            this.process.on('close', (code) => {
                console.log(`🐍 Python backend exited with code ${code}`);
                this.isRunning = false;
                this.process = null;
                
                // Auto-restart if unexpected shutdown
                if (code !== 0 && this.retryCount < this.maxRetries) {
                    console.log(`🔄 Attempting to restart Python backend (attempt ${this.retryCount + 1})`);
                    this.retryCount++;
                    setTimeout(() => this.start(), 5000);
                }
            });

            this.process.on('error', (err) => {
                console.log('❌ Failed to start Python backend:', err.message);
                console.log('⚠️ Server will continue without LSTM predictions');
                this.isRunning = false;
            });

            // Give Python time to start
            await this.waitForStartup();
            
            if (this.isRunning) {
                this.startHealthChecks();
                console.log('✅ Python LSTM backend is running and healthy');
            }

            return this.isRunning;
        } catch (error) {
            console.log('❌ Failed to start Python backend:', error.message);
            console.log('⚠️ Server will continue without LSTM predictions');
            return false;
        }
    }

    /**
     * Wait for Python backend to start up
     */
    async waitForStartup(timeout = 10000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await axios.get(`${this.baseUrl}/health`, { timeout: 2000 });
                if (response.data.status === 'healthy') {
                    this.isRunning = true;
                    this.retryCount = 0;
                    return true;
                }
            } catch (error) {
                // Continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return false;
    }

    /**
     * Start periodic health checks
     */
    startHealthChecks() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(async () => {
            await this.checkHealth();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop the Python backend
     */
    async stop() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        if (this.process && this.isRunning) {
            console.log('🛑 Stopping Python backend...');
            
            try {
                // Try graceful shutdown first
                await axios.post(`${this.baseUrl}/shutdown`, {}, { timeout: 5000 });
            } catch (error) {
                // If graceful shutdown fails, force kill
                this.process.kill('SIGTERM');
                
                // Force kill after 5 seconds if still running
                setTimeout(() => {
                    if (this.process && this.isRunning) {
                        this.process.kill('SIGKILL');
                    }
                }, 5000);
            }
            
            this.isRunning = false;
            this.process = null;
        }
    }

    /**
     * Check backend health
     */
    async checkHealth() {
        try {
            const response = await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
            this.lastHealthCheck = {
                timestamp: new Date(),
                status: 'healthy',
                data: response.data
            };
            return { success: true, data: response.data };
        } catch (error) {
            this.lastHealthCheck = {
                timestamp: new Date(),
                status: 'unhealthy',
                error: error.message
            };
            
            if (this.isRunning) {
                console.log('⚠️ Python backend health check failed - predictions may not be available');
                this.isRunning = false;
            }
            
            return { success: false, error: error.message };
        }
    }

    /**
     * Get prediction from LSTM model
     */
    async getPrediction(data, hours = 24) {
        if (!this.isRunning) {
            throw new Error('Python backend is not running');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/predict`, {
                data: data,
                hours: hours
            }, { timeout: 30000 });

            return {
                success: true,
                predictions: response.data.predictions,
                confidence: response.data.confidence || null,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Error getting LSTM prediction:', error.message);
            throw new Error(`Prediction failed: ${error.message}`);
        }
    }

    /**
     * Train the LSTM model with new data
     */
    async trainModel(data) {
        if (!this.isRunning) {
            throw new Error('Python backend is not running');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/train`, {
                data: data
            }, { timeout: 300000 }); // 5 minute timeout for training

            return {
                success: true,
                trainingResults: response.data,
                timestamp: new Date()
            };
        } catch (error) {
            console.error('Error training LSTM model:', error.message);
            throw new Error(`Training failed: ${error.message}`);
        }
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            running: this.isRunning,
            process: this.process ? {
                pid: this.process.pid,
                connected: this.process.connected
            } : null,
            lastHealthCheck: this.lastHealthCheck,
            retryCount: this.retryCount,
            baseUrl: this.baseUrl
        };
    }

    /**
     * Get model information
     */
    async getModelInfo() {
        if (!this.isRunning) {
            throw new Error('Python backend is not running');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/model/info`, { timeout: 10000 });
            return response.data;
        } catch (error) {
            throw new Error(`Failed to get model info: ${error.message}`);
        }
    }
}

module.exports = new PythonBackendService();
