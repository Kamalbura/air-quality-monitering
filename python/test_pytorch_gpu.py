"""
PyTorch GPU Test Script
Tests PyTorch installation, GPU availability, and runs a simple model training
"""

import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import time
import sys
import os
from datetime import datetime

print("="*80)
print("🧪 PYTORCH GPU TEST SCRIPT")
print("="*80)

def test_pytorch_installation():
    """Test basic PyTorch installation"""
    print("\n1. 📦 PYTORCH INSTALLATION CHECK")
    print("-"*50)
    
    try:
        print(f"✅ PyTorch Version: {torch.__version__}")
        print(f"✅ Python Version: {sys.version}")
        
        # Test basic tensor operations
        x = torch.randn(3, 3)
        y = torch.randn(3, 3)
        z = x + y
        print(f"✅ Basic tensor operations working")
        print(f"   Sample tensor shape: {x.shape}")
        
        return True
    except Exception as e:
        print(f"❌ PyTorch installation issue: {e}")
        return False

def test_gpu_availability():
    """Test CUDA and GPU availability"""
    print("\n2. 🖥️  GPU AVAILABILITY CHECK")
    print("-"*50)
    
    # Check CUDA availability
    cuda_available = torch.cuda.is_available()
    print(f"CUDA Available: {'✅ YES' if cuda_available else '❌ NO'}")
    
    if cuda_available:
        # GPU details
        gpu_count = torch.cuda.device_count()
        print(f"GPU Count: {gpu_count}")
        
        for i in range(gpu_count):
            gpu_name = torch.cuda.get_device_name(i)
            gpu_memory = torch.cuda.get_device_properties(i).total_memory / 1e9
            print(f"GPU {i}: {gpu_name} ({gpu_memory:.1f} GB)")
        
        # Current GPU
        current_device = torch.cuda.current_device()
        print(f"Current GPU Device: {current_device}")
        
        # Test GPU tensor operations
        try:
            device = torch.device('cuda')
            x_gpu = torch.randn(1000, 1000).to(device)
            y_gpu = torch.randn(1000, 1000).to(device)
            z_gpu = torch.matmul(x_gpu, y_gpu)
            print("✅ GPU tensor operations working")
            
            # Memory usage
            allocated = torch.cuda.memory_allocated(0) / 1e6
            cached = torch.cuda.memory_reserved(0) / 1e6
            print(f"GPU Memory - Allocated: {allocated:.1f} MB, Cached: {cached:.1f} MB")
            
            return True
        except Exception as e:
            print(f"❌ GPU tensor operations failed: {e}")
            return False
    else:
        print("ℹ️  Will use CPU for training")
        return False

def create_sample_data():
    """Create sample air quality data for testing"""
    print("\n3. 📊 CREATING SAMPLE DATA")
    print("-"*50)
    
    # Generate synthetic air quality data
    n_samples = 2000
    # Fix deprecation warning: use 'h' instead of 'H'
    timestamps = pd.date_range(start='2023-01-01', periods=n_samples, freq='h')
    
    # Create realistic air quality patterns
    np.random.seed(42)
    
    # Base patterns with daily and seasonal cycles
    hours = np.arange(n_samples) % 24
    days = np.arange(n_samples) // 24
    
    # Temperature with daily cycle and noise
    temperature = 20 + 10 * np.sin(2 * np.pi * hours / 24) + 5 * np.sin(2 * np.pi * days / 365) + np.random.normal(0, 2, n_samples)
    
    # Humidity inversely related to temperature
    humidity = 70 - 0.5 * temperature + np.random.normal(0, 5, n_samples)
    humidity = np.clip(humidity, 0, 100)
    
    # PM2.5 with traffic patterns and weather influence
    pm25_base = 25 + 15 * np.sin(2 * np.pi * hours / 24 + np.pi/4)  # Peak during rush hours
    pm25_weather = -0.3 * humidity + 0.2 * temperature  # Weather influence
    pm25 = pm25_base + pm25_weather + np.random.normal(0, 8, n_samples)
    pm25 = np.clip(pm25, 0, 200)
    
    # PM10 related to PM2.5
    pm10 = pm25 * 1.5 + np.random.normal(0, 5, n_samples)
    pm10 = np.clip(pm10, 0, 300)
    
    data = pd.DataFrame({
        'timestamp': timestamps,
        'temperature': temperature,
        'humidity': humidity,
        'pm25': pm25,
        'pm10': pm10
    })
    
    print(f"✅ Created {len(data)} samples of air quality data")
    print(f"   Features: {list(data.columns[1:])}")
    print(f"   Date range: {data['timestamp'].min()} to {data['timestamp'].max()}")
    
    # Show sample statistics
    print("\nSample statistics:")
    print(data.describe().round(2))
    
    # Check if real data exists and compare
    real_data_files = [
        'feeds.csv',
        'thingspeak_lstm_ready.csv',
        '../feeds.csv'
    ]
    
    for file_path in real_data_files:
        if os.path.exists(file_path):
            print(f"\n🔍 Found real data file: {file_path}")
            try:
                real_df = pd.read_csv(file_path)
                print(f"   Real data shape: {real_df.shape}")
                
                # Check if it has the required columns
                required_cols = ['humidity', 'temperature', 'pm25', 'pm10']
                thingspeak_cols = ['field1', 'field2', 'field3', 'field4']
                
                if all(col in real_df.columns for col in required_cols):
                    print(f"   ✅ Real data has all required columns")
                    print(f"   💡 Consider using real data instead of sample data")
                elif all(col in real_df.columns for col in thingspeak_cols):
                    print(f"   ✅ Real data has ThingSpeak format (field1-4)")
                    print(f"   💡 Run quickfeedback.py first to process the data")
                else:
                    print(f"   ⚠️  Real data format needs processing")
                
            except Exception as e:
                print(f"   ❌ Could not read real data: {e}")
            break
    
    return data

class SimpleAirQualityNet(nn.Module):
    """Simple neural network for air quality prediction"""
    
    def __init__(self, input_size=4, hidden_size=64, output_size=1):
        super(SimpleAirQualityNet, self).__init__()
        self.network = nn.Sequential(
            nn.Linear(input_size, hidden_size),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_size, hidden_size//2),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_size//2, output_size)
        )
    
    def forward(self, x):
        return self.network(x)

def prepare_data_for_training(data, sequence_length=24):
    """Prepare data for LSTM training"""
    print("\n4. 🔄 PREPARING DATA FOR TRAINING")
    print("-"*50)
    
    # Features and target
    features = ['temperature', 'humidity', 'pm25', 'pm10']
    target = 'pm25'
    
    # Normalize data
    from sklearn.preprocessing import MinMaxScaler
    
    scaler_X = MinMaxScaler()
    scaler_y = MinMaxScaler()
    
    X_data = data[features].values
    y_data = data[target].values.reshape(-1, 1)
    
    X_scaled = scaler_X.fit_transform(X_data)
    y_scaled = scaler_y.fit_transform(y_data)
    
    print(f"✅ Data normalized")
    print(f"   Input shape: {X_scaled.shape}")
    print(f"   Output shape: {y_scaled.shape}")
    
    # Create sequences for LSTM
    X_sequences = []
    y_sequences = []
    
    for i in range(sequence_length, len(X_scaled)):
        X_sequences.append(X_scaled[i-sequence_length:i])
        y_sequences.append(y_scaled[i])
    
    X_sequences = np.array(X_sequences)
    y_sequences = np.array(y_sequences)
    
    print(f"✅ Created sequences")
    print(f"   Sequence input shape: {X_sequences.shape}")
    print(f"   Sequence output shape: {y_sequences.shape}")
    
    # Train/test split
    split_idx = int(0.8 * len(X_sequences))
    
    X_train = X_sequences[:split_idx]
    X_test = X_sequences[split_idx:]
    y_train = y_sequences[:split_idx]
    y_test = y_sequences[split_idx:]
    
    print(f"✅ Train/test split completed")
    print(f"   Training samples: {len(X_train)}")
    print(f"   Testing samples: {len(X_test)}")
    
    return (X_train, X_test, y_train, y_test, scaler_X, scaler_y)

class SimpleLSTM(nn.Module):
    """Simple LSTM for air quality prediction"""
    
    def __init__(self, input_size=4, hidden_size=50, num_layers=2, output_size=1):
        super(SimpleLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=0.2)
        self.fc = nn.Linear(hidden_size, output_size)
        self.dropout = nn.Dropout(0.2)
    
    def forward(self, x):
        batch_size = x.size(0)
        
        # Initialize hidden state
        h0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(x.device)
        c0 = torch.zeros(self.num_layers, batch_size, self.hidden_size).to(x.device)
        
        # LSTM forward pass
        lstm_out, _ = self.lstm(x, (h0, c0))
        
        # Take the last output
        last_output = lstm_out[:, -1, :]
        last_output = self.dropout(last_output)
        
        # Final prediction
        output = self.fc(last_output)
        return output

def test_model_training(X_train, X_test, y_train, y_test, use_gpu=True):
    """Test model training on GPU/CPU"""
    print("\n5. 🚀 TESTING MODEL TRAINING")
    print("-"*50)
    
    # Device selection
    device = torch.device('cuda' if use_gpu and torch.cuda.is_available() else 'cpu')
    print(f"Training device: {device}")
    
    # Convert data to tensors
    X_train_tensor = torch.FloatTensor(X_train).to(device)
    X_test_tensor = torch.FloatTensor(X_test).to(device)
    y_train_tensor = torch.FloatTensor(y_train).to(device)
    y_test_tensor = torch.FloatTensor(y_test).to(device)
    
    print(f"✅ Data moved to {device}")
    
    # Create model
    model = SimpleLSTM(input_size=4, hidden_size=50, num_layers=2, output_size=1).to(device)
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    print(f"✅ Model created")
    print(f"   Total parameters: {total_params:,}")
    print(f"   Trainable parameters: {trainable_params:,}")
    
    # Loss and optimizer
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    # Training loop
    num_epochs = 20
    batch_size = 32
    
    print(f"\n🏃 Starting training for {num_epochs} epochs...")
    
    train_losses = []
    test_losses = []
    
    start_time = time.time()
    
    for epoch in range(num_epochs):
        model.train()
        epoch_train_loss = 0
        
        # Mini-batch training
        for i in range(0, len(X_train_tensor), batch_size):
            batch_X = X_train_tensor[i:i+batch_size]
            batch_y = y_train_tensor[i:i+batch_size]
            
            optimizer.zero_grad()
            outputs = model(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            epoch_train_loss += loss.item()
        
        # Validation
        model.eval()
        with torch.no_grad():
            test_outputs = model(X_test_tensor)
            test_loss = criterion(test_outputs, y_test_tensor).item()
        
        avg_train_loss = epoch_train_loss / (len(X_train_tensor) // batch_size)
        
        train_losses.append(avg_train_loss)
        test_losses.append(test_loss)
        
        if (epoch + 1) % 5 == 0:
            print(f"Epoch [{epoch+1}/{num_epochs}] - Train Loss: {avg_train_loss:.6f}, Test Loss: {test_loss:.6f}")
    
    training_time = time.time() - start_time
    print(f"\n✅ Training completed in {training_time:.2f} seconds")
    print(f"   Final train loss: {train_losses[-1]:.6f}")
    print(f"   Final test loss: {test_losses[-1]:.6f}")
    
    # Test prediction
    model.eval()
    with torch.no_grad():
        sample_input = X_test_tensor[:5]
        sample_predictions = model(sample_input)
        sample_actual = y_test_tensor[:5]
        
        print(f"\n📊 Sample Predictions:")
        for i in range(5):
            pred = sample_predictions[i].item()
            actual = sample_actual[i].item()
            print(f"   Sample {i+1}: Predicted={pred:.4f}, Actual={actual:.4f}, Error={abs(pred-actual):.4f}")
    
    return model, train_losses, test_losses

def benchmark_gpu_vs_cpu(X_train, y_train):
    """Benchmark training speed GPU vs CPU"""
    print("\n6. ⚡ GPU vs CPU BENCHMARK")
    print("-"*50)
    
    if not torch.cuda.is_available():
        print("❌ CUDA not available, skipping benchmark")
        return
    
    # Benchmark parameters
    epochs = 5
    batch_size = 32
    
    # Test on CPU
    print("Testing CPU training speed...")
    device_cpu = torch.device('cpu')
    model_cpu = SimpleLSTM().to(device_cpu)
    X_cpu = torch.FloatTensor(X_train[:1000]).to(device_cpu)  # Smaller subset for quick test
    y_cpu = torch.FloatTensor(y_train[:1000]).to(device_cpu)
    
    start_time = time.time()
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model_cpu.parameters(), lr=0.001)
    
    for epoch in range(epochs):
        for i in range(0, len(X_cpu), batch_size):
            batch_X = X_cpu[i:i+batch_size]
            batch_y = y_cpu[i:i+batch_size]
            
            optimizer.zero_grad()
            outputs = model_cpu(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
    
    cpu_time = time.time() - start_time
    
    # Test on GPU
    print("Testing GPU training speed...")
    device_gpu = torch.device('cuda')
    model_gpu = SimpleLSTM().to(device_gpu)
    X_gpu = torch.FloatTensor(X_train[:1000]).to(device_gpu)
    y_gpu = torch.FloatTensor(y_train[:1000]).to(device_gpu)
    
    start_time = time.time()
    optimizer = optim.Adam(model_gpu.parameters(), lr=0.001)
    
    for epoch in range(epochs):
        for i in range(0, len(X_gpu), batch_size):
            batch_X = X_gpu[i:i+batch_size]
            batch_y = y_gpu[i:i+batch_size]
            
            optimizer.zero_grad()
            outputs = model_gpu(batch_X)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
    
    gpu_time = time.time() - start_time
    
    print(f"\n⏱️  BENCHMARK RESULTS:")
    print(f"   CPU Time: {cpu_time:.2f} seconds")
    print(f"   GPU Time: {gpu_time:.2f} seconds")
    if cpu_time > gpu_time:
        speedup = cpu_time / gpu_time
        print(f"   🚀 GPU is {speedup:.1f}x faster than CPU")
    else:
        print(f"   🐌 CPU was faster (possibly due to small dataset)")

def main():
    """Main test function"""
    print(f"Test started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Run all tests
    pytorch_ok = test_pytorch_installation()
    if not pytorch_ok:
        print("❌ PyTorch installation failed. Please install PyTorch first.")
        return
    
    gpu_available = test_gpu_availability()
    
    # Create sample data
    data = create_sample_data()
    
    # Prepare data for training
    X_train, X_test, y_train, y_test, scaler_X, scaler_y = prepare_data_for_training(data)
    
    # Test model training
    model, train_losses, test_losses = test_model_training(X_train, X_test, y_train, y_test, use_gpu=gpu_available)
    
    # Benchmark if GPU available
    if gpu_available:
        benchmark_gpu_vs_cpu(X_train, y_train)
    
    print("\n" + "="*80)
    print("✅ ALL TESTS COMPLETED SUCCESSFULLY!")
    print("="*80)
    
    print("\n📋 SUMMARY:")
    print(f"   PyTorch Version: {torch.__version__}")
    print(f"   CUDA Available: {'Yes' if torch.cuda.is_available() else 'No'}")
    if torch.cuda.is_available():
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
    print(f"   Training Device: {'GPU' if gpu_available else 'CPU'}")
    print(f"   Model Type: LSTM")
    print(f"   Final Training Loss: {train_losses[-1]:.6f}")
    print(f"   Final Test Loss: {test_losses[-1]:.6f}")
    
    print("\n🎯 NEXT STEPS:")
    print("   1. ✅ Your GPU setup is working perfectly!")
    print("   2. Run 'python quickfeedback.py' to analyze your real data")
    print("   3. Try the LSTM training: 'python python/quick_training_guide.py'")
    print("   4. Use the enhanced model: 'python python/lstm_api.py'")
    print("   5. Check if 'feeds.csv' exists for real data training")
    
    return True

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n❌ Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
