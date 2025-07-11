import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union
import json
import os
from datetime import datetime
import torch

from .models import (
    LSTMModel, BiLSTMModel, GRUModel, 
    TransformerModel, HybridModel, 
    CNNLSTMModel, AttentionLSTMModel
)

class AirQualityModelManager:
    """Manages multiple air quality prediction models"""
    
    def __init__(self, base_path: str = 'models'):
        self.base_path = base_path
        self.models = {}
        self.model_configs = {}
        self.model_classes = {
            'lstm': LSTMModel,
            'bilstm': BiLSTMModel,
            'gru': GRUModel,
            'transformer': TransformerModel,
            'hybrid': HybridModel,
            'cnn_lstm': CNNLSTMModel,
            'attention_lstm': AttentionLSTMModel
        }
        
        # Default configurations
        self.default_configs = {
            'lstm': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'sequence_length': 48
            },
            'bilstm': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'sequence_length': 48
            },
            'gru': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'sequence_length': 48
            },
            'transformer': {
                'hidden_size': 128,
                'num_layers': 6,
                'num_heads': 8,
                'dropout': 0.1,
                'sequence_length': 48
            },
            'hybrid': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'sequence_length': 48
            },
            'cnn_lstm': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'sequence_length': 48
            },
            'attention_lstm': {
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.2,
                'sequence_length': 48
            }
        }
        
        os.makedirs(base_path, exist_ok=True)
    
    def create_model(self, model_type: str, model_name: str = None, 
                    config: Dict = None) -> str:
        """Create a new model instance"""
        if model_type not in self.model_classes:
            raise ValueError(f"Unknown model type: {model_type}")
        
        if model_name is None:
            model_name = f"{model_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Use default config if not provided
        if config is None:
            config = self.default_configs[model_type].copy()
        
        # Create model path
        model_path = os.path.join(self.base_path, model_name)
        config['model_path'] = model_path
        
        # Initialize model
        model_class = self.model_classes[model_type]
        model = model_class(**config)
        
        # Store model and config
        self.models[model_name] = model
        self.model_configs[model_name] = {
            'type': model_type,
            'config': config,
            'created_at': datetime.now().isoformat(),
            'trained': False
        }
        
        return model_name
    
    def train_model(self, model_name: str, data: pd.DataFrame, 
                   training_params: Dict = None) -> Dict:
        """Train a specific model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        
        model = self.models[model_name]
        
        # Default training parameters
        default_params = {
            'epochs': 100,
            'batch_size': 32,
            'validation_split': 0.2,
            'learning_rate': 0.001,
            'patience': 15
        }
        
        if training_params:
            default_params.update(training_params)
        
        print(f"Training model: {model_name}")
        history = model.train_model(data, **default_params)
        
        # Update model config
        self.model_configs[model_name]['trained'] = True
        self.model_configs[model_name]['last_trained'] = datetime.now().isoformat()
        self.model_configs[model_name]['training_params'] = default_params
        
        # Save config
        self._save_config(model_name)
        
        return history
    
    def predict(self, model_name: str, data: pd.DataFrame, 
               n_future: int = 24, confidence_interval: bool = False) -> pd.DataFrame:
        """Make predictions using a specific model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        
        model = self.models[model_name]
        return model.predict(data, n_future, confidence_interval)
    
    def evaluate_model(self, model_name: str, data: pd.DataFrame, 
                      plot_results: bool = False) -> Dict:
        """Evaluate a specific model"""
        if model_name not in self.models:
            raise ValueError(f"Model {model_name} not found")
        
        model = self.models[model_name]
        return model.evaluate(data, plot_results)
    
    def compare_models(self, model_names: List[str], data: pd.DataFrame) -> pd.DataFrame:
        """Compare multiple models on the same dataset"""
        results = []
        
        for model_name in model_names:
            if model_name not in self.models:
                print(f"Warning: Model {model_name} not found, skipping...")
                continue
            
            try:
                metrics = self.evaluate_model(model_name, data)
                
                # Extract overall metrics
                overall_metrics = metrics['overall']
                result = {
                    'model': model_name,
                    'model_type': self.model_configs[model_name]['type'],
                    'mae': overall_metrics['mae'],
                    'rmse': overall_metrics['rmse'],
                    'r2': overall_metrics['r2']
                }
                
                # Add feature-specific R² scores
                for feature in ['PM2.5', 'PM10', 'Temperature', 'Humidity']:
                    if feature in metrics:
                        result[f'{feature}_r2'] = metrics[feature]['r2']
                
                results.append(result)
                
            except Exception as e:
                print(f"Error evaluating model {model_name}: {e}")
        
        return pd.DataFrame(results)
    
    def ensemble_predict(self, model_names: List[str], data: pd.DataFrame,
                        n_future: int = 24, method: str = 'average') -> pd.DataFrame:
        """Make ensemble predictions using multiple models"""
        predictions = []
        
        for model_name in model_names:
            if model_name in self.models:
                try:
                    pred = self.predict(model_name, data, n_future)
                    predictions.append(pred)
                except Exception as e:
                    print(f"Error with model {model_name}: {e}")
        
        if not predictions:
            raise ValueError("No valid predictions obtained")
        
        # Combine predictions
        if method == 'average':
            # Simple average
            ensemble_pred = sum(predictions) / len(predictions)
        elif method == 'weighted':
            # Weighted by R² score (requires pre-computed weights)
            # For simplicity, using equal weights here
            ensemble_pred = sum(predictions) / len(predictions)
        else:
            raise ValueError(f"Unknown ensemble method: {method}")
        
        return ensemble_pred
    
    def load_model(self, model_name: str, best: bool = True):
        """Load a saved model"""
        config_path = os.path.join(self.base_path, model_name, 'config.json')
        
        if not os.path.exists(config_path):
            raise ValueError(f"Model config not found: {config_path}")
        
        # Load config
        with open(config_path, 'r') as f:
            config_data = json.load(f)
        
        model_type = config_data['type']
        model_config = config_data['config']
        
        # Create model instance
        model_class = self.model_classes[model_type]
        model = model_class(**model_config)
        
        # Load weights
        model.load_model(best=best)
        
        # Store model and config
        self.models[model_name] = model
        self.model_configs[model_name] = config_data
        
        print(f"Model {model_name} loaded successfully")
    
    def list_models(self) -> pd.DataFrame:
        """List all available models"""
        model_list = []
        
        for model_name, config in self.model_configs.items():
            model_info = {
                'name': model_name,
                'type': config['type'],
                'trained': config.get('trained', False),
                'created_at': config.get('created_at', 'Unknown'),
                'last_trained': config.get('last_trained', 'Never')
            }
            model_list.append(model_info)
        
        return pd.DataFrame(model_list)
    
    def delete_model(self, model_name: str):
        """Delete a model"""
        if model_name in self.models:
            del self.models[model_name]
        
        if model_name in self.model_configs:
            del self.model_configs[model_name]
        
        # Remove model files
        model_path = os.path.join(self.base_path, model_name)
        if os.path.exists(model_path):
            import shutil
            shutil.rmtree(model_path)
        
        print(f"Model {model_name} deleted successfully")
    
    def _save_config(self, model_name: str):
        """Save model configuration"""
        config_path = os.path.join(self.base_path, model_name, 'config.json')
        os.makedirs(os.path.dirname(config_path), exist_ok=True)
        
        with open(config_path, 'w') as f:
            json.dump(self.model_configs[model_name], f, indent=2)
    
    def get_model_info(self, model_name: str) -> Dict:
        """Get detailed information about a model"""
        if model_name not in self.model_configs:
            raise ValueError(f"Model {model_name} not found")
        
        config = self.model_configs[model_name].copy()
        
        # Add model parameters count if model is loaded
        if model_name in self.models:
            model = self.models[model_name]
            total_params = sum(p.numel() for p in model.parameters())
            trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
            
            config['parameters'] = {
                'total': total_params,
                'trainable': trainable_params
            }
        
        return config
