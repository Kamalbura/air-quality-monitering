import pandas as pd
import numpy as np
import json
import sys
import os
from datetime import datetime
csv_path = r'C:\Users\burak\Desktop\iotprojects\air-quality-monitering\data\air_quality_data.csv'
def analyze_air_quality_data(csv_path, start_date=None, end_date=None):
    """
    Analyze air quality data from CSV file with date range filtering
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
        return result
        
    except Exception as e:
        import traceback
        print(f"Error analyzing data: {str(e)}")
        print(traceback.format_exc())
        result["error"] = f"Error analyzing data: {str(e)}"
        return result

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing CSV file path argument"}))
    else:
        csv_path = sys.argv[1]
        start_date = sys.argv[2] if len(sys.argv) > 2 else None
        end_date = sys.argv[3] if len(sys.argv) > 3 else None
        
        result = analyze_air_quality_data(csv_path, start_date, end_date)
        print(json.dumps(result))
