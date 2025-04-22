import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
import os
import sys
import json
from datetime import datetime, timedelta
import matplotlib as mpl

# Set matplotlib to use Agg backend - important for servers without GUI
mpl.use('Agg')

# Configure better plots
plt.style.use('ggplot')
sns.set_theme(style="whitegrid")

# Constants
DEFAULT_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "air_quality_data.csv")
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "images")

# Configure field mapping
FIELD_MAPPING = {
    "pm25": ["field3", "pm25"],
    "pm10": ["field4", "pm10"],
    "temperature": ["field2", "temperature"],
    "humidity": ["field1", "humidity"]
}

# Air quality standards
AQI_LEVELS = {
    "pm25": [
        {"max": 12, "level": "Good", "color": "green"},
        {"max": 35.4, "level": "Moderate", "color": "yellow"},
        {"max": 55.4, "level": "Unhealthy for Sensitive Groups", "color": "orange"},
        {"max": 150.4, "level": "Unhealthy", "color": "red"},
        {"max": 250.4, "level": "Very Unhealthy", "color": "purple"},
        {"max": 500, "level": "Hazardous", "color": "maroon"}
    ],
    "pm10": [
        {"max": 54, "level": "Good", "color": "green"},
        {"max": 154, "level": "Moderate", "color": "yellow"},
        {"max": 254, "level": "Unhealthy for Sensitive Groups", "color": "orange"},
        {"max": 354, "level": "Unhealthy", "color": "red"},
        {"max": 424, "level": "Very Unhealthy", "color": "purple"},
        {"max": 604, "level": "Hazardous", "color": "maroon"}
    ]
}

def load_data(data_file, start_date=None, end_date=None):
    """
    Load and preprocess air quality data
    
    Args:
        data_file (str): Path to CSV data file
        start_date (str): Optional start date filter (YYYY-MM-DD)
        end_date (str): Optional end date filter (YYYY-MM-DD)
    
    Returns:
        pandas.DataFrame: Cleaned and filtered DataFrame
    """
    if not os.path.exists(data_file):
        print(f"Error: Data file {data_file} not found.")
        return None
    
    try:
        # Load data
        df = pd.read_csv(data_file)
        print(f"Loaded {len(df)} records from {data_file}")
        
        # Convert timestamp column
        df['created_at'] = pd.to_datetime(df['created_at'], errors='coerce')
        df = df.dropna(subset=['created_at'])
        
        # Sort by timestamp
        df = df.sort_values('created_at')
        
        # Find and map fields correctly
        for target_field, possible_fields in FIELD_MAPPING.items():
            found = False
            for field in possible_fields:
                if field in df.columns:
                    df[target_field] = pd.to_numeric(df[field], errors='coerce')
                    found = True
                    break
            
            if not found:
                df[target_field] = np.nan
                print(f"Warning: Could not find column for {target_field}")
        
        # Filter by date range if provided
        if start_date:
            start = pd.to_datetime(start_date)
            df = df[df['created_at'] >= start]
            print(f"Filtered data after {start}")
            
        if end_date:
            end = pd.to_datetime(end_date)
            df = df[df['created_at'] <= end]
            print(f"Filtered data before {end}")
        
        # Drop rows with missing pollutant values
        df = df.dropna(subset=['pm25', 'pm10'])
        
        return df
        
    except Exception as e:
        print(f"Error loading data: {e}")
        return None

def calculate_statistics(df):
    """
    Calculate basic statistics from the DataFrame
    
    Args:
        df (pandas.DataFrame): Input DataFrame with preprocessed data
    
    Returns:
        dict: Dictionary of statistics
    """
    if df is None or len(df) == 0:
        return {
            "count": 0,
            "error": "No data available"
        }
    
    stats = {
        "count": len(df),
        "date_range": {
            "start": df['created_at'].min().strftime('%Y-%m-%d %H:%M:%S'),
            "end": df['created_at'].max().strftime('%Y-%m-%d %H:%M:%S')
        },
        "pm25": {
            "mean": float(df['pm25'].mean()),
            "median": float(df['pm25'].median()),
            "min": float(df['pm25'].min()),
            "max": float(df['pm25'].max()),
            "std": float(df['pm25'].std())
        },
        "pm10": {
            "mean": float(df['pm10'].mean()),
            "median": float(df['pm10'].median()),
            "min": float(df['pm10'].min()),
            "max": float(df['pm10'].max()),
            "std": float(df['pm10'].std())
        }
    }
    
    # Add temperature and humidity stats if available
    if 'temperature' in df.columns and not df['temperature'].isna().all():
        stats["temperature"] = {
            "mean": float(df['temperature'].mean()),
            "median": float(df['temperature'].median()),
            "min": float(df['temperature'].min()),
            "max": float(df['temperature'].max()),
            "std": float(df['temperature'].std())
        }
    
    if 'humidity' in df.columns and not df['humidity'].isna().all():
        stats["humidity"] = {
            "mean": float(df['humidity'].mean()),
            "median": float(df['humidity'].median()),
            "min": float(df['humidity'].min()),
            "max": float(df['humidity'].max()),
            "std": float(df['humidity'].std())
        }
    
    # Calculate AQI conditions
    stats["pm25"]["air_quality"] = get_air_quality_level(stats["pm25"]["mean"], "pm25")
    stats["pm10"]["air_quality"] = get_air_quality_level(stats["pm10"]["mean"], "pm10")
    
    return stats

def get_air_quality_level(value, pollutant):
    """
    Get air quality level based on pollutant concentration
    
    Args:
        value (float): Pollutant concentration
        pollutant (str): Pollutant type ('pm25' or 'pm10')
    
    Returns:
        dict: Air quality level information
    """
    if pd.isna(value):
        return {"level": "Unknown", "color": "gray"}
    
    # Get the appropriate levels based on pollutant type
    levels = AQI_LEVELS.get(pollutant, AQI_LEVELS["pm25"])
    
    for level_info in levels:
        if value <= level_info["max"]:
            return {
                "level": level_info["level"],
                "color": level_info["color"]
            }
    
    # If value exceeds all defined levels
    return {"level": "Extremely Hazardous", "color": "black"}

def create_time_series(df, output_dir):
    """
    Create time series visualization of PM2.5 and PM10 levels
    
    Args:
        df (pandas.DataFrame): Input DataFrame
        output_dir (str): Output directory for saving the visualization
    
    Returns:
        tuple: (image_path, description) tuple
    """
    if df is None or len(df) == 0:
        return None, "No data available for time series visualization"
    
    # Create plot
    fig, ax = plt.subplots(figsize=(12, 6))
    
    # Plot the data
    ax.plot(df['created_at'], df['pm25'], label='PM2.5', color='#4CAF50', linewidth=1.5)
    ax.plot(df['created_at'], df['pm10'], label='PM10', color='#F44336', linewidth=1.5)
    
    # Add WHO guideline thresholds
    ax.axhline(y=10, color='#4CAF50', linestyle='--', alpha=0.7, label='WHO PM2.5 guideline (10 μg/m³)')
    ax.axhline(y=20, color='#F44336', linestyle='--', alpha=0.7, label='WHO PM10 guideline (20 μg/m³)')
    
    # Format plot
    ax.set_title('Air Quality Measurements Over Time', fontsize=16)
    ax.set_xlabel('Date', fontsize=12)
    ax.set_ylabel('Concentration (μg/m³)', fontsize=12)
    
    # Format x-axis based on the data timespan
    timespan = df['created_at'].max() - df['created_at'].min()
    if timespan.days > 30:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        plt.xticks(rotation=45)
    else:
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H:%M'))
        plt.xticks(rotation=45)
    
    # Add legend
    ax.legend(loc='upper right', frameon=True)
    
    # Add grid
    ax.grid(True, linestyle='--', alpha=0.7)
    
    # Tight layout
    fig.tight_layout()
    
    # Save the figure
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"time_series_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    
    # Create directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    plt.savefig(filepath, dpi=100, bbox_inches='tight')
    plt.close(fig)
    
    # Create description
    mean_pm25 = df['pm25'].mean()
    mean_pm10 = df['pm10'].mean()
    
    description = (
        f"Time series analysis of air quality data from {df['created_at'].min().strftime('%Y-%m-%d')} "
        f"to {df['created_at'].max().strftime('%Y-%m-%d')}. "
        f"Average PM2.5: {mean_pm25:.2f} μg/m³, Average PM10: {mean_pm10:.2f} μg/m³. "
    )
    
    # Add air quality assessment
    pm25_quality = get_air_quality_level(mean_pm25, "pm25")["level"]
    description += f"Overall air quality based on PM2.5: {pm25_quality}."
    
    # Return web path (not filesystem path)
    web_path = f"/images/{filename}"
    return web_path, description

def create_daily_pattern(df, output_dir):
    """
    Create visualization of daily air quality patterns
    
    Args:
        df (pandas.DataFrame): Input DataFrame
        output_dir (str): Output directory for saving the visualization
    
    Returns:
        tuple: (image_path, description) tuple
    """
    if df is None or len(df) == 0:
        return None, "No data available for daily pattern visualization"
    
    # Extract hour from timestamp and calculate hourly averages
    df['hour'] = df['created_at'].dt.hour
    
    hourly_avg = df.groupby('hour')[['pm25', 'pm10']].mean().reset_index()
    
    # Create plot
    fig, ax = plt.subplots(figsize=(12, 6))
    
    # Plot the data
    ax.bar(hourly_avg['hour'], hourly_avg['pm25'], label='PM2.5', color='#4CAF50', alpha=0.7, width=0.7)
    ax.plot(hourly_avg['hour'], hourly_avg['pm10'], label='PM10', color='#F44336', linewidth=2.5, marker='o')
    
    # Format plot
    ax.set_title('Average Air Quality by Hour of Day', fontsize=16)
    ax.set_xlabel('Hour of Day (24h)', fontsize=12)
    ax.set_ylabel('Concentration (μg/m³)', fontsize=12)
    ax.set_xticks(range(0, 24))
    
    # Add legend
    ax.legend(loc='upper right', frameon=True)
    
    # Add grid
    ax.grid(True, linestyle='--', alpha=0.7)
    
    # Tight layout
    fig.tight_layout()
    
    # Save the figure
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"daily_pattern_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    
    # Create directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    plt.savefig(filepath, dpi=100, bbox_inches='tight')
    plt.close(fig)
    
    # Identify peak hours
    pm25_peak_hour = hourly_avg.loc[hourly_avg['pm25'].idxmax()]['hour']
    pm10_peak_hour = hourly_avg.loc[hourly_avg['pm10'].idxmax()]['hour']
    
    # Identify cleanest hours
    pm25_min_hour = hourly_avg.loc[hourly_avg['pm25'].idxmin()]['hour']
    pm10_min_hour = hourly_avg.loc[hourly_avg['pm10'].idxmin()]['hour']
    
    # Create description
    description = (
        f"Daily pattern analysis showing air quality variations throughout the day. "
        f"Peak PM2.5 levels occur at {int(pm25_peak_hour):02d}:00 hours, while PM10 peaks at {int(pm10_peak_hour):02d}:00 hours. "
        f"The cleanest air quality is observed at {int(pm25_min_hour):02d}:00 hours (for PM2.5) and {int(pm10_min_hour):02d}:00 hours (for PM10)."
    )
    
    # Return web path (not filesystem path)
    web_path = f"/images/{filename}"
    return web_path, description

def create_heatmap(df, output_dir):
    """
    Create heatmap visualization by day of week and hour
    
    Args:
        df (pandas.DataFrame): Input DataFrame
        output_dir (str): Output directory for saving the visualization
    
    Returns:
        tuple: (image_path, description) tuple
    """
    if df is None or len(df) == 0:
        return None, "No data available for heatmap visualization"
    
    # Extract hour and day of week from timestamp
    df['hour'] = df['created_at'].dt.hour
    df['day_of_week'] = df['created_at'].dt.dayofweek  # Monday=0, Sunday=6
    
    # Calculate averages by day of week and hour
    heatmap_data = df.groupby(['day_of_week', 'hour'])['pm25'].mean().unstack()
    
    # Day names for y-axis
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    
    # Create plot
    fig, ax = plt.subplots(figsize=(14, 8))
    
    # Plot heatmap
    sns.heatmap(heatmap_data, cmap='YlOrRd', annot=False, fmt=".1f", linewidths=.5, ax=ax)
    
    # Format plot
    ax.set_title('PM2.5 Levels by Day of Week and Hour', fontsize=16)
    ax.set_ylabel('Day of Week', fontsize=12)
    ax.set_xlabel('Hour of Day (24h)', fontsize=12)
    ax.set_yticklabels(day_names)
    
    # Tight layout
    fig.tight_layout()
    
    # Save the figure
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"heatmap_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    
    # Create directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    plt.savefig(filepath, dpi=100, bbox_inches='tight')
    plt.close(fig)
    
    # Find when air quality is best and worst
    max_value = heatmap_data.max().max()
    min_value = heatmap_data.min().min()
    
    # Get day and hour for max and min
    max_indices = np.where(heatmap_data.values == max_value)
    min_indices = np.where(heatmap_data.values == min_value)
    
    if len(max_indices[0]) > 0 and len(max_indices[1]) > 0:
        worst_day_idx = max_indices[0][0]
        worst_hour = max_indices[1][0]
        worst_day = day_names[worst_day_idx]
    else:
        worst_day = "unknown"
        worst_hour = "unknown"
    
    if len(min_indices[0]) > 0 and len(min_indices[1]) > 0:
        best_day_idx = min_indices[0][0]
        best_hour = min_indices[1][0]
        best_day = day_names[best_day_idx]
    else:
        best_day = "unknown"
        best_hour = "unknown"
    
    # Create description
    description = (
        f"Heatmap showing PM2.5 concentration patterns by day of week and hour. "
        f"Air quality tends to be worst on {worst_day}s at {worst_hour}:00 hours. "
        f"The best air quality typically occurs on {best_day}s at {best_hour}:00 hours."
    )
    
    # Return web path (not filesystem path)
    web_path = f"/images/{filename}"
    return web_path, description

def create_correlation(df, output_dir):
    """
    Create correlation analysis between pollutants, temperature and humidity
    
    Args:
        df (pandas.DataFrame): Input DataFrame
        output_dir (str): Output directory for saving the visualization
    
    Returns:
        tuple: (image_path, description) tuple
    """
    if df is None or len(df) == 0:
        return None, "No data available for correlation analysis"
    
    # Check if we have temperature and humidity data
    has_temp = 'temperature' in df.columns and not df['temperature'].isna().all()
    has_humidity = 'humidity' in df.columns and not df['humidity'].isna().all()
    
    if not has_temp and not has_humidity:
        return None, "Temperature and humidity data not available for correlation analysis"
    
    # Create scatter plots
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    # Temperature vs. PM2.5
    if has_temp:
        valid_temp = df.dropna(subset=['temperature', 'pm25'])
        if len(valid_temp) > 0:
            sns.regplot(x='temperature', y='pm25', data=valid_temp, ax=axes[0], scatter_kws={'alpha':0.5}, line_kws={'color':'red'})
            temp_corr = valid_temp[['temperature', 'pm25']].corr().iloc[0, 1]
            axes[0].set_title(f'PM2.5 vs. Temperature (Correlation: {temp_corr:.2f})', fontsize=12)
            axes[0].set_xlabel('Temperature (°C)', fontsize=10)
            axes[0].set_ylabel('PM2.5 (μg/m³)', fontsize=10)
    
    # Humidity vs. PM2.5
    if has_humidity:
        valid_humidity = df.dropna(subset=['humidity', 'pm25'])
        if len(valid_humidity) > 0:
            sns.regplot(x='humidity', y='pm25', data=valid_humidity, ax=axes[1], scatter_kws={'alpha':0.5}, line_kws={'color':'red'})
            humidity_corr = valid_humidity[['humidity', 'pm25']].corr().iloc[0, 1]
            axes[1].set_title(f'PM2.5 vs. Humidity (Correlation: {humidity_corr:.2f})', fontsize=12)
            axes[1].set_xlabel('Humidity (%)', fontsize=10)
            axes[1].set_ylabel('PM2.5 (μg/m³)', fontsize=10)
    
    # Main title
    fig.suptitle('Correlation Analysis: Air Quality vs. Environmental Factors', fontsize=16)
    
    # Tight layout
    fig.tight_layout(rect=[0, 0, 1, 0.95])
    
    # Save the figure
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    filename = f"correlation_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    
    # Create directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    plt.savefig(filepath, dpi=100, bbox_inches='tight')
    plt.close(fig)
    
    # Create description
    description = "Correlation analysis between air quality (PM2.5) and environmental factors. "
    
    if has_temp:
        if temp_corr > 0.5:
            description += "Strong positive correlation with temperature, suggesting PM2.5 levels increase in warmer conditions. "
        elif temp_corr > 0.2:
            description += "Moderate positive correlation with temperature. "
        elif temp_corr > -0.2:
            description += "Weak or no correlation with temperature. "
        elif temp_corr > -0.5:
            description += "Moderate negative correlation with temperature, suggesting PM2.5 levels decrease in warmer conditions. "
        else:
            description += "Strong negative correlation with temperature, suggesting PM2.5 levels significantly decrease in warmer conditions. "
    
    if has_humidity:
        if humidity_corr > 0.5:
            description += "Strong positive correlation with humidity, suggesting PM2.5 levels increase in humid conditions."
        elif humidity_corr > 0.2:
            description += "Moderate positive correlation with humidity."
        elif humidity_corr > -0.2:
            description += "Weak or no correlation with humidity."
        elif humidity_corr > -0.5:
            description += "Moderate negative correlation with humidity, suggesting PM2.5 levels decrease in humid conditions."
        else:
            description += "Strong negative correlation with humidity, suggesting PM2.5 levels significantly decrease in humid conditions."
    
    # Return web path (not filesystem path)
    web_path = f"/images/{filename}"
    return web_path, description

def analyze_data(data_file=DEFAULT_DATA_FILE, output_dir=DEFAULT_OUTPUT_DIR, viz_type="time_series", start_date=None, end_date=None):
    """
    Analyze air quality data and generate visualizations
    
    Args:
        data_file (str): Path to CSV data file
        output_dir (str): Output directory for visualizations
        viz_type (str): Type of visualization to create
        start_date (str): Optional start date filter (YYYY-MM-DD)
        end_date (str): Optional end date filter (YYYY-MM-DD)
    
    Returns:
        dict: Analysis results
    """
    result = {
        "success": False,
        "statistics": None,
        "visualization": {
            "type": viz_type,
            "path": None,
            "description": None
        },
        "error": None
    }
    
    try:
        # Load and preprocess data
        df = load_data(data_file, start_date, end_date)
        
        if df is None or len(df) == 0:
            result["error"] = "No data available for analysis"
            return result
        
        # Calculate statistics
        result["statistics"] = calculate_statistics(df)
        
        # Create visualization based on type
        if viz_type == "time_series":
            path, description = create_time_series(df, output_dir)
        elif viz_type == "daily_pattern":
            path, description = create_daily_pattern(df, output_dir)
        elif viz_type == "heatmap":
            path, description = create_heatmap(df, output_dir)
        elif viz_type == "correlation":
            path, description = create_correlation(df, output_dir)
        else:
            # Default to time series
            path, description = create_time_series(df, output_dir)
        
        result["visualization"]["path"] = path
        result["visualization"]["description"] = description
        result["success"] = path is not None
        
        return result
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        result["error"] = str(e)
        return result

def main():
    """Command-line entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Analyze air quality data and generate visualizations.")
    parser.add_argument("--data-file", type=str, default=DEFAULT_DATA_FILE, help="Path to CSV data file")
    parser.add_argument("--output-dir", type=str, default=DEFAULT_OUTPUT_DIR, help="Output directory for visualizations")
    parser.add_argument("--viz-type", type=str, default="time_series", 
                        choices=["time_series", "daily_pattern", "heatmap", "correlation"],
                        help="Type of visualization to create")
    parser.add_argument("--start-date", type=str, help="Optional start date filter (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="Optional end date filter (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    result = analyze_data(
        data_file=args.data_file,
        output_dir=args.output_dir,
        viz_type=args.viz_type,
        start_date=args.start_date,
        end_date=args.end_date
    )
    
    # Print to stdout so Python Shell can capture for the visualization helper
    if result["visualization"]["path"] is not None:
        print(result["visualization"]["path"])
        print(result["visualization"]["description"])
    else:
        print("/images/error.png")
        print(result["error"] or "Analysis failed without specific error message.")
    
    # Also output JSON dump for more detailed processing if needed
    if len(sys.argv) > 1:  # Don't output JSON if called by visualization helper
        json_output = json.dumps(result, indent=2)
        print(json_output)
    
    if not result["success"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
