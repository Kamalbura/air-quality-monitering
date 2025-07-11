"""
Quick Training Guide for Air Quality LSTM Model
Step-by-step guide to train your first model
"""

import os
import sys
import torch
import pandas as pd
import numpy as np
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Add the project root to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from python.models.enhanced_lstm import EnhancedLSTM
from python.utils.data_preprocessor import DataPreprocessor
from python.utils.model_trainer import ModelTrainer

def find_csv_files():
    """Find CSV files in the project directory"""
    csv_files = []
    for root, dirs, files in os.walk(project_root):
        for file in files:
            if file.endswith('.csv'):
                csv_files.append(os.path.join(root, file))
    return csv_files

def load_real_data():
    """Load real air quality data from CSV files"""
    print("🔍 Looking for CSV files...")
    csv_files = find_csv_files()
    
    if not csv_files:
        print("❌ No CSV files found in project directory")
        return None
    
    print(f"📁 Found {len(csv_files)} CSV file(s):")
    for i, file in enumerate(csv_files):
        file_size = os.path.getsize(file) / (1024 * 1024)  # MB
        print(f"   {i+1}. {os.path.basename(file)} ({file_size:.1f} MB)")
    
    # Try to load the largest CSV file (likely your feeds.csv)
    largest_file = max(csv_files, key=os.path.getsize)
    print(f"\n📊 Loading largest file: {os.path.basename(largest_file)}")
    
    try:
        df = pd.read_csv(largest_file)
        print(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
        print(f"📅 Data columns: {list(df.columns)}")
        
        # Show basic info about the data
        print(f"\n📈 Data overview:")
        print(f"   Shape: {df.shape}")
        if 'timestamp' in df.columns or 'date' in df.columns or 'time' in df.columns:
            time_col = next((col for col in df.columns if 'time' in col.lower() or 'date' in col.lower()), None)
            if time_col:
                print(f"   Time range: {df[time_col].min()} to {df[time_col].max()}")
        
        # Show sample of numeric columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        print(f"   Numeric columns: {list(numeric_cols)}")
        
        return df
        
    except Exception as e:
        print(f"❌ Error loading {largest_file}: {e}")
        return None

def prepare_air_quality_data(df):
    """Prepare air quality data for training"""
    print("\n🔧 Preparing data for training...")
    
    # Common air quality column mappings
    column_mappings = {
        'pm2.5': 'pm25',
        'pm_2_5': 'pm25',
        'pm25': 'pm25',
        'pm10': 'pm10',
        'pm_10': 'pm10',
        'temperature': 'temperature',
        'temp': 'temperature',
        'humidity': 'humidity',
        'humid': 'humidity',
        'rh': 'humidity'
    }
    
    # Find and rename columns
    renamed_df = df.copy()
    found_columns = {}
    
    for original_col in df.columns:
        col_lower = original_col.lower()
        for pattern, target in column_mappings.items():
            if pattern in col_lower:
                found_columns[target] = original_col
                break
    
    print(f"🎯 Found air quality columns:")
    for target, original in found_columns.items():
        print(f"   {target} <- {original}")
    
    # Create final dataset with required columns
    required_columns = ['pm25', 'pm10', 'temperature', 'humidity']
    final_data = {}
    
    for col in required_columns:
        if col in found_columns:
            final_data[col] = df[found_columns[col]].values
        else:
            print(f"⚠️  Missing {col}, creating synthetic data")
            if col == 'pm25':
                final_data[col] = np.random.normal(25, 10, len(df))
            elif col == 'pm10':
                final_data[col] = np.random.normal(40, 15, len(df))
            elif col == 'temperature':
                final_data[col] = np.random.normal(20, 5, len(df))
            elif col == 'humidity':
                final_data[col] = np.random.normal(60, 15, len(df))
    
    # Create target column (next hour PM2.5)
    final_data['target'] = np.roll(final_data['pm25'], -1)
    final_data['target'][-1] = final_data['target'][-2]  # Fill last value
    
    result_df = pd.DataFrame(final_data)
    
    # Remove any invalid values
    result_df = result_df.replace([np.inf, -np.inf], np.nan)
    result_df = result_df.dropna()
    
    print(f"✅ Prepared dataset: {len(result_df)} samples")
    print(f"   Features: {required_columns}")
    print(f"   Target: PM2.5 next hour prediction")
    
    return result_df.values

def step_1_check_environment():
    """Step 1: Check if environment is ready"""
    print("STEP 1: 🔍 CHECKING ENVIRONMENT")
    print("-" * 50)
    
    checks = {
        'pytorch': False,
        'cuda': False,
        'data': False
    }
    
    # Check PyTorch
    try:
        import torch
        print(f"✅ PyTorch {torch.__version__} installed")
        checks['pytorch'] = True
    except ImportError:
        print("❌ PyTorch not installed")
        print("   Install with: pip install torch torchvision torchaudio")
        return False
    
    # Check CUDA
    if torch.cuda.is_available():
        print(f"✅ CUDA available - {torch.cuda.get_device_name(0)}")
        checks['cuda'] = True
    else:
        print("⚠️  CUDA not available - will use CPU")
    
    # Check for data - use your actual data location
    data_files = [
        'data/feeds.csv',           # Your actual data location
        '../data/feeds.csv',
        'feeds.csv',
        'thingspeak_lstm_ready.csv'
    ]
    
    for file_path in data_files:
        if os.path.exists(file_path):
            print(f"✅ Data file found: {file_path}")
            checks['data'] = file_path
            break
    
    if not checks['data']:
        print("⚠️  No data file found. Will create sample data.")
    
    return checks

def step_2_load_or_create_data(data_path=None):
    """Step 2: Load data or create sample data"""
    print("\nSTEP 2: 📊 LOADING DATA")
    print("-" * 50)
    
    # Check for multiple possible data sources - prioritize your actual data
    data_sources = [
        'data/feeds.csv',           # Your actual data file
        data_path,
        'thingspeak_lstm_ready.csv',
        '../data/feeds.csv',
        '../thingspeak_lstm_ready.csv',
        'feeds.csv'
    ]
    
    for source in data_sources:
        if source and os.path.exists(source):
            print(f"Loading data from: {source}")
            try:
                data = pd.read_csv(source)
                
                print(f"Loaded {len(data)} records from {source}")
                print(f"Columns: {list(data.columns)}")
                
                # Standardize column names using working configuration
                column_mapping = {
                    'created_at': 'timestamp',
                    'entry_id': 'entry_id',
                    'field1': 'humidity',      # Working mapping
                    'field2': 'temperature',   # Working mapping
                    'field3': 'pm25',         # Working mapping
                    'field4': 'pm10'          # Working mapping
                }
                
                data.rename(columns=column_mapping, inplace=True)
                
                # Convert timestamp
                if 'timestamp' in data.columns:
                    data['timestamp'] = pd.to_datetime(data['timestamp'])
                
                # Check if we have the required features
                required_features = ['humidity', 'temperature', 'pm25', 'pm10']
                available_features = [f for f in required_features if f in data.columns]
                
                if len(available_features) >= 2:
                    print(f"✅ Found {len(available_features)} required features: {available_features}")
                    
                    # Clean the data
                    for feature in available_features:
                        # Convert to numeric and remove obvious outliers
                        data[feature] = pd.to_numeric(data[feature], errors='coerce')
                        
                        if feature == 'humidity':
                            data[feature] = data[feature].clip(0, 100)
                        elif feature == 'temperature':
                            data[feature] = data[feature].clip(-40, 60)
                        elif feature == 'pm25':
                            data[feature] = data[feature].clip(0, 500)
                        elif feature == 'pm10':
                            data[feature] = data[feature].clip(0, 600)
                    
                    # Remove rows with NaN values
                    data = data.dropna(subset=available_features)
                    
                    if 'timestamp' in data.columns:
                        data = data.set_index('timestamp').sort_index()
                        print(f"   Date range: {data.index.min()} to {data.index.max()}")
                    
                    print(f"✅ Cleaned data: {len(data)} valid records")
                    return data
                else:
                    print(f"⚠️  Insufficient features in {source}. Need at least 2 of: {required_features}")
                    
            except Exception as e:
                print(f"❌ Error loading {source}: {e}")
                continue
    
    print("No suitable real data found. Creating sample data...")
    return create_sample_data()

def create_sample_data():
    """Create realistic sample data"""
    print("Creating 30 days of hourly air quality data...")
    
    # 30 days of hourly data
    n_samples = 30 * 24
    # Fix deprecation warning: use 'h' instead of 'H'
    timestamps = pd.date_range(start='2024-01-01', periods=n_samples, freq='h')
    
    np.random.seed(42)
    hours = np.arange(n_samples) % 24
    days = np.arange(n_samples) // 24
    
    # Realistic patterns
    temperature = 15 + 8 * np.sin(2 * np.pi * hours / 24) + np.random.normal(0, 2, n_samples)
    humidity = 60 + 20 * np.sin(2 * np.pi * hours / 24 + np.pi) + np.random.normal(0, 5, n_samples)
    humidity = np.clip(humidity, 0, 100)
    
    # PM2.5 with rush hour peaks
    pm25_base = 20 + 15 * (np.sin(2 * np.pi * hours / 24 + np.pi/3) ** 2)
    pm25 = pm25_base + np.random.normal(0, 5, n_samples)
    pm25 = np.clip(pm25, 0, 150)
    
    pm10 = pm25 * 1.3 + np.random.normal(0, 3, n_samples)
    pm10 = np.clip(pm10, 0, 200)
    
    data = pd.DataFrame({
        'timestamp': timestamps,
        'temperature': temperature,
        'humidity': humidity,
        'pm25': pm25,
        'pm10': pm10
    })
    
    print(f"✅ Created {len(data)} samples")
    return data

def step_3_initialize_model():
    """Step 3: Initialize the LSTM model"""
    print("\nSTEP 3: 🤖 INITIALIZING MODEL")
    print("-" * 50)
    
    try:
        model = AirQualityLSTM(use_cuda=True)
        print(f"✅ Model initialized")
        print(f"   Device: {model.device}")
        print(f"   Features: {model.features}")
        print(f"   Sequence length: {model.sequence_length}")
        print(f"   Hidden size: {model.hidden_size}")
        return model
    except Exception as e:
        print(f"❌ Model initialization failed: {e}")
        return None

def step_4_train_model(model, data):
    """Step 4: Train the model"""
    print("\nSTEP 4: 🚀 TRAINING MODEL")
    print("-" * 50)
    
    if len(data) < model.sequence_length + 100:
        print(f"❌ Insufficient data. Need at least {model.sequence_length + 100} rows, got {len(data)}")
        return None
    
    print("Training configuration:")
    print(f"   Epochs: 50")
    print(f"   Batch size: 32")
    print(f"   Learning rate: 0.001")
    print(f"   Validation split: 20%")
    
    try:
        print("\n🏃 Starting training...")
        history = model.train(
            data, 
            epochs=50,
            batch_size=32,
            validation_split=0.2,
            verbose=True
        )
        
        print(f"\n✅ Training completed!")
        print(f"   Best epoch: {history['best_epoch'] + 1}")
        print(f"   Best validation loss: {history['best_val_loss']:.6f}")
        print(f"   Final training loss: {history['train_loss'][-1]:.6f}")
        
        return history
    except Exception as e:
        print(f"❌ Training failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def step_5_test_predictions(model, data):
    """Step 5: Test model predictions"""
    print("\nSTEP 5: 🔮 TESTING PREDICTIONS")
    print("-" * 50)
    
    try:
        # Use last part of data for prediction
        test_data = data.tail(model.sequence_length + 10)
        
        print(f"Making 24-hour predictions...")
        predictions = model.predict(
            test_data, 
            n_future=24,
            confidence_interval=True
        )
        
        print(f"✅ Predictions generated!")
        print(f"   Predicted {len(predictions)} hours ahead")
        print(f"   Features predicted: {list(predictions.columns[:4])}")
        
        # Show sample predictions
        print(f"\nSample predictions:")
        print(predictions.head(5).round(2))
        
        return predictions
    except Exception as e:
        print(f"❌ Prediction failed: {e}")
        return None

def step_6_evaluate_model(model, data):
    """Step 6: Evaluate model performance"""
    print("\nSTEP 6: 📊 EVALUATING MODEL")
    print("-" * 50)
    
    try:
        # Use middle portion of data for evaluation
        eval_start = len(data) // 3
        eval_end = 2 * len(data) // 3
        eval_data = data.iloc[eval_start:eval_end]
        
        print(f"Evaluating on {len(eval_data)} samples...")
        metrics = model.evaluate(eval_data, plot_results=False)
        
        print(f"✅ Evaluation completed!")
        print(f"\nModel Performance:")
        for feature, feature_metrics in metrics.items():
            if feature != 'overall':
                print(f"   {feature.upper()}:")
                print(f"     RMSE: {feature_metrics['rmse']:.3f}")
                print(f"     MAE:  {feature_metrics['mae']:.3f}")
                print(f"     R²:   {feature_metrics['r2']:.3f}")
        
        return metrics
    except Exception as e:
        print(f"❌ Evaluation failed: {e}")
        return None

def step_7_save_model(model):
    """Step 7: Save the trained model"""
    print("\nSTEP 7: 💾 SAVING MODEL")
    print("-" * 50)
    
    try:
        model.save_model()
        print(f"✅ Model saved to: {model.model_path}")
        
        # Save training summary
        summary = {
            'timestamp': datetime.now().isoformat(),
            'model_type': 'Enhanced LSTM',
            'device': str(model.device),
            'features': model.features,
            'sequence_length': model.sequence_length,
            'hidden_size': model.hidden_size,
            'pytorch_version': torch.__version__
        }
        
        summary_path = os.path.join(model.model_path, 'training_summary.json')
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"✅ Training summary saved")
        return True
    except Exception as e:
        print(f"❌ Save failed: {e}")
        return False

def main():
    """Main training workflow"""
    print("=" * 80)
    print("🎯 AIR QUALITY LSTM TRAINING GUIDE")
    print("=" * 80)
    print("This script will guide you through training your first LSTM model")
    print("for air quality prediction. Follow each step carefully.")
    
    # Step 1: Check environment
    checks = step_1_check_environment()
    if not checks['pytorch']:
        return False
    
    # Step 2: Load data
    df = load_real_data()
    
    if df is not None and len(df) > 1000:  # Use real data if we have enough
        print(f"🎉 Using real data with {len(df)} entries!")
        data = prepare_air_quality_data(df)
        print(f"✅ Processed {len(data)} samples")
    else:
        print("No suitable real data found. Creating sample data...")
        data = create_sample_data()
    
    if data is None or len(data) < 100:
        print("❌ Insufficient data for training")
        return False
    
    # Step 3: Initialize model
    model = step_3_initialize_model()
    if model is None:
        return False
    
    # Step 4: Train model
    history = step_4_train_model(model, data)
    if history is None:
        return False
    
    # Step 5: Test predictions
    predictions = step_5_test_predictions(model, data)
    
    # Step 6: Evaluate model
    metrics = step_6_evaluate_model(model, data)
    
    # Step 7: Save model
    save_success = step_7_save_model(model)
    
    # Final summary
    print("\n" + "=" * 80)
    print("🎉 TRAINING COMPLETED SUCCESSFULLY!")
    print("=" * 80)
    
    print(f"\n📊 FINAL RESULTS:")
    print(f"   Training samples: {len(data) - model.sequence_length}")
    print(f"   Training epochs: {len(history['train_loss'])}")
    print(f"   Best validation loss: {history['best_val_loss']:.6f}")
    print(f"   Model saved: {'Yes' if save_success else 'No'}")
    
    if metrics:
        overall_rmse = np.mean([metrics[f]['rmse'] for f in ['pm25', 'pm10', 'temperature', 'humidity']])
        print(f"   Average RMSE: {overall_rmse:.3f}")
    
    print(f"\n🚀 NEXT STEPS:")
    print(f"   1. Use the model for real-time predictions")
    print(f"   2. Try different model configurations")
    print(f"   3. Add more features (weather data, etc.)")
    print(f"   4. Deploy the model in production")
    
    return True

if __name__ == "__main__":
    main()
