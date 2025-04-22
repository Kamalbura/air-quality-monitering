import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import os
import sys
from datetime import datetime
import traceback

def main():
    try:
        # Process command line arguments
        if len(sys.argv) < 3:
            raise ValueError("Not enough arguments. Expected: csv_path, viz_type, [start_date], [end_date], [sampling]")
        
        csv_path = sys.argv[1]
        viz_type = sys.argv[2]
        start_date = sys.argv[3] if len(sys.argv) > 3 else None
        end_date = sys.argv[4] if len(sys.argv) > 4 else None
        sampling = int(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5].isdigit() else 1000
        
        # Ensure output directory exists
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'images')
        os.makedirs(output_dir, exist_ok=True)
        
        # Generate timestamp for unique filenames
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        
        # Load data
        df = pd.read_csv(csv_path)
        
        # Filter by date if specified
        if start_date and end_date:
            df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
            df = df[(df['created_at'] >= start_date) & (df['created_at'] <= end_date)]
        
        # Check if we have data
        if df.empty:
            raise ValueError("No data available for the selected period")
        
        # Ensure we have the required columns
        required_fields = ['created_at']
        missing_fields = [field for field in required_fields if field not in df.columns]
        if missing_fields:
            raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")
        
        # Map column names for consistency
        column_mapping = {
            'field1': 'humidity',
            'field2': 'temperature',
            'field3': 'pm25',
            'field4': 'pm10'
        }
        
        for old_name, new_name in column_mapping.items():
            if old_name in df.columns and new_name not in df.columns:
                df[new_name] = df[old_name]
        
        # Perform visualization based on type
        if viz_type == 'correlation':
            if df.shape[0] > 10000:  # For large datasets, use optimized correlation
                image_path, description = create_correlation_chart(df, output_dir, timestamp, large=True)
            else:
                image_path, description = create_correlation_chart(df, output_dir, timestamp)
        elif viz_type == 'time_series':
            image_path, description = create_time_series_chart(df, output_dir, timestamp)
        elif viz_type == 'daily_pattern':
            image_path, description = create_daily_pattern_chart(df, output_dir, timestamp)
        elif viz_type == 'heatmap':
            image_path, description = create_heatmap_chart(df, output_dir, timestamp)
        else:
            raise ValueError(f"Unsupported visualization type: {viz_type}")
        
        # Return results for Node.js to process
        print(image_path)
        print(description)
        
    except Exception as e:
        # Create an error image with the error message
        try:
            # Get the path to the create_error_image script
            error_script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'create_error_image.py')
            
            if os.path.exists(error_script_path):
                # If the error script exists, use it
                import importlib.util
                spec = importlib.util.spec_from_file_location("create_error_image", error_script_path)
                error_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(error_module)
                
                error_msg = f"{str(e)}\n{traceback.format_exc()}"
                image_path, description = error_module.create_error_image(f"Visualization Error: {str(e)}")
            else:
                # Fallback to hardcoded error image path
                image_path = "/images/error.png"
                description = f"Error generating visualization: {str(e)}"
            
            print(image_path)
            print(description)
        except Exception as inner_error:
            # Last resort fallback
            print("/images/error.png")
            print(f"Error: {str(e)}. Additionally, error handling failed: {str(inner_error)}")

def create_correlation_chart(df, output_dir, timestamp, large=False):
    """Create correlation visualization showing PM2.5 correlations with temperature and humidity"""
    if large:
        # For large datasets, use a simpler approach with less memory usage
        pm25_temp_corr = df[['pm25', 'temperature']].corr().iloc[0, 1]
        pm25_hum_corr = df[['pm25', 'humidity']].corr().iloc[0, 1]
        
        fig, axes = plt.subplots(1, 2, figsize=(16, 8))
        
        # Create text-based visualization for large datasets
        axes[0].text(0.5, 0.5, f"Correlation: {pm25_temp_corr:.4f}", 
                   ha='center', va='center', fontsize=20)
        axes[0].set_title('PM2.5 vs Temperature')
        axes[0].set_xlabel('Temperature')
        axes[0].set_ylabel('PM2.5')
        axes[0].grid(True)
        
        axes[1].text(0.5, 0.5, f"Correlation: {pm25_hum_corr:.4f}", 
                   ha='center', va='center', fontsize=20)
        axes[1].set_title('PM2.5 vs Humidity')
        axes[1].set_xlabel('Humidity')
        axes[1].set_ylabel('PM2.5')
        axes[1].grid(True)
    else:
        # For smaller datasets, create scatter plots
        fig, axes = plt.subplots(1, 2, figsize=(16, 8))
        
        # PM2.5 vs Temperature
        axes[0].scatter(df['temperature'], df['pm25'], alpha=0.5)
        axes[0].set_title('PM2.5 vs Temperature')
        axes[0].set_xlabel('Temperature (°C)')
        axes[0].set_ylabel('PM2.5 (μg/m³)')
        axes[0].grid(True)
        
        # PM2.5 vs Humidity
        axes[1].scatter(df['humidity'], df['pm25'], alpha=0.5)
        axes[1].set_title('PM2.5 vs Humidity')
        axes[1].set_xlabel('Humidity (%)')
        axes[1].set_ylabel('PM2.5 (μg/m³)')
        axes[1].grid(True)
    
    plt.tight_layout()
    
    # Save the figure
    filename = f"correlation_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    plt.savefig(filepath)
    plt.close()
    
    # Create description
    description = f"Correlation analysis of PM2.5 with temperature and humidity based on {len(df)} data points."
    
    return f"/images/{filename}", description

def create_time_series_chart(df, output_dir, timestamp):
    """Create time series visualization"""
    df['created_at'] = pd.to_datetime(df['created_at'])
    df = df.sort_values('created_at')
    
    fig, ax1 = plt.subplots(figsize=(16, 8))
    
    # Plot PM2.5 and PM10 on left y-axis
    ax1.plot(df['created_at'], df['pm25'], 'b-', label='PM2.5')
    ax1.plot(df['created_at'], df['pm10'], 'r-', label='PM10')
    ax1.set_xlabel('Date/Time')
    ax1.set_ylabel('Concentration (μg/m³)')
    ax1.tick_params(axis='y')
    
    # Create second y-axis for temperature
    ax2 = ax1.twinx()
    ax2.plot(df['created_at'], df['temperature'], 'g-', label='Temperature')
    ax2.set_ylabel('Temperature (°C)')
    ax2.tick_params(axis='y')
    
    # Add legend
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
    
    plt.title('Time Series of Air Quality Measurements')
    plt.tight_layout()
    
    # Save the figure
    filename = f"time_series_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    plt.savefig(filepath)
    plt.close()
    
    # Create description
    start_date = df['created_at'].min().strftime('%Y-%m-%d %H:%M')
    end_date = df['created_at'].max().strftime('%Y-%m-%d %H:%M')
    description = f"Time series of PM2.5, PM10, and temperature from {start_date} to {end_date}, covering {len(df)} data points."
    
    return f"/images/{filename}", description

def create_daily_pattern_chart(df, output_dir, timestamp):
    """Create daily pattern visualization showing hourly averages"""
    df['created_at'] = pd.to_datetime(df['created_at'])
    df['hour'] = df['created_at'].dt.hour
    
    # Group by hour and calculate means
    hourly_avg = df.groupby('hour').agg({
        'pm25': 'mean',
        'pm10': 'mean',
        'temperature': 'mean',
        'humidity': 'mean'
    }).reset_index()
    
    # Create the plot
    fig, ax1 = plt.subplots(figsize=(14, 8))
    
    # Plot PM2.5 and PM10
    ax1.plot(hourly_avg['hour'], hourly_avg['pm25'], 'bo-', label='PM2.5')
    ax1.plot(hourly_avg['hour'], hourly_avg['pm10'], 'ro-', label='PM10')
    ax1.set_xlabel('Hour of Day')
    ax1.set_ylabel('Concentration (μg/m³)')
    ax1.set_xticks(range(0, 24))
    ax1.grid(True, alpha=0.3)
    
    # Create second y-axis for temperature and humidity
    ax2 = ax1.twinx()
    ax2.plot(hourly_avg['hour'], hourly_avg['temperature'], 'go-', label='Temperature')
    ax2.plot(hourly_avg['hour'], hourly_avg['humidity'], 'mo-', label='Humidity')
    ax2.set_ylabel('Temperature (°C) / Humidity (%)')
    
    # Add legends
    lines1, labels1 = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines1 + lines2, labels1 + labels2, loc='upper left')
    
    plt.title('Daily Patterns of Air Quality Measurements')
    plt.tight_layout()
    
    # Save the figure
    filename = f"daily_pattern_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    plt.savefig(filepath)
    plt.close()
    
    # Create description
    peak_hour_pm25 = hourly_avg.loc[hourly_avg['pm25'].idxmax()]['hour']
    description = f"Daily patterns of air quality measurements across 24 hours. PM2.5 peaks at hour {peak_hour_pm25}."
    
    return f"/images/{filename}", description

def create_heatmap_chart(df, output_dir, timestamp):
    """Create heatmap showing correlation between variables"""
    # Select only numeric columns
    numeric_df = df[['pm25', 'pm10', 'temperature', 'humidity']].copy()
    
    # Calculate correlation matrix
    corr_matrix = numeric_df.corr()
    
    # Create heatmap
    plt.figure(figsize=(10, 8))
    sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1, center=0,
               square=True, linewidths=.5, cbar_kws={"shrink": .8})
    
    plt.title('Correlation Heatmap of Air Quality Measurements')
    plt.tight_layout()
    
    # Save the figure
    filename = f"heatmap_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    plt.savefig(filepath)
    plt.close()
    
    # Create description
    pm25_temp_corr = corr_matrix.loc['pm25', 'temperature']
    pm25_hum_corr = corr_matrix.loc['pm25', 'humidity']
    description = f"Correlation heatmap showing relationships between variables. PM2.5 has a {pm25_temp_corr:.2f} correlation with temperature and {pm25_hum_corr:.2f} correlation with humidity."
    
    return f"/images/{filename}", description

if __name__ == "__main__":
    main()
