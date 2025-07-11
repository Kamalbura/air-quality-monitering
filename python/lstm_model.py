import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler, StandardScaler
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import joblib
import os
import json
from datetime import datetime
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm
import warnings
warnings.filterwarnings('ignore')

class EnhancedLSTMModel(nn.Module):
    """Enhanced PyTorch LSTM Model for Air Quality Prediction with attention mechanism"""
    
    def __init__(self, input_size, hidden_size=128, num_layers=3, output_size=4, dropout=0.3, use_attention=True):
        super(EnhancedLSTMModel, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.use_attention = use_attention
        
        # Input projection layer
        self.input_projection = nn.Linear(input_size, hidden_size)
        
        # LSTM layers with bidirectional capability
        self.lstm = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True,
            bidirectional=True
        )
        
        # Attention mechanism
        if use_attention:
            self.attention = nn.MultiheadAttention(
                embed_dim=hidden_size * 2,  # *2 for bidirectional
                num_heads=8,
                dropout=dropout,
                batch_first=True
            )
        
        # Batch normalization
        self.batch_norm = nn.BatchNorm1d(hidden_size * 2)
        
        # Dropout layers
        self.dropout = nn.Dropout(dropout)
        
        # Dense layers for final prediction
        self.dense_layers = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, output_size)
        )
        
        # Initialize weights
        self._initialize_weights()
    
    def _initialize_weights(self):
        """Initialize model weights using Xavier initialization"""
        for name, param in self.named_parameters():
            if 'weight' in name:
                if len(param.shape) >= 2:
                    nn.init.xavier_uniform_(param)
                else:
                    nn.init.uniform_(param, -0.1, 0.1)
            elif 'bias' in name:
                nn.init.constant_(param, 0)
    
    def forward(self, x):
        batch_size, seq_len, _ = x.size()
        
        # Project input
        x = self.input_projection(x)
        
        # Initialize hidden state with zeros
        h0 = torch.zeros(self.num_layers * 2, batch_size, self.hidden_size).to(x.device)  # *2 for bidirectional
        c0 = torch.zeros(self.num_layers * 2, batch_size, self.hidden_size).to(x.device)
        
        # Forward propagate LSTM
        lstm_out, _ = self.lstm(x, (h0, c0))
        
        # Apply attention if enabled
        if self.use_attention:
            attended_out, _ = self.attention(lstm_out, lstm_out, lstm_out)
            lstm_out = lstm_out + attended_out  # Residual connection
        
        # Get the last output
        final_output = lstm_out[:, -1, :]
        
        # Apply batch normalization
        if final_output.size(0) > 1:  # Only apply if batch size > 1
            final_output = self.batch_norm(final_output)
        
        # Apply dropout
        final_output = self.dropout(final_output)
        
        # Pass through dense layers
        output = self.dense_layers(final_output)
        
        return output

class AirQualityLSTM:
    def __init__(self, model_path='models/lstm', use_cuda=True):
        self.model_path = model_path
        self.model = None
        self.scaler_X = None
        self.scaler_y = None
        self.sequence_length = 48  # Use 48 hours of data for better prediction
        self.features = ['pm25', 'pm10', 'temperature', 'humidity']
        self.target_features = ['pm25', 'pm10', 'temperature', 'humidity']
        
        # Device configuration with better GPU detection
        if use_cuda and torch.cuda.is_available():
            self.device = torch.device('cuda')
            torch.backends.cudnn.benchmark = True  # Optimize for consistent input sizes
        else:
            self.device = torch.device('cpu')
        
        # Model hyperparameters
        self.hidden_size = 128
        self.num_layers = 3
        self.dropout = 0.3
        self.learning_rate = 0.0005
        self.weight_decay = 1e-5
        self.use_attention = True
        
        # Training configuration
        self.patience = 15
        self.min_delta = 1e-6
        self.scheduler_patience = 7
        self.scheduler_factor = 0.5
        
        # Create model directory if it doesn't exist
        os.makedirs(model_path, exist_ok=True)
        
        self._print_device_info()
    
    def _print_device_info(self):
        """Print device information"""
        print(f"Using device: {self.device}")
        if self.device.type == 'cuda':
            print(f"GPU: {torch.cuda.get_device_name(0)}")
            print(f"CUDA Version: {torch.version.cuda}")
            print(f"GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
        else:
            print("Running on CPU")

    def prepare_data(self, data, is_training=True, validation_split=0.2):
        """Enhanced data preparation with better validation"""
        # Validate required features
        missing_features = [f for f in self.features if f not in data.columns]
        if missing_features:
            raise ValueError(f"Missing features in data: {missing_features}")
        
        # Clean and preprocess data
        data_cleaned = self._clean_data(data.copy())
        
        # Extract features and targets
        X_data = data_cleaned[self.features].values.astype(np.float32)
        y_data = data_cleaned[self.target_features].values.astype(np.float32)
        
        # Handle missing values with forward fill then backward fill
        X_df = pd.DataFrame(X_data, columns=self.features)
        y_df = pd.DataFrame(y_data, columns=self.target_features)
        
        X_data = X_df.fillna(method='ffill').fillna(method='bfill').values
        y_data = y_df.fillna(method='ffill').fillna(method='bfill').values
        
        # Scale the data
        if is_training:
            self.scaler_X = MinMaxScaler(feature_range=(0, 1))
            self.scaler_y = MinMaxScaler(feature_range=(0, 1))
            X_scaled = self.scaler_X.fit_transform(X_data)
            y_scaled = self.scaler_y.fit_transform(y_data)
        else:
            if self.scaler_X is None or self.scaler_y is None:
                raise ValueError("Scalers not fitted. Need to train model first.")
            X_scaled = self.scaler_X.transform(X_data)
            y_scaled = self.scaler_y.transform(y_data)
        
        # Create sequences
        X_sequences, y_sequences = self._create_sequences(X_scaled, y_scaled)
        
        if len(X_sequences) == 0:
            raise ValueError(f"Not enough data to create sequences. Need at least {self.sequence_length + 1} data points.")
        
        # Convert to tensors
        X_tensor = torch.FloatTensor(X_sequences).to(self.device)
        y_tensor = torch.FloatTensor(y_sequences).to(self.device)
        
        if is_training:
            # Split into training and validation
            val_size = int(len(X_tensor) * validation_split)
            train_size = len(X_tensor) - val_size
            
            X_train = X_tensor[:train_size]
            X_val = X_tensor[train_size:]
            y_train = y_tensor[:train_size]
            y_val = y_tensor[train_size:]
            
            return X_train, X_val, y_train, y_val
        
        return X_tensor, y_tensor
    
    def _clean_data(self, data):
        """Enhanced data cleaning with outlier detection"""
        # Remove obvious outliers using IQR method
        for feature in self.features:
            if feature in data.columns:
                Q1 = data[feature].quantile(0.25)
                Q3 = data[feature].quantile(0.75)
                IQR = Q3 - Q1
                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR
                
                # Apply reasonable bounds for each feature
                if feature == 'pm25':
                    lower_bound = max(0, lower_bound)
                    upper_bound = min(500, upper_bound)
                elif feature == 'pm10':
                    lower_bound = max(0, lower_bound)
                    upper_bound = min(600, upper_bound)
                elif feature == 'temperature':
                    lower_bound = max(-40, lower_bound)
                    upper_bound = min(60, upper_bound)
                elif feature == 'humidity':
                    lower_bound = max(0, lower_bound)
                    upper_bound = min(100, upper_bound)
                
                data[feature] = data[feature].clip(lower_bound, upper_bound)
        
        return data
    
    def _create_sequences(self, X_data, y_data):
        """Create sequences for LSTM training"""
        X_sequences, y_sequences = [], []
        
        for i in range(len(X_data) - self.sequence_length):
            X_sequences.append(X_data[i:i + self.sequence_length])
            y_sequences.append(y_data[i + self.sequence_length])
        
        return np.array(X_sequences), np.array(y_sequences)

    def create_model(self):
        """Create enhanced PyTorch LSTM model"""
        model = EnhancedLSTMModel(
            input_size=len(self.features),
            hidden_size=self.hidden_size,
            num_layers=self.num_layers,
            output_size=len(self.target_features),
            dropout=self.dropout,
            use_attention=self.use_attention
        ).to(self.device)
        
        return model

    def train(self, data, epochs=100, batch_size=64, validation_split=0.2, verbose=True):
        """Enhanced training with better monitoring and early stopping"""
        if verbose:
            print(f"Training Enhanced LSTM model on {self.device}")
            print(f"Data shape: {data.shape}")
        
        # Prepare data
        X_train, X_val, y_train, y_val = self.prepare_data(data, is_training=True, validation_split=validation_split)
        
        if verbose:
            print(f"Training sequences: {X_train.shape[0]}, Validation sequences: {X_val.shape[0]}")
        
        # Create data loaders
        train_dataset = TensorDataset(X_train, y_train)
        val_dataset = TensorDataset(X_val, y_val)
        
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
        
        # Create model
        self.model = self.create_model()
        
        # Loss function and optimizer
        criterion = nn.MSELoss()
        optimizer = optim.AdamW(
            self.model.parameters(), 
            lr=self.learning_rate, 
            weight_decay=self.weight_decay
        )
        
        # Learning rate scheduler
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            optimizer, 
            mode='min',
            patience=self.scheduler_patience, 
            factor=self.scheduler_factor,
            verbose=verbose
        )
        
        # Training history
        history = {
            'train_loss': [],
            'val_loss': [],
            'lr': [],
            'best_epoch': 0,
            'best_val_loss': float('inf')
        }
        
        # Early stopping variables
        best_val_loss = float('inf')
        patience_counter = 0
        
        # Training loop with progress bar
        epoch_iterator = tqdm(range(epochs), desc="Training") if verbose else range(epochs)
        
        for epoch in epoch_iterator:
            # Training phase
            self.model.train()
            train_loss = 0.0
            train_batches = 0
            
            for batch_X, batch_y in train_loader:
                optimizer.zero_grad()
                outputs = self.model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                
                # Gradient clipping to prevent exploding gradients
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                
                optimizer.step()
                train_loss += loss.item()
                train_batches += 1
            
            # Validation phase
            self.model.eval()
            val_loss = 0.0
            val_batches = 0
            
            with torch.no_grad():
                for batch_X, batch_y in val_loader:
                    outputs = self.model(batch_X)
                    loss = criterion(outputs, batch_y)
                    val_loss += loss.item()
                    val_batches += 1
            
            # Calculate average losses
            avg_train_loss = train_loss / train_batches
            avg_val_loss = val_loss / val_batches
            
            # Update learning rate
            scheduler.step(avg_val_loss)
            current_lr = optimizer.param_groups[0]['lr']
            
            # Store history
            history['train_loss'].append(avg_train_loss)
            history['val_loss'].append(avg_val_loss)
            history['lr'].append(current_lr)
            
            # Check for improvement
            if avg_val_loss < best_val_loss - self.min_delta:
                best_val_loss = avg_val_loss
                history['best_epoch'] = epoch
                history['best_val_loss'] = best_val_loss
                patience_counter = 0
                
                # Save best model
                self.save_model(is_best=True)
            else:
                patience_counter += 1
            
            # Update progress bar
            if verbose and isinstance(epoch_iterator, tqdm):
                epoch_iterator.set_postfix({
                    'Train Loss': f'{avg_train_loss:.4f}',
                    'Val Loss': f'{avg_val_loss:.4f}',
                    'LR': f'{current_lr:.6f}',
                    'Patience': f'{patience_counter}/{self.patience}'
                })
            
            # Early stopping
            if patience_counter >= self.patience:
                if verbose:
                    print(f"\nEarly stopping triggered at epoch {epoch + 1}")
                break
            
            # Print progress every 20 epochs
            if verbose and (epoch + 1) % 20 == 0:
                print(f'\nEpoch [{epoch+1}/{epochs}], Train Loss: {avg_train_loss:.4f}, Val Loss: {avg_val_loss:.4f}, LR: {current_lr:.6f}')
        
        # Load best model
        self.load_model(load_best=True)
        
        if verbose:
            print(f"\nTraining completed!")
            print(f"Best validation loss: {history['best_val_loss']:.4f} at epoch {history['best_epoch'] + 1}")
        
        return history

    def predict(self, data, n_future=24, confidence_interval=True):
        """Enhanced prediction with confidence intervals"""
        if self.model is None:
            if not self.load_model():
                raise ValueError("No trained model found. Please train the model first.")
        
        self.model.eval()
        
        # Prepare data
        if len(data) < self.sequence_length:
            raise ValueError(f"Need at least {self.sequence_length} data points for prediction")
        
        # Get the last sequence_length data points
        recent_data = data.tail(self.sequence_length).copy()
        X_tensor, _ = self.prepare_data(recent_data, is_training=False)
        
        # Generate predictions
        predictions = []
        uncertainties = []
        current_sequence = X_tensor[-1].unsqueeze(0)  # Add batch dimension
        
        with torch.no_grad():
            for _ in range(n_future):
                # Enable dropout for uncertainty estimation if confidence intervals requested
                if confidence_interval:
                    self.model.train()  # Enable dropout
                    monte_carlo_predictions = []
                    for _ in range(50):  # Monte Carlo samples
                        pred = self.model(current_sequence)
                        monte_carlo_predictions.append(pred.cpu().numpy()[0])
                    
                    # Calculate mean and std
                    mc_predictions = np.array(monte_carlo_predictions)
                    next_pred_mean = np.mean(mc_predictions, axis=0)
                    next_pred_std = np.std(mc_predictions, axis=0)
                    
                    predictions.append(next_pred_mean)
                    uncertainties.append(next_pred_std)
                    
                    # Use mean for next sequence
                    next_pred_tensor = torch.FloatTensor(next_pred_mean).unsqueeze(0).to(self.device)
                else:
                    self.model.eval()
                    next_pred = self.model(current_sequence)
                    predictions.append(next_pred.cpu().numpy()[0])
                    next_pred_tensor = next_pred
                
                # Update sequence for next prediction
                next_pred_expanded = next_pred_tensor.unsqueeze(1)  # Add time dimension
                current_sequence = torch.cat([current_sequence[:, 1:, :], next_pred_expanded], dim=1)
        
        # Inverse transform predictions
        predictions = self.scaler_y.inverse_transform(np.array(predictions))
        
        # Create timestamps for predictions
        last_timestamp = data.index[-1] if hasattr(data, 'index') else pd.Timestamp.now()
        future_timestamps = pd.date_range(
            start=last_timestamp + pd.Timedelta(hours=1),
            periods=n_future,
            freq='H'
        )
        
        result_df = pd.DataFrame(
            predictions,
            columns=self.target_features,
            index=future_timestamps
        )
        
        # Add confidence intervals if requested
        if confidence_interval and uncertainties:
            uncertainties = self.scaler_y.inverse_transform(np.array(uncertainties))
            for i, feature in enumerate(self.target_features):
                result_df[f'{feature}_lower'] = predictions[:, i] - 1.96 * uncertainties[:, i]
                result_df[f'{feature}_upper'] = predictions[:, i] + 1.96 * uncertainties[:, i]
        
        return result_df

    def save_model(self, is_best=False):
        """Save model with enhanced metadata"""
        if self.model is not None:
            suffix = '_best' if is_best else ''
            model_file = os.path.join(self.model_path, f'enhanced_lstm_model{suffix}.pth')
            
            torch.save({
                'model_state_dict': self.model.state_dict(),
                'model_config': {
                    'input_size': len(self.features),
                    'hidden_size': self.hidden_size,
                    'num_layers': self.num_layers,
                    'output_size': len(self.target_features),
                    'dropout': self.dropout,
                    'use_attention': self.use_attention
                },
                'features': self.features,
                'target_features': self.target_features,
                'sequence_length': self.sequence_length,
                'device': str(self.device),
                'pytorch_version': torch.__version__,
                'timestamp': datetime.now().isoformat()
            }, model_file)
            
        if self.scaler_X is not None and self.scaler_y is not None:
            suffix = '_best' if is_best else ''
            scaler_file = os.path.join(self.model_path, f'scalers{suffix}.pkl')
            joblib.dump({
                'scaler_X': self.scaler_X,
                'scaler_y': self.scaler_y
            }, scaler_file)
        
        if not is_best:  # Only print for regular saves, not best model saves
            print(f"Model saved to {self.model_path}")

    def load_model(self, load_best=False):
        """Load saved model with better error handling"""
        suffix = '_best' if load_best else ''
        model_file = os.path.join(self.model_path, f'enhanced_lstm_model{suffix}.pth')
        scaler_file = os.path.join(self.model_path, f'scalers{suffix}.pkl')
        
        if os.path.exists(model_file) and os.path.exists(scaler_file):
            try:
                # Load model
                checkpoint = torch.load(model_file, map_location=self.device)
                
                # Create model with saved config
                model_config = checkpoint['model_config']
                self.model = EnhancedLSTMModel(**model_config).to(self.device)
                self.model.load_state_dict(checkpoint['model_state_dict'])
                
                # Load other attributes
                self.features = checkpoint['features']
                self.target_features = checkpoint.get('target_features', self.features)
                self.sequence_length = checkpoint['sequence_length']
                
                # Load scalers
                scalers = joblib.load(scaler_file)
                self.scaler_X = scalers['scaler_X']
                self.scaler_y = scalers['scaler_y']
                
                print(f"Model loaded from {self.model_path}")
                print(f"Model trained on: {checkpoint.get('timestamp', 'Unknown')}")
                print(f"PyTorch version: {checkpoint.get('pytorch_version', 'Unknown')}")
                return True
                
            except Exception as e:
                print(f"Error loading model: {e}")
                return False
        
        return False

    def evaluate(self, test_data, plot_results=False):
        """Enhanced model evaluation with detailed metrics"""
        if self.model is None:
            if not self.load_model():
                raise ValueError("No trained model found. Please train the model first.")
        
        self.model.eval()
        
        # Prepare test data
        X_test, y_test = self.prepare_data(test_data, is_training=False)
        
        # Get predictions
        with torch.no_grad():
            y_pred = self.model(X_test)
        
        # Convert to numpy and inverse transform
        y_actual = self.scaler_y.inverse_transform(y_test.cpu().numpy())
        y_pred = self.scaler_y.inverse_transform(y_pred.cpu().numpy())
        
        # Calculate metrics for each feature
        metrics = {}
        for i, feature in enumerate(self.target_features):
            actual = y_actual[:, i]
            pred = y_pred[:, i]
            
            mae = np.mean(np.abs(actual - pred))
            rmse = np.sqrt(np.mean((actual - pred)**2))
            mape = np.mean(np.abs((actual - pred) / (actual + 1e-8)) * 100)
            r2 = 1 - np.sum((actual - pred)**2) / np.sum((actual - np.mean(actual))**2)
            
            metrics[feature] = {
                'mae': float(mae),
                'rmse': float(rmse),
                'mape': float(mape),
                'r2': float(r2)
            }
        
        # Overall metrics
        overall_mae = np.mean([metrics[f]['mae'] for f in self.target_features])
        overall_rmse = np.sqrt(np.mean([metrics[f]['rmse']**2 for f in self.target_features]))
        
        metrics['overall'] = {
            'mae': float(overall_mae),
            'rmse': float(overall_rmse),
            'device': str(self.device)
        }
        
        # Plot results if requested
        if plot_results:
            self._plot_evaluation_results(y_actual, y_pred)
        
        return metrics
    
    def _plot_evaluation_results(self, y_actual, y_pred):
        """Plot evaluation results"""
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        fig.suptitle('Model Evaluation Results', fontsize=16)
        
        for i, feature in enumerate(self.target_features):
            row, col = i // 2, i % 2
            ax = axes[row, col]
            
            actual = y_actual[:, i]
            pred = y_pred[:, i]
            
            # Scatter plot
            ax.scatter(actual, pred, alpha=0.6, s=20)
            
            # Perfect prediction line
            min_val, max_val = min(actual.min(), pred.min()), max(actual.max(), pred.max())
            ax.plot([min_val, max_val], [min_val, max_val], 'r--', lw=2, label='Perfect Prediction')
            
            ax.set_xlabel(f'Actual {feature}')
            ax.set_ylabel(f'Predicted {feature}')
            ax.set_title(f'{feature} Prediction')
            ax.legend()
            ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.show()
