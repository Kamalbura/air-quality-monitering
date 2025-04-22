import pandas as pd
import numpy as np
import json
import sys
import os
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

# Default data path
DEFAULT_DATA_PATH = r'C:\Users\burak\Desktop\iotprojects\air-quality-monitering\data\air_quality_data.csv'
VIS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public', 'images')

def analyze_air_quality_data(csv_path=DEFAULT_DATA_PATH, start_date=None, end_date=None):
    """
    Analyze air quality data from CSV file with date range filtering
    
    Args:
        csv_path (str): Path to the CSV file
        start_date (str): Optional start date in YYYY-MM-DD format
        end_date (str): Optional end date in YYYY-MM-DD format
        
    Returns:
        dict: Analysis results
    """
    result = {
        "average_pm25": 0,
        "average_pm10": 0,
        "average_temperature": 0,
        "average_humidity": 0,
        "max_pm25": 0,
        "max_pm10": 0,
        "min_pm25": 0,
        "min_pm10": 0,
        "record_count": 0,
        "date_range": {
            "start": None,
            "end": None
        }
    }
    
    # Check if file exists
    if not os.path.isfile(csv_path):
        result["error"] = f"File not found: {csv_path}"
        return result
    
    try:
        print(f"Reading CSV file: {csv_path}")
        
        # Read CSV file with explicit low_memory setting
        df = pd.read_csv(csv_path, low_memory=False)
        
        # Check if we have any data
        if len(df) == 0:
            result["error"] = "No data found in CSV file"
            return result
        
        # Print column names for debugging
        print(f"CSV columns: {df.columns.tolist()}")
        
        # Convert timestamp and filter by date range if provided
        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
        
        if start_date:
            start = pd.to_datetime(start_date)
            df = df[df['created_at'] >= start]
            print(f"Filtered data after {start}, remaining rows: {len(df)}")
            
        if end_date:
            end = pd.to_datetime(end_date)
            df = df[df['created_at'] <= end]
            print(f"Filtered data before {end}, remaining rows: {len(df)}")
        
        # Check if we still have data after filtering
        if len(df) == 0:
            result["error"] = "No data found for the specified date range"
            return result
        
        # Determine which columns to use for PM2.5 and PM10
        has_pm25 = 'pm25' in df.columns
        has_pm10 = 'pm10' in df.columns
        has_field3 = 'field3' in df.columns
        has_field4 = 'field4' in df.columns
        
        pm25_col = 'pm25' if has_pm25 else ('field3' if has_field3 else None)
        pm10_col = 'pm10' if has_pm10 else ('field4' if has_field4 else None)
        
        print(f"Using column {pm25_col} for PM2.5 and {pm10_col} for PM10")
        
        # Same for temperature and humidity
        has_temp = 'temperature' in df.columns
        has_humidity = 'humidity' in df.columns
        has_field1 = 'field1' in df.columns
        has_field2 = 'field2' in df.columns
        
        temp_col = 'temperature' if has_temp else ('field2' if has_field2 else None)
        humidity_col = 'humidity' if has_humidity else ('field1' if has_field1 else None)
        
        # Verify that we have the necessary columns
        if not pm25_col or not pm10_col:
            result["error"] = "Could not find PM2.5 or PM10 columns in the data"
            print(f"ERROR: {result['error']}")
            return result
        
        # Convert to numeric, coercing errors to NaN
        if pm25_col:
            df[pm25_col] = pd.to_numeric(df[pm25_col], errors='coerce')
        if pm10_col:
            df[pm10_col] = pd.to_numeric(df[pm10_col], errors='coerce')
        if temp_col:
            df[temp_col] = pd.to_numeric(df[temp_col], errors='coerce')
        if humidity_col:
            df[humidity_col] = pd.to_numeric(df[humidity_col], errors='coerce')
        
        # Calculate statistics with more robust error handling
        if pm25_col:
            valid_pm25 = df[pm25_col].dropna()
            if len(valid_pm25) > 0:
                result["average_pm25"] = float(valid_pm25.mean())
                result["max_pm25"] = float(valid_pm25.max())
                result["min_pm25"] = float(valid_pm25.min())
                print(f"PM2.5 stats: avg={result['average_pm25']:.2f}, max={result['max_pm25']:.2f}, min={result['min_pm25']:.2f}")
            else:
                print("Warning: No valid PM2.5 values found")
        
        if pm10_col:
            valid_pm10 = df[pm10_col].dropna()
            if len(valid_pm10) > 0:
                result["average_pm10"] = float(valid_pm10.mean())
                result["max_pm10"] = float(valid_pm10.max())
                result["min_pm10"] = float(valid_pm10.min())
                print(f"PM10 stats: avg={result['average_pm10']:.2f}, max={result['max_pm10']:.2f}, min={result['min_pm10']:.2f}")
            else:
                print("Warning: No valid PM10 values found")
        
        if temp_col:
            valid_temp = df[temp_col].dropna()
            if len(valid_temp) > 0:
                result["average_temperature"] = float(valid_temp.mean())
                print(f"Temperature avg={result['average_temperature']:.2f}")
            else:
                print("Warning: No valid temperature values found")
        
        if humidity_col:
            valid_humidity = df[humidity_col].dropna()
            if len(valid_humidity) > 0:
                result["average_humidity"] = float(valid_humidity.mean())
                print(f"Humidity avg={result['average_humidity']:.2f}")
            else:
                print("Warning: No valid humidity values found")
        
        # Record count and date range
        result["record_count"] = len(df)
        
        if len(df) > 0:
            result["date_range"]["start"] = df['created_at'].min().strftime('%Y-%m-%d %H:%M:%S')
            result["date_range"]["end"] = df['created_at'].max().strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"Analysis complete: {result['record_count']} records processed")
        
        # Create visualizations
        try:
            create_time_series_plot(df, pm25_col, pm10_col)
            create_trend_analysis(df, pm25_col)
        except Exception as viz_err:
            print(f"Warning: Visualization creation failed: {str(viz_err)}")
        
        return result
        
    except Exception as e:
        import traceback
        print(f"Error analyzing data: {str(e)}")
        print(traceback.format_exc())
        result["error"] = f"Error analyzing data: {str(e)}"
        return result

def create_time_series_plot(data_clean, pm25_col, pm10_col):
    """Create time series plot of air quality data"""
    try:
        # Ensure output directory exists
        os.makedirs(VIS_DIR, exist_ok=True)
        
        # Create a time series plot
        plt.figure(figsize=(14, 7))
        
        # Plot PM2.5 and PM10
        plt.plot(data_clean['created_at'], data_clean[pm25_col], label='PM2.5', color='blue', alpha=0.7)
        plt.plot(data_clean['created_at'], data_clean[pm10_col], label='PM10', color='red', alpha=0.7)
        
        # Add WHO guideline lines
        plt.axhline(y=10, color='blue', linestyle='--', alpha=0.7, label='WHO PM2.5 guideline (10 μg/m³)')
        plt.axhline(y=20, color='red', linestyle='--', alpha=0.7, label='WHO PM10 guideline (20 μg/m³)')
        
        # Format the plot
        plt.xlabel('Time' if 'timestamp' in data_clean.columns else 'Sample Index')
        plt.ylabel('Measurements')
        plt.title('Air Quality and Environmental Data Over Time')
        plt.legend()
        
        # Save the figure with tight layout and high dpi
        plt.tight_layout()
        plt.savefig(os.path.join(VIS_DIR, 'time_series.png'), dpi=150)
        print(f"Time series plot saved to {os.path.join(VIS_DIR, 'time_series.png')}")
            
    except Exception as e:
        print(f"Error creating time series plot: {str(e)}")
        import traceback
        traceback.print_exc()

def create_trend_analysis(data_clean, pm25_col, window_size=24):
    """Create rolling mean trend analysis"""
    try:
        # Ensure output directory exists
        os.makedirs(VIS_DIR, exist_ok=True)
        
        # Calculate rolling mean
        plot_data = data_clean.copy()
        plot_data['PM2.5'] = plot_data[pm25_col]
        plot_data['PM2.5_Rolling'] = plot_data[pm25_col].rolling(window=window_size).mean()
        
        # Create trend plot
        plt.figure(figsize=(14, 7))
        plt.plot(plot_data.index, plot_data['PM2.5'], alpha=0.5, label='PM2.5')
        plt.plot(plot_data.index, plot_data['PM2.5_Rolling'], 
                label=f'Rolling Mean (window={window_size})', color='blue')
        plt.xlabel('Time')
        plt.ylabel('PM2.5')
        plt.title('PM2.5 Levels and Rolling Mean Trend')
        plt.legend()
        
        plt.tight_layout()
        plt.savefig(os.path.join(VIS_DIR, 'pm25_trend.png'), dpi=150)
        print(f"PM2.5 trend plot saved to {os.path.join(VIS_DIR, 'pm25_trend.png')}")
            
    except Exception as e:
        print(f"Error creating trend analysis: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Default to standard data path if not provided
        csv_path = DEFAULT_DATA_PATH
        print(f"Using default CSV path: {csv_path}")
    else:
        csv_path = sys.argv[1]
        
    start_date = sys.argv[2] if len(sys.argv) > 2 else None
    end_date = sys.argv[3] if len(sys.argv) > 3 else None
    
    print(f"Starting analysis with: CSV={csv_path}, Start={start_date}, End={end_date}")
    result = analyze_air_quality_data(csv_path, start_date, end_date)
    print(json.dumps(result))
