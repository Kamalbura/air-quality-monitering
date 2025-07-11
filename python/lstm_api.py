from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from lstm_model import AirQualityLSTM
import pandas as pd
import numpy as np
import json
import torch
import os
import logging
from datetime import datetime, timedelta
import traceback
import io
import base64
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize model
model = AirQualityLSTM()

# Global variables for model state
training_in_progress = False
model_loaded = False

@app.route('/', methods=['GET'])
def health_check():
    """Comprehensive health check endpoint"""
    try:
        gpu_info = None
        if torch.cuda.is_available():
            gpu_info = {
                'name': torch.cuda.get_device_name(0),
                'memory_total': torch.cuda.get_device_properties(0).total_memory,
                'memory_allocated': torch.cuda.memory_allocated(0),
                'memory_cached': torch.cuda.memory_reserved(0)
            }
        
        return jsonify({
            'status': 'running',
            'framework': 'PyTorch',
            'pytorch_version': torch.__version__,
            'device': str(model.device),
            'cuda_available': torch.cuda.is_available(),
            'gpu_info': gpu_info,
            'model_loaded': model_loaded,
            'training_in_progress': training_in_progress,
            'timestamp': datetime.now().isoformat(),
            'api_version': '2.0'
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get detailed model information"""
    try:
        info = {
            'model_loaded': model_loaded,
            'sequence_length': model.sequence_length,
            'features': model.features,
            'target_features': model.target_features,
            'hidden_size': model.hidden_size,
            'num_layers': model.num_layers,
            'use_attention': model.use_attention,
            'device': str(model.device)
        }
        
        # Check if model files exist
        model_file = os.path.join(model.model_path, 'enhanced_lstm_model.pth')
        best_model_file = os.path.join(model.model_path, 'enhanced_lstm_model_best.pth')
        
        info['model_files'] = {
            'latest_model_exists': os.path.exists(model_file),
            'best_model_exists': os.path.exists(best_model_file)
        }
        
        # Get model file timestamps if they exist
        if os.path.exists(model_file):
            info['model_files']['latest_model_modified'] = datetime.fromtimestamp(
                os.path.getmtime(model_file)
            ).isoformat()
        
        if os.path.exists(best_model_file):
            info['model_files']['best_model_modified'] = datetime.fromtimestamp(
                os.path.getmtime(best_model_file)
            ).isoformat()
        
        return jsonify({
            'success': True,
            'data': info
        })
        
    except Exception as e:
        logger.error(f"Model info failed: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/train', methods=['POST'])
def train_model():
    """Enhanced training endpoint with progress tracking"""
    global training_in_progress, model_loaded
    
    if training_in_progress:
        return jsonify({
            'success': False,
            'message': 'Training already in progress'
        }), 400
    
    try:
        training_in_progress = True
        
        # Get training data and options
        data_dict = request.json['data']
        options = request.json.get('options', {})
        
        # Convert to DataFrame
        data = pd.DataFrame(data_dict)
        
        # Validate data
        if len(data) < model.sequence_length + 1:
            raise ValueError(f"Insufficient data. Need at least {model.sequence_length + 1} rows, got {len(data)}")
        
        # Extract training parameters
        epochs = options.get('epochs', 100)
        batch_size = options.get('batch_size', 64)
        validation_split = options.get('validation_split', 0.2)
        learning_rate = options.get('learning_rate', 0.0005)
        
        # Update model parameters
        model.learning_rate = learning_rate
        
        logger.info(f"Starting training with {len(data)} data points")
        logger.info(f"Parameters: epochs={epochs}, batch_size={batch_size}, lr={learning_rate}")
        
        # Train model
        history = model.train(
            data, 
            epochs=epochs, 
            batch_size=batch_size, 
            validation_split=validation_split,
            verbose=True
        )
        
        model_loaded = True
        
        # Prepare response
        response_data = {
            'success': True,
            'message': 'Model trained successfully',
            'device': str(model.device),
            'training_info': {
                'epochs_completed': len(history['train_loss']),
                'best_epoch': history['best_epoch'] + 1,
                'best_val_loss': history['best_val_loss'],
                'final_train_loss': history['train_loss'][-1],
                'final_val_loss': history['val_loss'][-1],
                'data_points_used': len(data),
                'training_samples': len(data) - int(len(data) * validation_split) - model.sequence_length,
                'validation_samples': int(len(data) * validation_split)
            },
            'history': {
                'train_loss': [float(x) for x in history['train_loss']],
                'val_loss': [float(x) for x in history['val_loss']],
                'learning_rate': [float(x) for x in history['lr']]
            }
        }
        
        logger.info("Training completed successfully")
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        }), 500
    finally:
        training_in_progress = False

@app.route('/predict', methods=['POST'])
def predict():
    """Enhanced prediction endpoint with confidence intervals"""
    try:
        # Load model if not loaded
        if not model_loaded and not model.load_model():
            return jsonify({
                'success': False,
                'message': 'No trained model found. Please train the model first.'
            }), 400
        
        # Get data from request
        data_dict = request.json['data']
        options = request.json.get('options', {})
        
        # Convert to DataFrame with proper index
        data = pd.DataFrame(data_dict)
        if 'timestamp' in data.columns:
            data['timestamp'] = pd.to_datetime(data['timestamp'])
            data.set_index('timestamp', inplace=True)
        
        # Get prediction parameters
        n_future = options.get('n_future', 24)
        confidence_interval = options.get('confidence_interval', True)
        
        # Validate data
        if len(data) < model.sequence_length:
            raise ValueError(f"Insufficient data for prediction. Need at least {model.sequence_length} rows, got {len(data)}")
        
        logger.info(f"Generating {n_future} predictions from {len(data)} data points")
        
        # Generate predictions
        predictions = model.predict(
            data, 
            n_future=n_future,
            confidence_interval=confidence_interval
        )
        
        # Prepare response
        response_data = {
            'success': True,
            'predictions': predictions.reset_index().to_dict(orient='records'),
            'metadata': {
                'n_future': n_future,
                'confidence_interval': confidence_interval,
                'input_data_points': len(data),
                'sequence_length_used': model.sequence_length,
                'features_predicted': model.target_features,
                'device': str(model.device)
            }
        }
        
        # Convert timestamps to string for JSON serialization
        for pred in response_data['predictions']:
            if 'timestamp' in pred:
                pred['timestamp'] = pred['timestamp']
            elif 'index' in pred:
                pred['timestamp'] = pred['index']
                del pred['index']
        
        return jsonify(response_data)
        
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/evaluate', methods=['POST'])
def evaluate():
    """Enhanced evaluation endpoint with detailed metrics"""
    try:
        # Load model if not loaded
        if not model_loaded and not model.load_model():
            return jsonify({
                'success': False,
                'message': 'No trained model found. Please train the model first.'
            }), 400
        
        # Get test data from request
        data_dict = request.json['data']
        options = request.json.get('options', {})
        
        data = pd.DataFrame(data_dict)
        plot_results = options.get('plot_results', False)
        
        # Validate data
        if len(data) < model.sequence_length + 1:
            raise ValueError(f"Insufficient data for evaluation. Need at least {model.sequence_length + 1} rows")
        
        logger.info(f"Evaluating model on {len(data)} data points")
        
        # Evaluate model
        metrics = model.evaluate(data, plot_results=False)  # Don't plot in API
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'evaluation_info': {
                'test_data_points': len(data),
                'evaluation_samples': len(data) - model.sequence_length,
                'features_evaluated': model.target_features
            }
        })
        
    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/model/load', methods=['POST'])
def load_model():
    """Load saved model"""
    global model_loaded
    
    try:
        options = request.json.get('options', {})
        load_best = options.get('load_best', False)
        
        success = model.load_model(load_best=load_best)
        
        if success:
            model_loaded = True
            return jsonify({
                'success': True,
                'message': f'Model loaded successfully ({"best" if load_best else "latest"})',
                'model_info': {
                    'device': str(model.device),
                    'features': model.features,
                    'target_features': model.target_features,
                    'sequence_length': model.sequence_length
                }
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Failed to load model. No saved model found.'
            }), 404
            
    except Exception as e:
        logger.error(f"Model loading failed: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/data/validate', methods=['POST'])
def validate_data():
    """Validate input data for training/prediction"""
    try:
        data_dict = request.json['data']
        data = pd.DataFrame(data_dict)
        
        validation_results = {
            'valid': True,
            'warnings': [],
            'errors': [],
            'info': {
                'total_rows': len(data),
                'columns': list(data.columns),
                'required_features': model.features,
                'missing_features': [],
                'data_types': data.dtypes.to_dict()
            }
        }
        
        # Check for required features
        missing_features = [f for f in model.features if f not in data.columns]
        if missing_features:
            validation_results['missing_features'] = missing_features
            validation_results['errors'].append(f"Missing required features: {missing_features}")
            validation_results['valid'] = False
        
        # Check data length
        if len(data) < model.sequence_length:
            validation_results['errors'].append(f"Insufficient data. Need at least {model.sequence_length} rows")
            validation_results['valid'] = False
        
        # Check for null values
        null_counts = data[model.features].isnull().sum()
        high_null_features = null_counts[null_counts > len(data) * 0.5].index.tolist()
        if high_null_features:
            validation_results['warnings'].append(f"High null percentage in features: {high_null_features}")
        
        # Check data ranges
        for feature in model.features:
            if feature in data.columns:
                values = data[feature].dropna()
                if len(values) > 0:
                    if feature == 'pm25' and (values < 0).any() or (values > 500).any():
                        validation_results['warnings'].append(f"PM2.5 values outside expected range (0-500)")
                    elif feature == 'pm10' and (values < 0).any() or (values > 600).any():
                        validation_results['warnings'].append(f"PM10 values outside expected range (0-600)")
                    elif feature == 'temperature' and (values < -40).any() or (values > 60).any():
                        validation_results['warnings'].append(f"Temperature values outside expected range (-40-60°C)")
                    elif feature == 'humidity' and (values < 0).any() or (values > 100).any():
                        validation_results['warnings'].append(f"Humidity values outside expected range (0-100%)")
        
        return jsonify({
            'success': True,
            'validation': validation_results
        })
        
    except Exception as e:
        logger.error(f"Data validation failed: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/model/reset', methods=['POST'])
def reset_model():
    """Reset model and clear memory"""
    global model_loaded, training_in_progress
    
    try:
        if training_in_progress:
            return jsonify({
                'success': False,
                'message': 'Cannot reset model while training is in progress'
            }), 400
        
        # Clear model
        model.model = None
        model.scaler_X = None
        model.scaler_y = None
        model_loaded = False
        
        # Clear GPU memory if using CUDA
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        return jsonify({
            'success': True,
            'message': 'Model reset successfully'
        })
        
    except Exception as e:
        logger.error(f"Model reset failed: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': 'Endpoint not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Starting Enhanced PyTorch LSTM API Server")
    print("=" * 60)
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
    else:
        print("Running on CPU")
    
    print(f"Device: {model.device}")
    print(f"Model features: {model.features}")
    print(f"Sequence length: {model.sequence_length}")
    print("=" * 60)
    print("API Endpoints:")
    print("  GET  /           - Health check")
    print("  GET  /model/info - Model information")
    print("  POST /train      - Train model")
    print("  POST /predict    - Generate predictions")
    print("  POST /evaluate   - Evaluate model")
    print("  POST /model/load - Load saved model")
    print("  POST /data/validate - Validate input data")
    print("  POST /model/reset   - Reset model")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)
