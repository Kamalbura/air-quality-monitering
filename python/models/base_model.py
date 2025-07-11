import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from abc import ABC, abstractmethod
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import os
from typing import Dict, Tuple, Optional, List
import matplotlib.pyplot as plt
import seaborn as sns

class BaseTimeSeriesModel(ABC, nn.Module):
    def __init__(self, input_size: int = 4, hidden_size: int = 128, 
                 num_layers: int = 2, output_size: int = 4, 
                 dropout: float = 0.2, sequence_length: int = 48,
                 model_path: str = 'models'):
        super().__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.output_size = output_size
        self.dropout = dropout
        self.sequence_length = sequence_length
        self.model_path = model_path
        
        # Device configuration
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Scalers
        self.scaler_X = MinMaxScaler()
        self.scaler_y = MinMaxScaler()
        
        # Feature names
        self.feature_names = ['PM2.5', 'PM10', 'Temperature', 'Humidity']
        
        # Ensure model directory exists
        os.makedirs(model_path, exist_ok=True)
    
    @abstractmethod
    def forward(self, x):
        pass
    
    def prepare_data(self, data: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for training/prediction"""
        # Select features
        features = data[self.feature_names].values
        
        # Create sequences
        X, y = [], []
        for i in range(len(features) - self.sequence_length):
            X.append(features[i:(i + self.sequence_length)])
            y.append(features[i + self.sequence_length])
        
        return np.array(X), np.array(y)
    
    def scale_data(self, X: np.ndarray, y: np.ndarray, 
                   fit_scalers: bool = True) -> Tuple[np.ndarray, np.ndarray]:
        """Scale input and output data"""
        X_scaled = X.copy()
        y_scaled = y.copy()
        
        # Reshape for scaling
        X_reshaped = X.reshape(-1, X.shape[-1])
        
        if fit_scalers:
            X_scaled = self.scaler_X.fit_transform(X_reshaped)
            y_scaled = self.scaler_y.fit_transform(y)
        else:
            X_scaled = self.scaler_X.transform(X_reshaped)
            y_scaled = self.scaler_y.transform(y)
        
        # Reshape back
        X_scaled = X_scaled.reshape(X.shape)
        
        return X_scaled, y_scaled
    
    def train_model(self, data: pd.DataFrame, epochs: int = 100, 
                   batch_size: int = 32, validation_split: float = 0.2,
                   learning_rate: float = 0.001, patience: int = 15) -> Dict:
        """Train the model"""
        self.to(self.device)
        
        # Prepare data
        X, y = self.prepare_data(data)
        X_scaled, y_scaled = self.scale_data(X, y, fit_scalers=True)
        
        # Train/validation split
        split_idx = int(len(X_scaled) * (1 - validation_split))
        X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]
        y_train, y_val = y_scaled[:split_idx], y_scaled[split_idx:]
        
        # Convert to tensors
        X_train = torch.FloatTensor(X_train).to(self.device)
        y_train = torch.FloatTensor(y_train).to(self.device)
        X_val = torch.FloatTensor(X_val).to(self.device)
        y_val = torch.FloatTensor(y_val).to(self.device)
        
        # Training setup
        criterion = nn.MSELoss()
        optimizer = torch.optim.AdamW(self.parameters(), lr=learning_rate, weight_decay=1e-5)
        scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
        
        # Training history
        history = {'train_loss': [], 'val_loss': [], 'lr': []}
        best_val_loss = float('inf')
        patience_counter = 0
        
        self.train()
        for epoch in range(epochs):
            # Training
            train_losses = []
            for i in range(0, len(X_train), batch_size):
                batch_X = X_train[i:i+batch_size]
                batch_y = y_train[i:i+batch_size]
                
                optimizer.zero_grad()
                outputs = self(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)
                optimizer.step()
                
                train_losses.append(loss.item())
            
            # Validation
            self.eval()
            with torch.no_grad():
                val_outputs = self(X_val)
                val_loss = criterion(val_outputs, y_val).item()
            self.train()
            
            # Update history
            avg_train_loss = np.mean(train_losses)
            history['train_loss'].append(avg_train_loss)
            history['val_loss'].append(val_loss)
            history['lr'].append(optimizer.param_groups[0]['lr'])
            
            # Learning rate scheduling
            scheduler.step(val_loss)
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                self.save_model(best=True)
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    print(f"Early stopping at epoch {epoch}")
                    break
            
            if epoch % 10 == 0:
                print(f'Epoch {epoch}, Train Loss: {avg_train_loss:.6f}, Val Loss: {val_loss:.6f}')
        
        return history
    
    def predict(self, data: pd.DataFrame, n_future: int = 24, 
               confidence_interval: bool = False) -> pd.DataFrame:
        """Make predictions"""
        self.eval()
        self.to(self.device)
        
        # Use last sequence_length points
        if len(data) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} data points")
        
        last_sequence = data[self.feature_names].values[-self.sequence_length:]
        last_sequence_scaled = self.scaler_X.transform(last_sequence)
        
        predictions = []
        current_sequence = last_sequence_scaled.copy()
        
        with torch.no_grad():
            for _ in range(n_future):
                # Predict next point
                input_tensor = torch.FloatTensor(current_sequence).unsqueeze(0).to(self.device)
                
                if confidence_interval:
                    # Monte Carlo Dropout for uncertainty
                    self.train()  # Enable dropout
                    pred_samples = []
                    for _ in range(100):
                        pred = self(input_tensor).cpu().numpy()[0]
                        pred_samples.append(pred)
                    self.eval()
                    
                    pred_samples = np.array(pred_samples)
                    prediction = np.mean(pred_samples, axis=0)
                    std = np.std(pred_samples, axis=0)
                else:
                    prediction = self(input_tensor).cpu().numpy()[0]
                    std = None
                
                predictions.append({
                    'prediction': prediction,
                    'std': std
                })
                
                # Update sequence
                current_sequence = np.roll(current_sequence, -1, axis=0)
                current_sequence[-1] = prediction
        
        # Create results DataFrame
        last_timestamp = data.index[-1]
        future_timestamps = pd.date_range(
            start=last_timestamp + pd.Timedelta(hours=1),
            periods=n_future,
            freq='H'
        )
        
        # Inverse transform predictions
        pred_array = np.array([p['prediction'] for p in predictions])
        pred_original = self.scaler_y.inverse_transform(pred_array)
        
        result_df = pd.DataFrame(
            pred_original,
            index=future_timestamps,
            columns=self.feature_names
        )
        
        if confidence_interval:
            std_array = np.array([p['std'] for p in predictions])
            std_original = std_array * (self.scaler_y.data_max_ - self.scaler_y.data_min_)
            
            for i, feature in enumerate(self.feature_names):
                result_df[f'{feature}_lower'] = result_df[feature] - 1.96 * std_original[:, i]
                result_df[f'{feature}_upper'] = result_df[feature] + 1.96 * std_original[:, i]
        
        return result_df
    
    def evaluate(self, data: pd.DataFrame, plot_results: bool = False) -> Dict:
        """Evaluate model performance"""
        X, y = self.prepare_data(data)
        X_scaled, y_scaled = self.scale_data(X, y, fit_scalers=False)
        
        self.eval()
        with torch.no_grad():
            X_tensor = torch.FloatTensor(X_scaled).to(self.device)
            predictions = self(X_tensor).cpu().numpy()
        
        # Inverse transform
        y_true = self.scaler_y.inverse_transform(y)
        y_pred = self.scaler_y.inverse_transform(predictions)
        
        # Calculate metrics for each feature
        metrics = {}
        for i, feature in enumerate(self.feature_names):
            mae = mean_absolute_error(y_true[:, i], y_pred[:, i])
            rmse = np.sqrt(mean_squared_error(y_true[:, i], y_pred[:, i]))
            r2 = r2_score(y_true[:, i], y_pred[:, i])
            mape = np.mean(np.abs((y_true[:, i] - y_pred[:, i]) / y_true[:, i])) * 100
            
            metrics[feature] = {
                'mae': mae,
                'rmse': rmse,
                'r2': r2,
                'mape': mape
            }
        
        # Overall metrics
        overall_mae = mean_absolute_error(y_true.flatten(), y_pred.flatten())
        overall_rmse = np.sqrt(mean_squared_error(y_true.flatten(), y_pred.flatten()))
        overall_r2 = r2_score(y_true.flatten(), y_pred.flatten())
        
        metrics['overall'] = {
            'mae': overall_mae,
            'rmse': overall_rmse,
            'r2': overall_r2
        }
        
        if plot_results:
            self._plot_predictions(y_true, y_pred)
        
        return metrics
    
    def _plot_predictions(self, y_true: np.ndarray, y_pred: np.ndarray):
        """Plot prediction results"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        axes = axes.ravel()
        
        for i, feature in enumerate(self.feature_names):
            axes[i].scatter(y_true[:, i], y_pred[:, i], alpha=0.5)
            axes[i].plot([y_true[:, i].min(), y_true[:, i].max()], 
                        [y_true[:, i].min(), y_true[:, i].max()], 'r--', lw=2)
            axes[i].set_xlabel(f'True {feature}')
            axes[i].set_ylabel(f'Predicted {feature}')
            axes[i].set_title(f'{feature} Predictions')
            
            # Add R² score
            r2 = r2_score(y_true[:, i], y_pred[:, i])
            axes[i].text(0.05, 0.95, f'R² = {r2:.3f}', 
                        transform=axes[i].transAxes, 
                        bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))
        
        plt.tight_layout()
        plt.show()
    
    def save_model(self, best: bool = False):
        """Save model and scalers"""
        suffix = '_best' if best else ''
        
        # Save model state
        model_file = os.path.join(self.model_path, f'{self.__class__.__name__.lower()}{suffix}.pth')
        torch.save(self.state_dict(), model_file)
        
        # Save scalers
        scaler_file = os.path.join(self.model_path, f'scalers{suffix}.pkl')
        joblib.dump({
            'scaler_X': self.scaler_X,
            'scaler_y': self.scaler_y,
            'feature_names': self.feature_names,
            'sequence_length': self.sequence_length
        }, scaler_file)
        
        print(f"Model saved to {model_file}")
    
    def load_model(self, best: bool = False):
        """Load model and scalers"""
        suffix = '_best' if best else ''
        
        # Load model state
        model_file = os.path.join(self.model_path, f'{self.__class__.__name__.lower()}{suffix}.pth')
        if os.path.exists(model_file):
            self.load_state_dict(torch.load(model_file, map_location=self.device))
            print(f"Model loaded from {model_file}")
        
        # Load scalers
        scaler_file = os.path.join(self.model_path, f'scalers{suffix}.pkl')
        if os.path.exists(scaler_file):
            scaler_data = joblib.load(scaler_file)
            self.scaler_X = scaler_data['scaler_X']
            self.scaler_y = scaler_data['scaler_y']
            self.feature_names = scaler_data['feature_names']
            self.sequence_length = scaler_data['sequence_length']
            print(f"Scalers loaded from {scaler_file}")
