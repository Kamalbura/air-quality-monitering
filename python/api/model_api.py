from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
from datetime import datetime
import traceback
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model_manager import AirQualityModelManager

app = Flask(__name__)
model_manager = AirQualityModelManager()

@app.route('/api/models', methods=['GET'])
def list_models():
    """List all available models"""
    try:
        models_df = model_manager.list_models()
        return jsonify({
            'success': True,
            'models': models_df.to_dict('records')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/create', methods=['POST'])
def create_model():
    """Create a new model"""
    try:
        data = request.get_json()
        model_type = data.get('model_type')
        model_name = data.get('model_name')
        config = data.get('config', {})
        
        if not model_type:
            return jsonify({
                'success': False,
                'error': 'model_type is required'
            }), 400
        
        model_name = model_manager.create_model(model_type, model_name, config)
        
        return jsonify({
            'success': True,
            'model_name': model_name,
            'message': f'Model {model_name} created successfully'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_name>/train', methods=['POST'])
def train_model(model_name):
    """Train a specific model"""
    try:
        data = request.get_json()
        
        # Get training data
        if 'data' in data:
            # Data provided directly
            df = pd.DataFrame(data['data'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        elif 'data_file' in data:
            # Load from file
            df = pd.read_csv(data['data_file'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        else:
            return jsonify({
                'success': False,
                'error': 'Training data not provided'
            }), 400
        
        # Training parameters
        training_params = data.get('training_params', {})
        
        # Train model
        history = model_manager.train_model(model_name, df, training_params)
        
        return jsonify({
            'success': True,
            'message': f'Model {model_name} trained successfully',
            'history': {
                'train_loss': [float(x) for x in history['train_loss']],
                'val_loss': [float(x) for x in history['val_loss']],
                'epochs': len(history['train_loss'])
            }
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/models/<model_name>/predict', methods=['POST'])
def predict(model_name):
    """Make predictions using a specific model"""
    try:
        data = request.get_json()
        
        # Get input data
        if 'data' in data:
            df = pd.DataFrame(data['data'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        else:
            return jsonify({
                'success': False,
                'error': 'Input data not provided'
            }), 400
        
        # Prediction parameters
        n_future = data.get('n_future', 24)
        confidence_interval = data.get('confidence_interval', False)
        
        # Make predictions
        predictions = model_manager.predict(model_name, df, n_future, confidence_interval)
        
        # Convert to JSON-serializable format
        result = predictions.reset_index().to_dict('records')
        for record in result:
            record['timestamp'] = record['timestamp'].isoformat()
        
        return jsonify({
            'success': True,
            'predictions': result,
            'model_name': model_name,
            'n_future': n_future
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500

@app.route('/api/models/<model_name>/evaluate', methods=['POST'])
def evaluate_model(model_name):
    """Evaluate a specific model"""
    try:
        data = request.get_json()
        
        # Get test data
        if 'data' in data:
            df = pd.DataFrame(data['data'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        else:
            return jsonify({
                'success': False,
                'error': 'Test data not provided'
            }), 400
        
        # Evaluate model
        metrics = model_manager.evaluate_model(model_name, df, plot_results=False)
        
        return jsonify({
            'success': True,
            'metrics': metrics,
            'model_name': model_name
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/compare', methods=['POST'])
def compare_models():
    """Compare multiple models"""
    try:
        data = request.get_json()
        model_names = data.get('model_names', [])
        
        if not model_names:
            return jsonify({
                'success': False,
                'error': 'model_names list is required'
            }), 400
        
        # Get test data
        if 'data' in data:
            df = pd.DataFrame(data['data'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        else:
            return jsonify({
                'success': False,
                'error': 'Test data not provided'
            }), 400
        
        # Compare models
        comparison = model_manager.compare_models(model_names, df)
        
        return jsonify({
            'success': True,
            'comparison': comparison.to_dict('records')
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/ensemble/predict', methods=['POST'])
def ensemble_predict():
    """Make ensemble predictions"""
    try:
        data = request.get_json()
        model_names = data.get('model_names', [])
        method = data.get('method', 'average')
        
        if not model_names:
            return jsonify({
                'success': False,
                'error': 'model_names list is required'
            }), 400
        
        # Get input data
        if 'data' in data:
            df = pd.DataFrame(data['data'])
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df.set_index('timestamp', inplace=True)
        else:
            return jsonify({
                'success': False,
                'error': 'Input data not provided'
            }), 400
        
        n_future = data.get('n_future', 24)
        
        # Make ensemble predictions
        predictions = model_manager.ensemble_predict(model_names, df, n_future, method)
        
        # Convert to JSON-serializable format
        result = predictions.reset_index().to_dict('records')
        for record in result:
            record['timestamp'] = record['timestamp'].isoformat()
        
        return jsonify({
            'success': True,
            'predictions': result,
            'model_names': model_names,
            'method': method,
            'n_future': n_future
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_name>/info', methods=['GET'])
def get_model_info(model_name):
    """Get detailed model information"""
    try:
        info = model_manager.get_model_info(model_name)
        return jsonify({
            'success': True,
            'info': info
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_name>', methods=['DELETE'])
def delete_model(model_name):
    """Delete a model"""
    try:
        model_manager.delete_model(model_name)
        return jsonify({
            'success': True,
            'message': f'Model {model_name} deleted successfully'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/models/<model_name>/load', methods=['POST'])
def load_model(model_name):
    """Load a saved model"""
    try:
        data = request.get_json() or {}
        best = data.get('best', True)
        
        model_manager.load_model(model_name, best)
        return jsonify({
            'success': True,
            'message': f'Model {model_name} loaded successfully'
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'success': True,
        'message': 'Air Quality Model API is running',
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
