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

def analyze_air_quality_data_extended(csv_path=DEFAULT_DATA_PATH, start_date=None, end_date=None):
    """
    Extended analysis of air quality data with additional visualizations
    
    Args:
        csv_path (str): Path to the CSV file
        start_date (str): Optional start date in YYYY-MM-DD format
        end_date (str): Optional end date in YYYY-MM-DD format
        
    Returns:
        dict: Analysis results with additional metrics
    """
    # Import the main analysis function from analisis.py
    try:
        # First run the basic analysis
        from analisis import analyze_air_quality_data
        result = analyze_air_quality_data(csv_path, start_date, end_date)
        
        # If basic analysis had an error, return it
        if "error" in result:
            return result
        
        # Add extended analysis
        df = pd.read_csv(csv_path, low_memory=False)
        
        # Convert timestamp and filter by date range
        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
        
        if start_date:
            start = pd.to_datetime(start_date)
            df = df[df['created_at'] >= start]
            
        if end_date:
            end = pd.to_datetime(end_date)
            df = df[df['created_at'] <= end]
        
        # Determine column names
        pm25_col = 'pm25' if 'pm25' in df.columns else 'field3'
        pm10_col = 'pm10' if 'pm10' in df.columns else 'field4'
        temp_col = 'temperature' if 'temperature' in df.columns else 'field2'
        humidity_col = 'humidity' if 'humidity' in df.columns else 'field1'
        
        # Convert to numeric values
        df[pm25_col] = pd.to_numeric(df[pm25_col], errors='coerce')
        df[pm10_col] = pd.to_numeric(df[pm10_col], errors='coerce')
        df[temp_col] = pd.to_numeric(df[temp_col], errors='coerce')
        df[humidity_col] = pd.to_numeric(df[humidity_col], errors='coerce')
        
        # Add hourly patterns
        result["hourly_patterns"] = calculate_hourly_patterns(df, pm25_col, pm10_col)
        
        # Add correlation analysis
        correlations = calculate_correlations(df, pm25_col, pm10_col, temp_col, humidity_col)
        result["correlations"] = correlations
        
        # Add daily analytics
        result["daily_patterns"] = calculate_daily_patterns(df, pm25_col, pm10_col)
        
        # Add data quality information
        result["data_quality"] = assess_data_quality(df, pm25_col, pm10_col, temp_col, humidity_col)
        
        # Generate additional visualizations
        try:
            create_scatter_plots(df, pm25_col, pm10_col, temp_col, humidity_col)
            create_daily_heatmap(df, pm25_col, pm10_col)
            create_histograms(df, pm25_col, pm10_col, temp_col, humidity_col)
            create_correlation_heatmap(df, pm25_col, pm10_col, temp_col, humidity_col)
        except Exception as viz_err:
            print(f"Warning: Extended visualizations failed: {str(viz_err)}")
        
        # Add analysis version marker
        result["analysis_version"] = 2
        
        return result
        
    except Exception as e:
        import traceback
        print(f"Error in extended analysis: {str(e)}")
        print(traceback.format_exc())
        return {
            "error": f"Error in extended analysis: {str(e)}",
            "average_pm25": 0,
            "average_pm10": 0,
            "average_temperature": 0,
            "average_humidity": 0,
            "max_pm25": 0,
            "max_pm10": 0,
            "min_pm25": 0,
            "min_pm10": 0,
            "analysis_version": 2
        }

def calculate_hourly_patterns(df, pm25_col, pm10_col):
    """Calculate hourly patterns of air quality data"""
    # Extract hour from timestamp and calculate hourly averages
    df['hour'] = df['created_at'].dt.hour
    
    hourly_avg = df.groupby('hour')[[pm25_col, pm10_col]].mean().reset_index()
    
    # Convert to list format for JSON serialization
    hourly_data = {
        "hours": hourly_avg['hour'].tolist(),
        "pm25": hourly_avg[pm25_col].tolist(),
        "pm10": hourly_avg[pm10_col].tolist()
    }
    
    return hourly_data

def calculate_daily_patterns(df, pm25_col, pm10_col):
    """Calculate daily patterns of air quality data"""
    # Extract day of week from timestamp and calculate daily averages
    df['day'] = df['created_at'].dt.dayofweek
    
    daily_avg = df.groupby('day')[[pm25_col, pm10_col]].mean().reset_index()
    
    # Convert to list format for JSON serialization
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    daily_data = {
        "days": [days[d] for d in daily_avg['day']],
        "pm25": daily_avg[pm25_col].tolist(),
        "pm10": daily_avg[pm10_col].tolist()
    }
    
    return daily_data

def calculate_correlations(df, pm25_col, pm10_col, temp_col, humidity_col):
    """Calculate correlations between air quality and environmental factors"""
    # Create correlation calculations
    correlations = {
        "pm25_temp": df[[pm25_col, temp_col]].corr().iloc[0, 1],
        "pm25_humidity": df[[pm25_col, humidity_col]].corr().iloc[0, 1],
        "pm10_temp": df[[pm10_col, temp_col]].corr().iloc[0, 1],
        "pm10_humidity": df[[pm10_col, humidity_col]].corr().iloc[0, 1],
        "pm25_pm10": df[[pm25_col, pm10_col]].corr().iloc[0, 1]
    }
    
    return {k: round(float(v), 3) for k, v in correlations.items()}

def assess_data_quality(df, pm25_col, pm10_col, temp_col, humidity_col):
    """Assess data quality metrics"""
    total_records = len(df)
    
    # Calculate completeness
    completeness = {
        "pm25": (df[pm25_col].notna().sum() / total_records) * 100,
        "pm10": (df[pm10_col].notna().sum() / total_records) * 100,
        "temperature": (df[temp_col].notna().sum() / total_records) * 100,
        "humidity": (df[humidity_col].notna().sum() / total_records) * 100
    }
    
    # Check for outliers (values more than 3 standard deviations from mean)
    pm25_mean = df[pm25_col].mean()
    pm25_std = df[pm25_col].std()
    pm10_mean = df[pm10_col].mean()
    pm10_std = df[pm10_col].std()
    
    outliers = {
        "pm25": len(df[abs(df[pm25_col] - pm25_mean) > 3 * pm25_std]) / total_records * 100,
        "pm10": len(df[abs(df[pm10_col] - pm10_mean) > 3 * pm10_std]) / total_records * 100
    }
    
    return {
        "completeness": {k: round(float(v), 2) for k, v in completeness.items()},
        "outliers": {k: round(float(v), 2) for k, v in outliers.items()},
        "record_count": total_records
    }

def create_scatter_plots(df, pm25_col, pm10_col, temp_col, humidity_col):
    """Create scatter plots of PM2.5/PM10 vs temperature/humidity"""
    # Ensure output directory exists
    os.makedirs(VIS_DIR, exist_ok=True)
    
    # PM2.5 vs Temperature
    plt.figure(figsize=(10, 6))
    sns.scatterplot(x=df[temp_col], y=df[pm25_col], alpha=0.5)
    plt.title('PM2.5 vs Temperature')
    plt.xlabel('Temperature')
    plt.ylabel('PM2.5')
    plt.tight_layout()
    plt.savefig(os.path.join(VIS_DIR, 'scatter_temperature_pm25.png'), dpi=150)
    plt.close()
    
    # PM2.5 vs Humidity
    plt.figure(figsize=(10, 6))
    sns.scatterplot(x=df[humidity_col], y=df[pm25_col], alpha=0.5)
    plt.title('PM2.5 vs Humidity')
    plt.xlabel('Humidity')
    plt.ylabel('PM2.5')
    plt.tight_layout()
    plt.savefig(os.path.join(VIS_DIR, 'scatter_humidity_pm25.png'), dpi=150)
    plt.close()
    
    # PM10 vs Temperature
    plt.figure(figsize=(10, 6))
    sns.scatterplot(x=df[temp_col], y=df[pm10_col], alpha=0.5)
    plt.title('PM10 vs Temperature')
    plt.xlabel('Temperature')
    plt.ylabel('PM10')
    plt.tight_layout()
    plt.savefig(os.path.join(VIS_DIR, 'scatter_temperature_pm10.png'), dpi=150)
    plt.close()
    
    # PM10 vs Humidity
    plt.figure(figsize=(10, 6))
    sns.scatterplot(x=df[humidity_col], y=df[pm10_col], alpha=0.5)
    plt.title('PM10 vs Humidity')
    plt.xlabel('Humidity')
    plt.ylabel('PM10')
    plt.tight_layout()
    plt.savefig(os.path.join(VIS_DIR, 'scatter_humidity_pm10.png'), dpi=150)
    plt.close()
    
    print("Scatter plots created successfully")

def create_daily_heatmap(df, pm25_col, pm10_col):
    """Create heatmap of air quality by day of week and hour"""
    # Ensure output directory exists
    os.makedirs(VIS_DIR, exist_ok=True)
    
    # Extract day of week and hour
    df['dayofweek'] = df['created_at'].dt.dayofweek
    df['hour'] = df['created_at'].dt.hour
    
    # Create pivot table for heatmap
    heatmap_data = df.pivot_table(index='dayofweek', columns='hour', 
                                  values=pm25_col, aggfunc='mean')
    
    # Create day names for y-axis
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    # Plot heatmap
    plt.figure(figsize=(12, 8))
    ax = plt.subplot(1, 1, 1)
    sns.heatmap(heatmap_data, cmap='YlOrRd', annot=False, fmt=".1f", linewidths=.5, ax=ax)
    
    # Format plot
    ax.set_title('PM2.5 Levels by Day of Week and Hour', fontsize=16)
    ax.set_ylabel('Day of Week', fontsize=12)
    ax.set_xlabel('Hour of Day (24h)', fontsize=12)
    ax.set_yticklabels(day_names)
    
    # Tight layout
    plt.tight_layout()
    
    # Save the figure
    plt.savefig(os.path.join(VIS_DIR, 'heatmap.png'), dpi=150)
    plt.close()
    
    print("Daily heatmap created successfully")

def create_histograms(df, pm25_col, pm10_col, temp_col, humidity_col):
    """Create histograms of air quality data"""
    # Ensure output directory exists
    os.makedirs(VIS_DIR, exist_ok=True)
    
    # Create histograms
    plt.figure(figsize=(16, 10))
    
    # PM2.5 histogram
    plt.subplot(2, 2, 1)
    plt.hist(df[pm25_col].dropna(), bins=30, alpha=0.7, color='skyblue')
    plt.title('PM2.5 Distribution')
    plt.xlabel('PM2.5 (μg/m³)')
    plt.ylabel('Frequency')
    
    # PM10 histogram
    plt.subplot(2, 2, 2)
    plt.hist(df[pm10_col].dropna(), bins=30, alpha=0.7, color='salmon')
    plt.title('PM10 Distribution')
    plt.xlabel('PM10 (μg/m³)')
    plt.ylabel('Frequency')
    
    # Temperature histogram
    plt.subplot(2, 2, 3)
    plt.hist(df[temp_col].dropna(), bins=30, alpha=0.7, color='lightgreen')
    plt.title('Temperature Distribution')
    plt.xlabel('Temperature (°C)')
    plt.ylabel('Frequency')
    
    # Humidity histogram
    plt.subplot(2, 2, 4)
    plt.hist(df[humidity_col].dropna(), bins=30, alpha=0.7, color='plum')
    plt.title('Humidity Distribution')
    plt.xlabel('Humidity (%)')
    plt.ylabel('Frequency')
    
    plt.tight_layout()
    plt.savefig(os.path.join(VIS_DIR, 'histograms.png'), dpi=150)
    plt.close()
    
    print("Histograms created successfully")

def create_correlation_heatmap(df, pm25_col, pm10_col, temp_col, humidity_col):
    """Create correlation heatmap between all variables"""
    # Ensure output directory exists
    os.makedirs(VIS_DIR, exist_ok=True)
    
    # Select relevant columns and rename for better visualization
    corr_df = df[[pm25_col, pm10_col, temp_col, humidity_col]].copy()
    corr_df.columns = ['PM2.5', 'PM10', 'Temperature', 'Humidity']
    
    # Calculate correlation matrix
    corr_matrix = corr_df.corr()
    
    # Create correlation heatmap
    plt.figure(figsize=(10, 8))
    sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1, center=0,
                fmt='.2f', linewidths=0.5)
    plt.title('Correlation Heatmap', fontsize=16)
    plt.tight_layout()
    plt.savefig(os.path.join(VIS_DIR, 'correlation_heatmap.png'), dpi=150)
    plt.close()
    
    print("Correlation heatmap created successfully")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Default to standard data path if not provided
        csv_path = DEFAULT_DATA_PATH
        print(f"Using default CSV path: {csv_path}")
    else:
        csv_path = sys.argv[1]
        
    start_date = sys.argv[2] if len(sys.argv) > 2 else None
    end_date = sys.argv[3] if len(sys.argv) > 3 else None
    
    print(f"Starting extended analysis with: CSV={csv_path}, Start={start_date}, End={end_date}")
    result = analyze_air_quality_data_extended(csv_path, start_date, end_date)
    print(json.dumps(result))
