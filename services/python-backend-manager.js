const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class PythonBackendManager {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.port = process.env.PYTHON_BACKEND_PORT || 5000;
    this.host = process.env.PYTHON_BACKEND_HOST || 'localhost';
    this.baseUrl = `http://${this.host}:${this.port}`;
    this.pythonPath = process.env.PYTHON_PATH || 'python';
    this.scriptPath = path.join(__dirname, '..', 'python-backend', 'lstm_server.py');
    this.restartAttempts = 0;
    this.maxRestartAttempts = 3;
    this.healthCheckInterval = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('Python backend is already running');
      return;
    }

    try {
      // Check if Python script exists
      if (!fs.existsSync(this.scriptPath)) {
        throw new Error(`Python script not found at: ${this.scriptPath}`);
      }

      console.log(`Starting Python backend: ${this.pythonPath} ${this.scriptPath}`);
      
      this.process = spawn(this.pythonPath, [this.scriptPath], {
        cwd: path.dirname(this.scriptPath),
        env: {
          ...process.env,
          PYTHONPATH: path.dirname(this.scriptPath),
          FLASK_ENV: process.env.NODE_ENV === 'development' ? 'development' : 'production',
          PORT: this.port.toString()
        }
      });

      this.process.stdout.on('data', (data) => {
        console.log(`[Python Backend] ${data.toString().trim()}`);
      });

      this.process.stderr.on('data', (data) => {
        console.error(`[Python Backend Error] ${data.toString().trim()}`);
      });

      this.process.on('close', (code) => {
        console.log(`Python backend process exited with code ${code}`);
        this.isRunning = false;
        this.handleProcessExit(code);
      });

      this.process.on('error', (error) => {
        console.error('Failed to start Python backend:', error.message);
        this.isRunning = false;
        throw error;
      });

      // Wait for the backend to be ready
      await this.waitForReady();
      this.isRunning = true;
      this.restartAttempts = 0;
      
      // Start health monitoring
      this.startHealthCheck();
      
      console.log('✅ Python backend is ready and running');
    } catch (error) {
      console.error('❌ Failed to start Python backend:', error.message);
      throw error;
    }
  }

  async stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.process && this.isRunning) {
      return new Promise((resolve) => {
        this.process.on('close', () => {
          this.isRunning = false;
          this.process = null;
          resolve();
        });
        
        this.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if not closed gracefully
        setTimeout(() => {
          if (this.process && this.isRunning) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
      });
    }
  }

  async waitForReady(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`${this.baseUrl}/health`, {
          timeout: 1000
        });
        
        if (response.status === 200) {
          return true;
        }
      } catch (error) {
        // Backend not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Python backend failed to become ready within timeout period');
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await axios.get(`${this.baseUrl}/health`, { timeout: 5000 });
      } catch (error) {
        console.warn('Python backend health check failed:', error.message);
        if (this.isRunning) {
          console.log('Attempting to restart Python backend...');
          this.restart();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  async restart() {
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error('Max restart attempts reached. Python backend will remain stopped.');
      return;
    }

    this.restartAttempts++;
    console.log(`Restarting Python backend (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
    
    try {
      await this.stop();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      await this.start();
    } catch (error) {
      console.error('Failed to restart Python backend:', error.message);
    }
  }

  handleProcessExit(code) {
    if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
      console.log('Python backend crashed, attempting restart...');
      setTimeout(() => this.restart(), 5000);
    }
  }

  async predict(data) {
    if (!this.isRunning) {
      throw new Error('Python backend is not running');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/predict`, data, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Prediction request failed:', error.message);
      throw new Error(`Failed to get prediction: ${error.message}`);
    }
  }

  async trainModel(trainingData) {
    if (!this.isRunning) {
      throw new Error('Python backend is not running');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/train`, trainingData, {
        timeout: 300000, // 5 minutes for training
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Training request failed:', error.message);
      throw new Error(`Failed to train model: ${error.message}`);
    }
  }

  getStatus() {
    return {
      running: this.isRunning,
      port: this.port,
      host: this.host,
      baseUrl: this.baseUrl,
      restartAttempts: this.restartAttempts,
      processId: this.process ? this.process.pid : null
    };
  }
}

module.exports = PythonBackendManager;
