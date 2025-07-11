/**
 * LSTM Model Training Module
 * Handles training of LSTM models for air quality prediction
 */

const fs = require('fs');
const path = require('path');

class LSTMTrainer {
  constructor(options = {}) {
    this.config = {
      sequenceLength: options.sequenceLength || 24,
      features: options.features || ['humidity', 'temperature', 'pm25', 'pm10'],
      hiddenUnits: options.hiddenUnits || 50,
      epochs: options.epochs || 100,
      batchSize: options.batchSize || 32,
      learningRate: options.learningRate || 0.001,
      validationSplit: options.validationSplit || 0.2,
      patience: options.patience || 10,
      ...options
    };
    
    this.model = null;
    this.scaler = null;
    this.trainHistory = null;
  }

  /**
   * Prepare training data with normalization
   * @param {Array} sequences - Training sequences
   * @returns {Object} Normalized data and scaler
   */
  prepareTrainingData(sequences) {
    console.log(`Preparing ${sequences.length} sequences for training...`);
    
    // Extract all values for normalization
    const allValues = [];
    sequences.forEach(seq => {
      seq.input.forEach(timestep => {
        timestep.forEach(value => allValues.push(value));
      });
      seq.target.forEach(value => allValues.push(value));
    });
    
    // Calculate normalization parameters
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min;
    
    this.scaler = { min, max, range };
    
    // Normalize sequences
    const normalizedSequences = sequences.map(seq => ({
      input: seq.input.map(timestep => 
        timestep.map(value => (value - min) / range)
      ),
      target: seq.target.map(value => (value - min) / range),
      timestamp: seq.timestamp
    }));
    
    console.log(`Data normalized. Range: ${min.toFixed(2)} to ${max.toFixed(2)}`);
    
    return {
      sequences: normalizedSequences,
      scaler: this.scaler
    };
  }

  /**
   * Create and compile LSTM model
   * @returns {Object} Model architecture info
   */
  createModel() {
    const inputShape = [this.config.sequenceLength, this.config.features.length];
    
    // Model architecture for TensorFlow.js (when available)
    // For now, return configuration that can be used with Python training script
    const modelConfig = {
      type: 'LSTM',
      layers: [
        {
          type: 'LSTM',
          units: this.config.hiddenUnits,
          returnSequences: true,
          inputShape: inputShape
        },
        {
          type: 'Dropout',
          rate: 0.2
        },
        {
          type: 'LSTM',
          units: this.config.hiddenUnits,
          returnSequences: false
        },
        {
          type: 'Dropout',
          rate: 0.2
        },
        {
          type: 'Dense',
          units: this.config.features.length,
          activation: 'linear'
        }
      ],
      compile: {
        optimizer: {
          type: 'adam',
          learningRate: this.config.learningRate
        },
        loss: 'mse',
        metrics: ['mae']
      }
    };
    
    console.log('Model architecture created:', modelConfig);
    return modelConfig;
  }

  /**
   * Generate Python training script for the model
   * @param {string} datasetPath - Path to the dataset
   * @returns {string} Python script content
   */
  generatePythonTrainingScript(datasetPath) {
    const script = `#!/usr/bin/env python3
"""
LSTM Training Script for Air Quality Prediction
Generated automatically by the Node.js application
"""

import json
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import matplotlib.pyplot as plt
from sklearn.metrics import mean_squared_error, mean_absolute_error
import os

# Configuration
CONFIG = ${JSON.stringify(this.config, null, 4)}

def load_dataset(filepath):
    """Load and prepare the dataset"""
    print(f"Loading dataset from {filepath}")
    
    with open(filepath, 'r') as f:
        dataset = json.load(f)
    
    # Extract training and validation data
    train_data = dataset['train']
    val_data = dataset['validation']
    
    # Convert to numpy arrays
    X_train = np.array([seq['input'] for seq in train_data])
    y_train = np.array([seq['target'] for seq in train_data])
    X_val = np.array([seq['input'] for seq in val_data])
    y_val = np.array([seq['target'] for seq in val_data])
    
    print(f"Training data shape: X={X_train.shape}, y={y_train.shape}")
    print(f"Validation data shape: X={X_val.shape}, y={y_val.shape}")
    
    return X_train, y_train, X_val, y_val, dataset

def create_model(input_shape, output_dim):
    """Create LSTM model"""
    model = Sequential([
        LSTM(CONFIG['hiddenUnits'], return_sequences=True, input_shape=input_shape),
        Dropout(0.2),
        LSTM(CONFIG['hiddenUnits'], return_sequences=False),
        Dropout(0.2),
        Dense(output_dim, activation='linear')
    ])
    
    model.compile(
        optimizer=Adam(learning_rate=CONFIG['learningRate']),
        loss='mse',
        metrics=['mae']
    )
    
    return model

def train_model(model, X_train, y_train, X_val, y_val):
    """Train the model"""
    callbacks = [
        EarlyStopping(patience=CONFIG['patience'], restore_best_weights=True),
        ReduceLROnPlateau(factor=0.5, patience=5, min_lr=1e-6)
    ]
    
    history = model.fit(
        X_train, y_train,
        epochs=CONFIG['epochs'],
        batch_size=CONFIG['batchSize'],
        validation_data=(X_val, y_val),
        callbacks=callbacks,
        verbose=1
    )
    
    return history

def evaluate_model(model, X_val, y_val, feature_names):
    """Evaluate model performance"""
    predictions = model.predict(X_val)
    
    # Calculate metrics for each feature
    metrics = {}
    for i, feature in enumerate(feature_names):
        y_true = y_val[:, i]
        y_pred = predictions[:, i]
        
        mse = mean_squared_error(y_true, y_pred)
        mae = mean_absolute_error(y_true, y_pred)
        rmse = np.sqrt(mse)
        
        metrics[feature] = {
            'mse': float(mse),
            'mae': float(mae),
            'rmse': float(rmse)
        }
    
    return metrics, predictions

def plot_training_history(history):
    """Plot training history"""
    plt.figure(figsize=(12, 4))
    
    plt.subplot(1, 2, 1)
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.plot(history.history['mae'], label='Training MAE')
    plt.plot(history.history['val_mae'], label='Validation MAE')
    plt.title('Model MAE')
    plt.xlabel('Epoch')
    plt.ylabel('MAE')
    plt.legend()
    
    plt.tight_layout()
    plt.savefig('training_history.png')
    plt.show()

def main():
    """Main training function"""
    # Load dataset
    dataset_path = "${datasetPath}"
    X_train, y_train, X_val, y_val, dataset = load_dataset(dataset_path)
    
    # Create model
    input_shape = (X_train.shape[1], X_train.shape[2])
    output_dim = y_train.shape[1]
    model = create_model(input_shape, output_dim)
    
    print("Model Summary:")
    model.summary()
    
    # Train model
    print("Starting training...")
    history = train_model(model, X_train, y_train, X_val, y_val)
    
    # Evaluate model
    print("Evaluating model...")
    metrics, predictions = evaluate_model(model, X_val, y_val, CONFIG['features'])
    
    print("\\nEvaluation Metrics:")
    for feature, metric in metrics.items():
        print(f"{feature}: RMSE={metric['rmse']:.4f}, MAE={metric['mae']:.4f}")
    
    # Save model and results
    model_dir = 'trained_models'
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, 'lstm_air_quality_model.h5')
    model.save(model_path)
    print(f"Model saved to: {model_path}")
    
    # Save training results
    results = {
        'config': CONFIG,
        'metrics': metrics,
        'training_history': {
            'loss': history.history['loss'],
            'val_loss': history.history['val_loss'],
            'mae': history.history['mae'],
            'val_mae': history.history['val_mae']
        }
    }
    
    results_path = os.path.join(model_dir, 'training_results.json')
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"Training results saved to: {results_path}")
    
    # Plot training history
    plot_training_history(history)

if __name__ == "__main__":
    main()
`;

    return script;
  }

  /**
   * Save training script and start training
   * @param {string} datasetPath - Path to the dataset
   * @returns {Promise<Object>} Training results
   */
  async startTraining(datasetPath) {
    try {
      // Create models directory
      const modelsDir = path.join(__dirname, '..', 'models');
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }

      // Generate Python training script
      const pythonScript = this.generatePythonTrainingScript(datasetPath);
      const scriptPath = path.join(modelsDir, 'train_lstm.py');
      
      fs.writeFileSync(scriptPath, pythonScript);
      console.log(`Training script saved to: ${scriptPath}`);

      // Create requirements.txt for Python dependencies
      const requirements = `tensorflow>=2.10.0
numpy>=1.21.0
matplotlib>=3.5.0
scikit-learn>=1.1.0
pandas>=1.4.0`;

      const requirementsPath = path.join(modelsDir, 'requirements.txt');
      fs.writeFileSync(requirementsPath, requirements);

      return {
        success: true,
        scriptPath,
        requirementsPath,
        config: this.config,
        instructions: [
          "1. Install Python dependencies: pip install -r requirements.txt",
          "2. Run training script: python train_lstm.py",
          "3. Check training_results.json for metrics",
          "4. Model will be saved as lstm_air_quality_model.h5"
        ]
      };

    } catch (error) {
      console.error('Error starting training:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LSTMTrainer;
`;

    return script;
  }

  /**
   * Save training script and start training
   * @param {string} datasetPath - Path to the dataset
   * @returns {Promise<Object>} Training results
   */
  async startTraining(datasetPath) {
    try {
      // Create models directory
      const modelsDir = path.join(__dirname, '..', 'models');
      if (!fs.existsSync(modelsDir)) {
        fs.mkdirSync(modelsDir, { recursive: true });
      }

      // Generate Python training script
      const pythonScript = this.generatePythonTrainingScript(datasetPath);
      const scriptPath = path.join(modelsDir, 'train_lstm.py');
      
      fs.writeFileSync(scriptPath, pythonScript);
      console.log(`Training script saved to: ${scriptPath}`);

      // Create requirements.txt for Python dependencies
      const requirements = `tensorflow>=2.10.0
numpy>=1.21.0
matplotlib>=3.5.0
scikit-learn>=1.1.0
pandas>=1.4.0`;

      const requirementsPath = path.join(modelsDir, 'requirements.txt');
      fs.writeFileSync(requirementsPath, requirements);

      return {
        success: true,
        scriptPath,
        requirementsPath,
        config: this.config,
        instructions: [
          "1. Install Python dependencies: pip install -r requirements.txt",
          "2. Run training script: python train_lstm.py",
          "3. Check training_results.json for metrics",
          "4. Model will be saved as lstm_air_quality_model.h5"
        ]
      };

    } catch (error) {
      console.error('Error starting training:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = LSTMTrainer;
