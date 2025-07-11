from flask import Flask, request, jsonify
from flask_cors import CORS
from lstm_model import AirQualityLSTM
import pandas as pd
import json
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
model = AirQualityLSTM()

@app.route('/train', methods=['POST'])
def train_model():
    try:
        # Get training data from request
        data = pd.DataFrame(request.json['data'])
        
        # Train model
        history = model.train(data)
        
        return jsonify({
            'success': True,
            'message': 'Model trained successfully',
            'history': {
                'loss': [float(x) for x in history.history['loss']],
                'val_loss': [float(x) for x in history.history['val_loss']]
            }
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/predict', methods=['POST'])
def predict():
    try:
        # Get data from request
        data = pd.DataFrame(request.json['data'])
        n_future = request.json.get('n_future', 24)
        
        # Generate predictions
        predictions = model.predict(data, n_future)
        
        return jsonify({
            'success': True,
            'predictions': predictions.to_dict(orient='records')
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@app.route('/evaluate', methods=['POST'])
def evaluate():
    try:
        # Get test data from request
        data = pd.DataFrame(request.json['data'])
        
        # Evaluate model
        metrics = model.evaluate(data)
        
        return jsonify({
            'success': True,
            'metrics': metrics
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(port=5000)
