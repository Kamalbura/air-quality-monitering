import requests
import pandas as pd
import os
import time
import json
import sys
from datetime import datetime, timedelta

# ThingSpeak API connection settings
THINGSPEAK_BASE_URL = "https://api.thingspeak.com/channels"
THINGSPEAK_FIELDS = ["field1", "field2", "field3", "field4"]
FIELD_MAPPING = {
    "field1": "humidity",
    "field2": "temperature",
    "field3": "pm25",
    "field4": "pm10"
}

# Default output file
DEFAULT_OUTPUT_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "air_quality_data.csv")

def load_credentials():
    """Load ThingSpeak credentials from .env file or environment variables"""
    dotenv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
    credentials = {
        "channel_id": os.environ.get("THINGSPEAK_CHANNEL_ID"),
        "read_api_key": os.environ.get("THINGSPEAK_READ_API_KEY")
    }
    
    # Try to load from .env file if not found in environment variables
    if not credentials["channel_id"] or not credentials["read_api_key"]:
        try:
            if os.path.exists(dotenv_path):
                with open(dotenv_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            key, value = line.split('=', 1)
                            if key == "THINGSPEAK_CHANNEL_ID":
                                credentials["channel_id"] = value
                            elif key == "THINGSPEAK_READ_API_KEY":
                                credentials["read_api_key"] = value
        except Exception as e:
            print(f"Error loading .env file: {e}")
    
    # Use default values if still not set
    if not credentials["channel_id"]:
        credentials["channel_id"] = "2863798"  # Default channel ID
    
    if not credentials["read_api_key"]:
        credentials["read_api_key"] = "RIXYDDDMXDBX9ALI"  # Default read API key
    
    return credentials

def fetch_data(channel_id, read_api_key, days=7, max_results=8000):
    """
    Fetch data from ThingSpeak API
    
    Args:
        channel_id (str): ThingSpeak channel ID
        read_api_key (str): ThingSpeak read API key
        days (int): Number of days of data to fetch
        max_results (int): Maximum number of results to fetch
    
    Returns:
        pandas.DataFrame: DataFrame containing the fetched data
    """
    print(f"Fetching data from ThingSpeak channel {channel_id}...")
    
    # Calculate start date
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Format dates for ThingSpeak API
    start_str = start_date.strftime("%Y-%m-%d%%20%H:%M:%S")
    end_str = end_date.strftime("%Y-%m-%d%%20%H:%M:%S")
    
    # Prepare API request
    url = f"{THINGSPEAK_BASE_URL}/{channel_id}/feeds.json"
    params = {
        "api_key": read_api_key,
        "start": start_str,
        "end": end_str,
        "results": max_results
    }
    
    # Make request with retry logic
    max_retries = 3
    retry_delay = 5
    attempt = 0
    
    while attempt < max_retries:
        try:
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            data = response.json()
            if "feeds" not in data or len(data["feeds"]) == 0:
                print("No data found in the specified time range")
                return None
                
            print(f"Successfully fetched {len(data['feeds'])} records")
            
            # Convert to DataFrame and rename fields
            df = pd.DataFrame(data["feeds"])
            
            # Handle missing fields
            for field in THINGSPEAK_FIELDS:
                if field not in df.columns:
                    df[field] = None
            
            # Add mapped field names
            for field, mapped_name in FIELD_MAPPING.items():
                df[mapped_name] = df[field]
                
            return df
            
        except requests.exceptions.RequestException as e:
            attempt += 1
            print(f"Attempt {attempt} failed: {str(e)}")
            
            if attempt < max_retries:
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                print("Failed to fetch data after multiple attempts")
                return None

def save_data(df, output_file):
    """
    Save DataFrame to CSV
    
    Args:
        df (pandas.DataFrame): DataFrame to save
        output_file (str): Output file path
    
    Returns:
        bool: True if successful, False otherwise
    """
    if df is None or len(df) == 0:
        print("No data to save")
        return False
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        
        # Save to CSV
        df.to_csv(output_file, index=False)
        print(f"Data saved to {output_file}")
        
        # Print stats
        print(f"Saved {len(df)} records spanning from {df['created_at'].min()} to {df['created_at'].max()}")
        return True
    except Exception as e:
        print(f"Error saving data: {e}")
        return False

def fetch_and_save(days=7, output_file=DEFAULT_OUTPUT_FILE, check_only=False):
    """
    Main function to fetch data from ThingSpeak and save it locally
    
    Args:
        days (int): Number of days of data to fetch
        output_file (str): Output file path
        check_only (bool): If True, only check if data exists without saving
    
    Returns:
        dict: Status information
    """
    start_time = time.time()
    result = {
        "success": False,
        "records": 0,
        "output_file": output_file,
        "elapsed_time": 0,
        "date_range": {"start": None, "end": None},
        "error": None
    }
    
    try:
        # Load credentials
        credentials = load_credentials()
        
        # Fetch data
        df = fetch_data(
            credentials["channel_id"], 
            credentials["read_api_key"], 
            days=days
        )
        
        if df is None or len(df) == 0:
            result["error"] = "No data retrieved"
            return result
        
        result["records"] = len(df)
        
        # Parse dates properly
        df['created_at'] = pd.to_datetime(df['created_at'])
        
        # Update date range
        result["date_range"]["start"] = df['created_at'].min().strftime("%Y-%m-%d %H:%M:%S")
        result["date_range"]["end"] = df['created_at'].max().strftime("%Y-%m-%d %H:%M:%S")
        
        # Save data unless check_only is True
        if not check_only:
            if save_data(df, output_file):
                result["success"] = True
        else:
            result["success"] = True
            result["check_only"] = True
    
    except Exception as e:
        result["error"] = str(e)
        print(f"Error: {e}")
    
    # Calculate elapsed time
    result["elapsed_time"] = round(time.time() - start_time, 2)
    return result

def main():
    """Command-line entry point"""
    import argparse
    parser = argparse.ArgumentParser(description="Fetch air quality data from ThingSpeak.")
    parser.add_argument("--days", type=int, default=7, help="Number of days to fetch (default: 7)")
    parser.add_argument("--output", type=str, default=DEFAULT_OUTPUT_FILE, help="Output file path")
    parser.add_argument("--check-only", action="store_true", help="Only check if data exists without saving")
    
    args = parser.parse_args()
    
    result = fetch_and_save(days=args.days, output_file=args.output, check_only=args.check_only)
    print(json.dumps(result, indent=2))
    
    if not result["success"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
