# Air Quality Monitoring with Enhanced PyTorch LSTM

## Overview

This project implements an advanced LSTM (Long Short-Term Memory) neural network using PyTorch for predicting air quality parameters. The model can forecast PM2.5, PM10, temperature, and humidity values based on historical sensor data from ThingSpeak.

## Model Architecture

### EnhancedLSTMModel Components

#### 1. Input Projection Layer
```python
self.input_projection = nn.Linear(input_size, hidden_size)
```
- Projects input features to hidden dimension
- Standardizes input representation for LSTM processing

#### 2. Bidirectional LSTM Layers
```python
self.lstm = nn.LSTM(
    input_size=hidden_size,
    hidden_size=hidden_size,
    num_layers=num_layers,
    dropout=dropout,
    batch_first=True,
    bidirectional=True
)
```
- **Bidirectional**: Processes sequences in both forward and backward directions
- **Multiple layers**: Deep architecture for complex pattern recognition
- **Dropout**: Prevents overfitting between LSTM layers

#### 3. Multi-Head Attention Mechanism
```python
self.attention = nn.MultiheadAttention(
    embed_dim=hidden_size * 2,
    num_heads=8,
    dropout=dropout,
    batch_first=True
)
```
- **Purpose**: Helps model focus on important time steps
- **Multi-head**: Allows attention to different representation subspaces
- **Self-attention**: Compares each time step with all others

#### 4. Batch Normalization & Regularization
- **Batch Normalization**: Stabilizes training and improves convergence
- **Dropout**: Reduces overfitting during training
- **Gradient Clipping**: Prevents exploding gradients

#### 5. Dense Prediction Layers
```python
self.dense_layers = nn.Sequential(
    nn.Linear(hidden_size * 2, hidden_size),
    nn.ReLU(),
    nn.Dropout(dropout),
    nn.Linear(hidden_size, hidden_size // 2),
    nn.ReLU(),
    nn.Dropout(dropout),
    nn.Linear(hidden_size // 2, output_size)
)
```
- Progressive dimension reduction
- ReLU activations for non-linearity
- Final layer outputs 4 values (PM2.5, PM10, temperature, humidity)

## Data Processing Pipeline

### 1. Data Cleaning
- **Outlier Detection**: Uses IQR method with sensor-specific bounds
- **Range Validation**: Applies realistic limits for each parameter
  - PM2.5/PM10: 0-500/600 μg/m³
  - Temperature: -40 to 60°C
  - Humidity: 0-100%

### 2. Sequence Creation
- **Sequence Length**: 48 hours of historical data
- **Sliding Window**: Creates overlapping sequences for training
- **Target**: Next hour's sensor readings

### 3. Feature Scaling
- **MinMaxScaler**: Normalizes all features to [0,1] range
- **Separate Scalers**: Different scalers for input (X) and output (y)
- **Consistent Scaling**: Same scalers used for training and prediction

## Training Process

### 1. Data Splitting
- **Training Set**: 80% of available data
- **Validation Set**: 20% for hyperparameter tuning and early stopping

### 2. Optimization Strategy
```python
optimizer = optim.AdamW(
    model.parameters(), 
    lr=0.0005, 
    weight_decay=1e-5
)
```
- **AdamW**: Advanced optimizer with weight decay
- **Learning Rate Scheduling**: Reduces LR when validation loss plateaus
- **Early Stopping**: Prevents overfitting with patience mechanism

### 3. Training Monitoring
- **Loss Function**: Mean Squared Error (MSE)
- **Metrics Tracking**: Train/validation loss, learning rate
- **Progress Visualization**: Real-time training progress with tqdm

## Prediction Capabilities

### 1. Standard Prediction
```python
predictions = model.predict(data, n_future=24)
```
- Forecasts next 24 hours
- Uses last 48 hours of data
- Returns DataFrame with timestamps

### 2. Uncertainty Quantification
```python
predictions = model.predict(data, n_future=24, confidence_interval=True)
```
- **Monte Carlo Dropout**: Runs multiple forward passes with dropout enabled
- **Confidence Intervals**: Provides upper/lower bounds (95% confidence)
- **Uncertainty Estimation**: Quantifies prediction reliability

## ThingSpeak Integration

### Data Fetching
The `/api/thingspeak/fetch-all` endpoint provides comprehensive data retrieval:

```javascript
// Fetches all available data in chunks
const response = await fetch('/api/thingspeak/fetch-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        includeAnalysis: true,
        chunkSize: 8000
    })
});
```

### Data Analysis Features
- **Memory-Efficient Processing**: Handles large datasets with chunking
- **Statistical Analysis**: Provides summary statistics for each field
- **Data Quality Metrics**: Fill rates, outlier detection, range validation

## Model Performance

### Evaluation Metrics
- **MAE (Mean Absolute Error)**: Average absolute difference
- **RMSE (Root Mean Square Error)**: Penalizes larger errors more
- **MAPE (Mean Absolute Percentage Error)**: Relative error percentage
- **R² (Coefficient of Determination)**: Explained variance

### Hardware Optimization
- **GPU Acceleration**: Automatic CUDA detection and usage
- **Memory Management**: Efficient tensor operations
- **Batch Processing**: Optimized for parallel computation

## Usage Examples

### 1. Training a New Model
```python
from python.lstm_model import AirQualityLSTM
import pandas as pd

# Initialize model
lstm_model = AirQualityLSTM(model_path='models/lstm')

# Load your data
data = pd.read_csv('thingspeak_data.csv')
data['timestamp'] = pd.to_datetime(data['timestamp'])
data.set_index('timestamp', inplace=True)

# Train model
history = lstm_model.train(
    data=data,
    epochs=100,
    batch_size=64,
    validation_split=0.2
)
```

### 2. Making Predictions
```python
# Load trained model
lstm_model = AirQualityLSTM(model_path='models/lstm')
lstm_model.load_model()

# Get latest data (minimum 48 hours)
recent_data = data.tail(48)

# Predict next 24 hours with confidence intervals
predictions = lstm_model.predict(
    data=recent_data,
    n_future=24,
    confidence_interval=True
)

print(predictions)
```

### 3. Model Evaluation
```python
# Evaluate on test data
test_data = data.tail(1000)  # Last 1000 points
metrics = lstm_model.evaluate(test_data, plot_results=True)

print("Model Performance:")
for feature, metric in metrics.items():
    if feature != 'overall':
        print(f"{feature}: MAE={metric['mae']:.2f}, R²={metric['r2']:.3f}")
```

## Advanced Features

### 1. Hyperparameter Tuning
Modify model configuration for different scenarios:
```python
lstm_model = AirQualityLSTM(
    model_path='models/lstm_tuned',
    use_cuda=True
)

# Adjust hyperparameters
lstm_model.hidden_size = 256
lstm_model.num_layers = 4
lstm_model.dropout = 0.4
lstm_model.sequence_length = 72  # 3 days of data
```

### 2. Transfer Learning
```python
# Load pre-trained model
base_model = AirQualityLSTM(model_path='models/base_lstm')
base_model.load_model()

# Fine-tune on new data
history = base_model.train(
    data=new_location_data,
    epochs=50,  # Fewer epochs for fine-tuning
    learning_rate=0.0001  # Lower learning rate
)
```

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**
   - Reduce batch_size (try 32 or 16)
   - Reduce sequence_length
   - Use CPU instead: `use_cuda=False`

2. **Poor Prediction Quality**
   - Increase sequence_length (more historical context)
   - Add more training data
   - Adjust model architecture (hidden_size, num_layers)

3. **Training Not Converging**
   - Check data quality and scaling
   - Adjust learning rate
   - Increase patience for early stopping

### Performance Optimization

1. **For Large Datasets**
   - Use gradient accumulation
   - Implement data generators
   - Consider distributed training

2. **For Real-time Predictions**
   - Pre-load model at startup
   - Use smaller models for faster inference
   - Implement model caching

## File Structure

```
air-quality-monitoring/
├── python/
│   └── lstm_model.py          # Main LSTM implementation
├── routes/api/
│   └── thingspeak.js         # ThingSpeak API integration
├── models/
│   ├── lstm/                 # Saved model files
│   │   ├── enhanced_lstm_model.pth
│   │   ├── enhanced_lstm_model_best.pth
│   │   ├── scalers.pkl
│   │   └── scalers_best.pkl
├── data/
│   └── thingspeak-data.csv   # Exported sensor data
└── explanation.md            # This documentation
```

## Next Steps

1. **Model Improvements**
   - Implement transformer architecture
   - Add ensemble methods
   - Explore time series decomposition

2. **Production Deployment**
   - Containerize with Docker
   - Set up automated retraining
   - Implement monitoring and alerting

3. **Extended Features**
   - Multi-location modeling
   - Weather data integration
   - Anomaly detection capabilities
