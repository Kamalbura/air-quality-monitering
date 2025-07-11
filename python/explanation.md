# Deep Learning for Air Quality Monitoring - Complete Guide

Welcome to your journey into Deep Learning! This guide will teach you how to apply machine learning to air quality data step by step.

## Table of Contents
1. [What is Deep Learning?](#what-is-deep-learning)
2. [Why Use ML for Air Quality?](#why-use-ml-for-air-quality)
3. [Understanding Your Data](#understanding-your-data)
4. [Setting Up Your Environment](#setting-up-your-environment)
5. [Data Preprocessing](#data-preprocessing)
6. [Building Your First Model](#building-your-first-model)
7. [Training and Evaluation](#training-and-evaluation)
8. [Advanced Techniques](#advanced-techniques)
9. [Deployment](#deployment)

## What is Deep Learning?

Deep Learning is a subset of Machine Learning that uses neural networks with multiple layers to learn patterns in data. Think of it like this:

```
Traditional Programming: Data + Rules → Results
Machine Learning: Data + Results → Rules
Deep Learning: Lots of Data → Complex Patterns → Predictions
```

### Key Concepts:
- **Neural Networks**: Inspired by how brain neurons work
- **Layers**: Each layer learns different features (edges → shapes → objects)
- **Training**: Process of teaching the model using historical data
- **Prediction**: Using trained model to forecast future values

## Why Use ML for Air Quality?

Air quality monitoring involves several challenges that ML can solve:

1. **Prediction**: Forecast PM2.5, PM10 levels hours or days ahead
2. **Pattern Recognition**: Identify pollution sources and trends
3. **Anomaly Detection**: Detect unusual pollution events
4. **Data Quality**: Fill missing sensor readings
5. **Correlation Analysis**: Understand relationships between weather and pollution

### Real-world Applications:
- **Health Alerts**: Predict when air quality will be unhealthy
- **Urban Planning**: Identify pollution hotspots
- **Policy Making**: Understand pollution patterns for regulations
- **Personal Safety**: App notifications for outdoor activities

## Understanding Your Data

Your ThingSpeak data contains these fields:
```
field1: Humidity (%)
field2: Temperature (°C)
field3: PM2.5 (μg/m³)
field4: PM10 (μg/m³)
timestamp: When measurement was taken
```

### Data Characteristics:
- **Time Series**: Data points ordered by time
- **Seasonal Patterns**: Daily, weekly, seasonal variations
- **External Factors**: Weather, traffic, industrial activity
- **Noise**: Sensor errors, temporary spikes

## Setting Up Your Environment

Let's create your Python environment step by step:

### Step 1: Install Required Libraries
```bash
pip install pandas numpy matplotlib seaborn scikit-learn tensorflow keras plotly jupyter
```

### Step 2: Project Structure
```
python/
├── data/
│   ├── raw/              # Original ThingSpeak data
│   ├── processed/        # Cleaned data
│   └── external/         # Weather data, etc.
├── models/
│   ├── saved_models/     # Trained models
│   └── experiments/      # Model versions
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_preprocessing.ipynb
│   ├── 03_model_training.ipynb
│   └── 04_evaluation.ipynb
├── src/
│   ├── data_loader.py
│   ├── preprocessor.py
│   ├── models.py
│   └── utils.py
└── explanation.md        # This file
```

### Step 3: Essential Imports
```python
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, mean_absolute_error
import tensorflow as tf
from tensorflow import keras
import warnings
warnings.filterwarnings('ignore')
```

## Data Preprocessing

Data preprocessing is crucial for ML success. Here's what we need to do:

### 1. Loading Data
```python
# Load data from ThingSpeak CSV
df = pd.read_csv('data/raw/thingspeak-data.csv')
df['timestamp'] = pd.to_datetime(df['TIMESTAMP'])
df = df.set_index('timestamp')

# Rename columns for clarity
df.rename(columns={
    'HUMIDITY': 'humidity',
    'TEMPERATURE': 'temperature', 
    'PM25': 'pm25',
    'PM10': 'pm10'
}, inplace=True)
```

### 2. Data Cleaning
```python
# Handle missing values
def clean_data(df):
    # Remove obviously wrong values
    df = df[(df['pm25'] >= 0) & (df['pm25'] <= 500)]  # PM2.5 range
    df = df[(df['pm10'] >= 0) & (df['pm10'] <= 600)]  # PM10 range
    df = df[(df['temperature'] >= -20) & (df['temperature'] <= 60)]  # Temperature range
    df = df[(df['humidity'] >= 0) & (df['humidity'] <= 100)]  # Humidity range
    
    # Fill missing values with interpolation
    df = df.interpolate(method='time')
    
    return df
```

### 3. Feature Engineering
```python
def create_features(df):
    # Time-based features
    df['hour'] = df.index.hour
    df['day_of_week'] = df.index.dayofweek
    df['month'] = df.index.month
    df['season'] = df['month'].map({12:0, 1:0, 2:0,  # Winter
                                   3:1, 4:1, 5:1,   # Spring
                                   6:2, 7:2, 8:2,   # Summer
                                   9:3, 10:3, 11:3}) # Fall
    
    # Lag features (previous values)
    for col in ['pm25', 'pm10', 'temperature', 'humidity']:
        df[f'{col}_lag1'] = df[col].shift(1)
        df[f'{col}_lag24'] = df[col].shift(24)  # 24 hours ago
    
    # Rolling averages
    df['pm25_ma3'] = df['pm25'].rolling(window=3).mean()
    df['pm25_ma24'] = df['pm25'].rolling(window=24).mean()
    
    # Air Quality Index calculation
    df['aqi'] = calculate_aqi(df['pm25'])
    
    return df

def calculate_aqi(pm25):
    # Simplified AQI calculation for PM2.5
    conditions = [
        pm25 <= 12,
        (pm25 > 12) & (pm25 <= 35.4),
        (pm25 > 35.4) & (pm25 <= 55.4),
        (pm25 > 55.4) & (pm25 <= 150.4),
        pm25 > 150.4
    ]
    choices = [0, 1, 2, 3, 4]  # Good, Moderate, Unhealthy for Sensitive, Unhealthy, Very Unhealthy
    return np.select(conditions, choices, default=4)
```

### 4. Data Scaling
```python
def scale_data(X_train, X_test, y_train, y_test):
    # Scale features to 0-1 range
    feature_scaler = MinMaxScaler()
    target_scaler = MinMaxScaler()
    
    X_train_scaled = feature_scaler.fit_transform(X_train)
    X_test_scaled = feature_scaler.transform(X_test)
    
    y_train_scaled = target_scaler.fit_transform(y_train.reshape(-1, 1))
    y_test_scaled = target_scaler.transform(y_test.reshape(-1, 1))
    
    return X_train_scaled, X_test_scaled, y_train_scaled, y_test_scaled, feature_scaler, target_scaler
```

## Building Your First Model

Let's start with a simple model and gradually increase complexity:

### 1. Linear Regression (Baseline)
```python
from sklearn.linear_model import LinearRegression

def baseline_model(X_train, y_train, X_test, y_test):
    model = LinearRegression()
    model.fit(X_train, y_train)
    
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)
    
    train_rmse = np.sqrt(mean_squared_error(y_train, train_pred))
    test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
    
    print(f"Linear Regression - Train RMSE: {train_rmse:.2f}, Test RMSE: {test_rmse:.2f}")
    return model, test_pred
```

### 2. Simple Neural Network
```python
def create_simple_nn(input_shape):
    model = keras.Sequential([
        keras.layers.Dense(64, activation='relu', input_shape=(input_shape,)),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(32, activation='relu'),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(16, activation='relu'),
        keras.layers.Dense(1)  # Output layer for regression
    ])
    
    model.compile(optimizer='adam', 
                  loss='mse', 
                  metrics=['mae'])
    return model
```

### 3. LSTM for Time Series
```python
def create_lstm_model(timesteps, features):
    model = keras.Sequential([
        keras.layers.LSTM(50, return_sequences=True, input_shape=(timesteps, features)),
        keras.layers.Dropout(0.2),
        keras.layers.LSTM(50, return_sequences=False),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(25),
        keras.layers.Dense(1)
    ])
    
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

def prepare_lstm_data(data, timesteps=24):
    X, y = [], []
    for i in range(timesteps, len(data)):
        X.append(data[i-timesteps:i])
        y.append(data[i, 0])  # Assuming first column is target
    return np.array(X), np.array(y)
```

## Training and Evaluation

### Training Process
```python
def train_model(model, X_train, y_train, X_val, y_val, epochs=100):
    # Callbacks for better training
    early_stopping = keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=10, restore_best_weights=True
    )
    
    reduce_lr = keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss', factor=0.2, patience=5, min_lr=0.001
    )
    
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=epochs,
        batch_size=32,
        callbacks=[early_stopping, reduce_lr],
        verbose=1
    )
    
    return history
```

### Evaluation Metrics
```python
def evaluate_model(model, X_test, y_test, target_scaler=None):
    predictions = model.predict(X_test)
    
    # Inverse transform if scaled
    if target_scaler:
        predictions = target_scaler.inverse_transform(predictions)
        y_test = target_scaler.inverse_transform(y_test.reshape(-1, 1))
    
    # Calculate metrics
    rmse = np.sqrt(mean_squared_error(y_test, predictions))
    mae = mean_absolute_error(y_test, predictions)
    mape = np.mean(np.abs((y_test - predictions) / y_test)) * 100
    
    print(f"Model Performance:")
    print(f"RMSE: {rmse:.2f}")
    print(f"MAE: {mae:.2f}")
    print(f"MAPE: {mape:.2f}%")
    
    return {'rmse': rmse, 'mae': mae, 'mape': mape}
```

### Visualization
```python
def plot_predictions(y_true, y_pred, title="Model Predictions"):
    plt.figure(figsize=(12, 6))
    plt.plot(y_true[:100], label='Actual', alpha=0.7)
    plt.plot(y_pred[:100], label='Predicted', alpha=0.7)
    plt.title(title)
    plt.xlabel('Time')
    plt.ylabel('PM2.5 Concentration')
    plt.legend()
    plt.show()
    
    # Scatter plot
    plt.figure(figsize=(8, 6))
    plt.scatter(y_true, y_pred, alpha=0.5)
    plt.plot([y_true.min(), y_true.max()], [y_true.min(), y_true.max()], 'r--', lw=2)
    plt.xlabel('Actual')
    plt.ylabel('Predicted')
    plt.title('Actual vs Predicted')
    plt.show()
```

## Advanced Techniques

### 1. Hyperparameter Tuning
```python
import optuna

def objective(trial):
    # Suggest hyperparameters
    lr = trial.suggest_float('lr', 1e-5, 1e-1, log=True)
    batch_size = trial.suggest_categorical('batch_size', [16, 32, 64])
    units = trial.suggest_int('units', 32, 128)
    
    # Build model with suggested parameters
    model = keras.Sequential([
        keras.layers.Dense(units, activation='relu'),
        keras.layers.Dropout(0.2),
        keras.layers.Dense(1)
    ])
    
    model.compile(optimizer=keras.optimizers.Adam(lr), loss='mse')
    
    # Train and evaluate
    history = model.fit(X_train, y_train, validation_data=(X_val, y_val),
                       epochs=50, batch_size=batch_size, verbose=0)
    
    return min(history.history['val_loss'])

# Run optimization
study = optuna.create_study(direction='minimize')
study.optimize(objective, n_trials=100)
```

### 2. Ensemble Methods
```python
def create_ensemble(models, X_test):
    predictions = []
    for model in models:
        pred = model.predict(X_test)
        predictions.append(pred)
    
    # Average predictions
    ensemble_pred = np.mean(predictions, axis=0)
    return ensemble_pred
```

### 3. Feature Importance
```python
import shap

def analyze_feature_importance(model, X_train):
    explainer = shap.Explainer(model, X_train)
    shap_values = explainer(X_train[:100])
    
    shap.summary_plot(shap_values, X_train[:100])
    shap.waterfall_plot(shap_values[0])
```

## Next Steps

### Immediate Tasks:
1. **Set up environment**: Install Python packages
2. **Get data**: Export your ThingSpeak data to CSV
3. **Start simple**: Begin with linear regression
4. **Iterate**: Try neural networks, then LSTM
5. **Evaluate**: Compare different models

### Learning Path:
1. **Week 1**: Data preprocessing and exploration
2. **Week 2**: Simple models (linear, polynomial)
3. **Week 3**: Neural networks basics
4. **Week 4**: Time series models (LSTM, GRU)
5. **Week 5**: Advanced techniques and deployment

### Resources:
- **Books**: "Hands-On Machine Learning" by Aurélien Géron
- **Courses**: Fast.ai, Coursera ML Course
- **Practice**: Kaggle competitions
- **Community**: Stack Overflow, Reddit r/MachineLearning

### Common Pitfalls to Avoid:
1. **Data Leakage**: Don't use future data to predict past
2. **Overfitting**: Model memorizes training data
3. **Underfitting**: Model too simple for the data
4. **Poor validation**: Always keep test set separate
5. **Ignoring domain knowledge**: Understand air quality science

## Getting Help

When you encounter issues:
1. **Error messages**: Read them carefully, Google exact message
2. **Documentation**: Check official docs (TensorFlow, Pandas)
3. **Stack Overflow**: Search existing questions first
4. **Print statements**: Debug by printing intermediate values
5. **Start small**: Test with tiny datasets first

Remember: Machine Learning is an iterative process. Start simple, make it work, then improve!

---

**Happy Learning!** 🚀

Feel free to ask questions as you work through this guide. Machine Learning for air quality monitoring is a fascinating field with real-world impact!
