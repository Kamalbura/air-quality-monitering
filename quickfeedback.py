import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

# Load the data
print("📊 LOADING THINGSPEAK DATA")
print("=" * 50)

df = pd.read_csv('feeds.csv')

# 1) Basic shape and columns
print(f"Dataset shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print()

# 2) Peek at data
print("First 5 rows:")
print(df.head())
print()

# 3) Check for nulls
print("Null count per column:")
null_counts = df.isnull().sum()
print(null_counts)
print()

# 4) Data types
print("Data types:")
print(df.dtypes)
print()

# 5) Check if we have timestamp column
timestamp_cols = [col for col in df.columns if 'time' in col.lower() or 'date' in col.lower() or 'created' in col.lower()]
print(f"Potential timestamp columns: {timestamp_cols}")

if timestamp_cols:
    time_col = timestamp_cols[0]
    print(f"Using '{time_col}' as timestamp column")
    
    # Convert to datetime
    df[time_col] = pd.to_datetime(df[time_col])
    print(f"Date range: {df[time_col].min()} to {df[time_col].max()}")
    print(f"Time span: {df[time_col].max() - df[time_col].min()}")
print()

# 6) Air quality fields analysis
air_quality_fields = ['field1', 'field2', 'field3', 'field4']
available_fields = [col for col in air_quality_fields if col in df.columns]

print("AIR QUALITY FIELDS ANALYSIS")
print("=" * 50)
print(f"Available fields: {available_fields}")

if available_fields:
    # Statistical summary
    print("\nStatistical Summary:")
    stats = df[available_fields].describe()
    print(stats.round(2))
    
    # Check data quality
    print("\nData Quality Assessment:")
    for field in available_fields:
        total_count = len(df)
        non_null_count = df[field].notna().sum()
        completeness = (non_null_count / total_count) * 100
        
        if non_null_count > 0:
            min_val = df[field].min()
            max_val = df[field].max()
            mean_val = df[field].mean()
            
            print(f"{field}:")
            print(f"  - Completeness: {completeness:.1f}% ({non_null_count}/{total_count})")
            print(f"  - Range: {min_val:.2f} to {max_val:.2f}")
            print(f"  - Mean: {mean_val:.2f}")
            
            # Detect potential data issues
            if field in ['field1', 'field2'] and (min_val < -50 or max_val > 100):
                print(f"  ⚠️  Unusual range for {field} (possibly temperature/humidity)")
            elif field in ['field3', 'field4'] and (min_val < 0 or max_val > 1000):
                print(f"  ⚠️  Check {field} values (possibly PM2.5/PM10)")
        else:
            print(f"{field}: No data available")
        print()

# 7) Prepare data for LSTM training
print("LSTM TRAINING PREPARATION")
print("=" * 50)

# Check if we have enough data
min_required = 100  # Minimum for meaningful training
lstm_sequence_length = 48  # 48 hours lookback

if len(df) >= min_required:
    print(f"✅ Sufficient data: {len(df)} records (minimum: {min_required})")
    
    # Check for consistent time intervals
    if timestamp_cols:
        df_sorted = df.sort_values(time_col)
        time_diffs = df_sorted[time_col].diff().dropna()
        
        if len(time_diffs) > 0:
            most_common_interval = time_diffs.mode().iloc[0] if len(time_diffs.mode()) > 0 else time_diffs.median()
            print(f"Most common time interval: {most_common_interval}")
            
            # Check for gaps
            large_gaps = time_diffs[time_diffs > most_common_interval * 2]
            print(f"Time gaps detected: {len(large_gaps)} gaps larger than 2x normal interval")
    
    # Clean data for LSTM
    print("\nData cleaning for LSTM:")
    
    # Create feature mapping
    feature_mapping = {
        'field1': 'humidity',
        'field2': 'temperature', 
        'field3': 'pm25',
        'field4': 'pm10'
    }
    
    # Prepare clean dataset
    clean_df = df.copy()
    
    # Rename columns
    for old_name, new_name in feature_mapping.items():
        if old_name in clean_df.columns:
            clean_df[new_name] = clean_df[old_name]
    
    # Add timestamp as index if available
    if timestamp_cols:
        clean_df['timestamp'] = clean_df[timestamp_cols[0]]
        clean_df = clean_df.set_index('timestamp')
        clean_df = clean_df.sort_index()
    
    # Select only LSTM features
    lstm_features = ['humidity', 'temperature', 'pm25', 'pm10']
    available_lstm_features = [f for f in lstm_features if f in clean_df.columns]
    
    if available_lstm_features:
        lstm_df = clean_df[available_lstm_features].copy()
        
        # Remove obvious outliers
        for feature in available_lstm_features:
            if feature in ['humidity']:
                lstm_df[feature] = lstm_df[feature].clip(0, 100)
            elif feature in ['pm25']:
                lstm_df[feature] = lstm_df[feature].clip(0, 500)
            elif feature in ['pm10']:
                lstm_df[feature] = lstm_df[feature].clip(0, 600)
            elif feature in ['temperature']:
                lstm_df[feature] = lstm_df[feature].clip(-40, 60)
        
        # Fill missing values
        lstm_df = lstm_df.fillna(method='ffill').fillna(method='bfill')
        
        # Check final dataset
        print(f"✅ LSTM-ready dataset created:")
        print(f"   - Features: {available_lstm_features}")
        print(f"   - Records: {len(lstm_df)}")
        print(f"   - Complete records: {lstm_df.dropna().shape[0]}")
        print(f"   - Suitable for sequences: {len(lstm_df) >= lstm_sequence_length}")
        
        # Save processed data
        try:
            lstm_df.to_csv('thingspeak_lstm_ready.csv')
            print(f"✅ Saved processed data to 'thingspeak_lstm_ready.csv'")
        except Exception as e:
            print(f"❌ Error saving data: {e}")
        
        # Show sample
        print(f"\nSample of processed data:")
        print(lstm_df.head().round(2))
        
        # Data visualization if matplotlib available
        try:
            plt.figure(figsize=(15, 10))
            
            for i, feature in enumerate(available_lstm_features):
                plt.subplot(2, 2, i+1)
                if len(lstm_df) <= 1000:
                    plt.plot(lstm_df.index, lstm_df[feature], alpha=0.7)
                else:
                    # Sample for plotting if too many points
                    sample_df = lstm_df.sample(1000).sort_index()
                    plt.plot(sample_df.index, sample_df[feature], alpha=0.7)
                
                plt.title(f'{feature.title()} Over Time')
                plt.ylabel(feature.title())
                plt.xticks(rotation=45)
                plt.grid(True, alpha=0.3)
            
            plt.tight_layout()
            plt.savefig('air_quality_data_overview.png', dpi=150, bbox_inches='tight')
            print(f"✅ Saved data visualization to 'air_quality_data_overview.png'")
            plt.show()
            
        except Exception as e:
            print(f"⚠️  Could not create visualization: {e}")
        
    else:
        print(f"❌ No LSTM features available in dataset")
else:
    print(f"❌ Insufficient data: {len(df)} records (minimum: {min_required})")

print("\n🎯 NEXT STEPS:")
print("1. If data looks good, run the LSTM training:")
print("   python python/quick_training_guide.py")
print("2. Or use the enhanced LSTM model:")
print("   python python/lstm_api.py")
print("3. Check the processed data file: 'thingspeak_lstm_ready.csv'")
