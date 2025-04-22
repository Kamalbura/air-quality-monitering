import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import sys

# Standard data path
DEFAULT_DATA_PATH = r'C:\Users\burak\Desktop\iotprojects\air-quality-monitering\data\air_quality_data.csv'

def generate_sample_data(output_path=DEFAULT_DATA_PATH):
    """Generate sample air quality data."""
    print("Generating sample air quality data...")
    np.random.seed(42)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    date_range = pd.date_range(start=start_date, end=end_date, freq='H')
    
    # Generate realistic air quality data with clear field mapping
    data = {
        'created_at': date_range,
        'entry_id': range(1, len(date_range) + 1),
        'field1': np.random.uniform(30, 90, len(date_range)),    # humidity
        'field2': np.random.uniform(15, 35, len(date_range)),    # temperature
        'field3': np.random.uniform(5, 50, len(date_range)),     # pm2.5
        'field4': np.random.uniform(10, 100, len(date_range)),   # pm10
        'latitude': '',
        'longitude': '',
        'elevation': '',
        'status': ''
    }
    
    # Also add alternate column names for compatibility
    data['pm25'] = data['field3']
    data['pm10'] = data['field4']
    data['humidity'] = data['field1']
    data['temperature'] = data['field2']
    
    # Create DataFrame
    df = pd.DataFrame(data)
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Save data to the standard path
    df.to_csv(output_path, index=False)
    
    # Save a backup copy in feeds-data.csv as well
    feeds_path = os.path.join(os.path.dirname(output_path), 'feeds-data.csv')
    df.to_csv(feeds_path, index=False)
    
    print(f"Generated {len(df)} sample records")
    print(f"Saved to {output_path}")
    print(f"Backup saved to {feeds_path}")
    print(f"PM2.5 range: {df['pm25'].min():.2f} to {df['pm25'].max():.2f}")
    print(f"PM10 range: {df['pm10'].min():.2f} to {df['pm10'].max():.2f}")
    
    # Print first few rows for verification
    print("\nSample data (first 3 rows):")
    print(df[['created_at', 'pm25', 'pm10', 'temperature', 'humidity']].head(3))
    
    return len(df)

if __name__ == "__main__":
    try:
        # Use standard path or override if provided
        output_path = DEFAULT_DATA_PATH
        if len(sys.argv) > 1:
            output_path = sys.argv[1]
            
        count = generate_sample_data(output_path)
        print(f"Successfully generated {count} records to {output_path}")
        sys.exit(0)
    except Exception as e:
        print(f"Error generating sample data: {str(e)}")
        sys.exit(1)
