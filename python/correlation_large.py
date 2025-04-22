import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import os
import sys
from datetime import datetime

def create_correlation_large(csv_path, output_dir, timestamp, start_date=None, end_date=None):
    """Create correlation visualization for large datasets using chunking"""
    # Initialize aggregation variables
    pm25_temp_products = 0
    pm25_hum_products = 0
    pm25_sum = 0
    pm10_sum = 0
    temp_sum = 0
    hum_sum = 0
    pm25_squared_sum = 0
    temp_squared_sum = 0
    hum_squared_sum = 0
    count = 0
    
    # Process in chunks for memory efficiency
    chunk_size = 50000
    
    # Convert dates if provided
    start = pd.to_datetime(start_date) if start_date else None
    end = pd.to_datetime(end_date) if end_date else None
    
    # Process data in chunks
    for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
        chunk['created_at'] = pd.to_datetime(chunk['created_at'])
        
        # Filter by date if specified
        if start and end:
            chunk = chunk[(chunk['created_at'] >= start) & (chunk['created_at'] <= end)]
        
        if len(chunk) == 0:
            continue
        
        # Map fields correctly
        if 'field3' in chunk.columns and 'field4' in chunk.columns:
            chunk['pm25'] = pd.to_numeric(chunk['field3'], errors='coerce')
            chunk['pm10'] = pd.to_numeric(chunk['field4'], errors='coerce')
        
        if 'field1' in chunk.columns and 'field2' in chunk.columns:
            chunk['humidity'] = pd.to_numeric(chunk['field1'], errors='coerce')
            chunk['temperature'] = pd.to_numeric(chunk['field2'], errors='coerce')
        
        # Filter out NaN values
        chunk = chunk.dropna(subset=['pm25', 'pm10', 'temperature', 'humidity'])
        
        if len(chunk) == 0:
            continue
        
        # Update aggregation variables for correlation calculation
        pm25_temp_products += (chunk['pm25'] * chunk['temperature']).sum()
        pm25_hum_products += (chunk['pm25'] * chunk['humidity']).sum()
        
        pm25_sum += chunk['pm25'].sum()
        pm10_sum += chunk['pm10'].sum()
        temp_sum += chunk['temperature'].sum()
        hum_sum += chunk['humidity'].sum()
        
        pm25_squared_sum += (chunk['pm25'] ** 2).sum()
        temp_squared_sum += (chunk['temperature'] ** 2).sum()
        hum_squared_sum += (chunk['humidity'] ** 2).sum()
        
        count += len(chunk)
    
    # If no data was processed, create an empty plot
    if count == 0:
        fig, axes = plt.subplots(1, 2, figsize=(16, 7))
        axes[0].text(0.5, 0.5, "No data available for the selected period", 
                   ha='center', va='center', fontsize=14)
        axes[1].text(0.5, 0.5, "No data available for the selected period", 
                   ha='center', va='center', fontsize=14)
        axes[0].set_xlabel('Temperature (°C)')
        axes[0].set_ylabel('PM2.5 (μg/m³)')
        axes[0].set_title('PM2.5 vs Temperature')
        axes[1].set_xlabel('Humidity (%)')
        axes[1].set_ylabel('PM2.5 (μg/m³)')
        axes[1].set_title('PM2.5 vs Humidity')
        plt.tight_layout()
        
        filename = f"correlation_{timestamp}.png"
        filepath = os.path.join(output_dir, filename)
        plt.savefig(filepath)
        plt.close()
        
        return f"/images/{filename}", "No data available for the selected period."
    
    # Calculate correlation coefficients
    pm25_temp_corr = calculate_correlation(pm25_temp_products, pm25_sum, temp_sum, pm25_squared_sum, temp_squared_sum, count)
    pm25_hum_corr = calculate_correlation(pm25_hum_products, pm25_sum, hum_sum, pm25_squared_sum, hum_squared_sum, count)
    
    # Create visualization of correlation trends
    # For large datasets, we'll generate trend visualizations without scatter plots
    fig, axes = plt.subplots(1, 2, figsize=(16, 7))
    
    # Calculate trend lines
    temp_avg = temp_sum / count
    hum_avg = hum_sum / count
    pm25_avg = pm25_sum / count
    
    # PM2.5 vs Temperature trend
    temp_range = np.linspace(temp_avg * 0.7, temp_avg * 1.3, 100)
    pm25_trend_temp = pm25_avg + pm25_temp_corr * (temp_range - temp_avg)
    axes[0].plot(temp_range, pm25_trend_temp, 'r-', linewidth=2)
    axes[0].set_xlabel('Temperature (°C)')
    axes[0].set_ylabel('PM2.5 (μg/m³)')
    axes[0].set_title(f'PM2.5 vs Temperature (Correlation: {pm25_temp_corr:.3f})')
    axes[0].text(0.05, 0.95, f'r = {pm25_temp_corr:.3f}', transform=axes[0].transAxes,
               fontsize=12, verticalalignment='top')
    axes[0].grid(True, linestyle='--', alpha=0.7)
    
    # PM2.5 vs Humidity trend
    hum_range = np.linspace(hum_avg * 0.7, hum_avg * 1.3, 100)
    pm25_trend_hum = pm25_avg + pm25_hum_corr * (hum_range - hum_avg)
    axes[1].plot(hum_range, pm25_trend_hum, 'r-', linewidth=2)
    axes[1].set_xlabel('Humidity (%)')
    axes[1].set_ylabel('PM2.5 (μg/m³)')
    axes[1].set_title(f'PM2.5 vs Humidity (Correlation: {pm25_hum_corr:.3f})')
    axes[1].text(0.05, 0.95, f'r = {pm25_hum_corr:.3f}', transform=axes[1].transAxes,
               fontsize=12, verticalalignment='top')
    axes[1].grid(True, linestyle='--', alpha=0.7)
    
    plt.tight_layout()
    
    # Save the figure
    filename = f"correlation_{timestamp}.png"
    filepath = os.path.join(output_dir, filename)
    plt.savefig(filepath)
    plt.close()
    
    # Create description
    description = (
        f"Correlation analysis of PM2.5 with environmental factors based on {count:,} data points. "
        f"Temperature correlation: {pm25_temp_corr:.3f} - "
        f"{'Strong positive' if pm25_temp_corr > 0.7 else 'Moderate positive' if pm25_temp_corr > 0.3 else 'Weak positive' if pm25_temp_corr > 0 else 'Strong negative' if pm25_temp_corr < -0.7 else 'Moderate negative' if pm25_temp_corr < -0.3 else 'Weak negative'} relationship. "
        f"Humidity correlation: {pm25_hum_corr:.3f} - "
        f"{'Strong positive' if pm25_hum_corr > 0.7 else 'Moderate positive' if pm25_hum_corr > 0.3 else 'Weak positive' if pm25_hum_corr > 0 else 'Strong negative' if pm25_hum_corr < -0.7 else 'Moderate negative' if pm25_hum_corr < -0.3 else 'Weak negative'} relationship."
    )
    
    return f"/images/{filename}", description

def calculate_correlation(xy_sum, x_sum, y_sum, x_squared_sum, y_squared_sum, n):
    """Calculate Pearson correlation coefficient using aggregated values"""
    try:
        numerator = n * xy_sum - x_sum * y_sum
        denominator = np.sqrt((n * x_squared_sum - x_sum**2) * (n * y_squared_sum - y_sum**2))
        
        if denominator == 0:
            return 0
            
        correlation = numerator / denominator
        return correlation
    except:
        return 0

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("/images/error.png")
        print("Not enough arguments")
    else:
        csv_path = sys.argv[1]
        output_dir = sys.argv[2]
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        start_date = sys.argv[3] if len(sys.argv) > 3 else None
        end_date = sys.argv[4] if len(sys.argv) > 4 else None
        
        image_path, description = create_correlation_large(csv_path, output_dir, timestamp, start_date, end_date)
        print(image_path)
        print(description)
