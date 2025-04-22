import os
import sys
import json
import argparse
import datetime
import time
import logging

# Add parent directory to path so imports work correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our modules
from python.fetch_data import fetch_and_save
from python.analyze import analyze_data

# Constants
DEFAULT_DATA_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "air_quality_data.csv")
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "images")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/run_analysis.log"),
        logging.StreamHandler()
    ]
)

def run_full_analysis(days=7, viz_type="time_series", force_fetch=False, start_date=None, end_date=None):
    """
    Run the full analysis pipeline: fetch data, then analyze
    
    Args:
        days (int): Days of data to fetch
        viz_type (str): Type of visualization to create
        force_fetch (bool): Force fetch new data even if file exists
        start_date (str): Optional start date filter (YYYY-MM-DD)
        end_date (str): Optional end date filter (YYYY-MM-DD)
    
    Returns:
        dict: Results from both fetch and analyze steps
    """
    result = {
        "fetch": {
            "success": False,
            "message": "",
        },
        "analyze": {
            "success": False,
            "message": ""
        },
        "visualization": None,
        "overall_success": False,
        "timestamp": datetime.datetime.now().isoformat()
    }
    
    # Step 1: Check if we need to fetch data
    need_fetch = True
    
    if not force_fetch:
        if os.path.exists(DEFAULT_DATA_FILE):
            # Check if file is recent enough (within 1 hour)
            file_age = time.time() - os.path.getmtime(DEFAULT_DATA_FILE)
            if file_age < 3600:  # 1 hour
                need_fetch = False
                result["fetch"] = {
                    "success": True,
                    "message": f"Using existing data file (age: {file_age/60:.1f} minutes)"
                }
    
    # Step 1: Fetch data if needed
    if need_fetch:
        logging.info("Fetching data from API...")
        fetch_result = fetch_and_save(days=days, output_file=DEFAULT_DATA_FILE)
        result["fetch"] = {
            "success": fetch_result.get("success", False),
            "message": f"Fetched {fetch_result.get('records', 0)} records" if fetch_result.get("success") else fetch_result.get("error", "Unknown error"),
            "details": fetch_result
        }
        
        if not fetch_result.get("success"):
            logging.error(f"Error fetching data: {fetch_result.get('error', 'Unknown error')}")
            logging.info("Will try to analyze existing data if available.")
    
    # Step 2: Run analysis
    logging.info(f"Running {viz_type} analysis...")
    
    analysis_result = analyze_data(
        data_file=DEFAULT_DATA_FILE,
        output_dir=DEFAULT_OUTPUT_DIR,
        viz_type=viz_type,
        start_date=start_date,
        end_date=end_date
    )
    
    result["analyze"] = {
        "success": analysis_result.get("success", False),
        "message": f"Analysis complete, visualization created: {analysis_result.get('visualization', {}).get('path')}" 
                   if analysis_result.get("success") else analysis_result.get("error", "Unknown error")
    }
    
    # Include visualization details
    result["visualization"] = analysis_result.get("visualization")
    
    # Set overall success - we consider it a success if analysis works, even if fetch fails
    result["overall_success"] = analysis_result.get("success", False)
    
    return result

def main():
    """Command-line entry point"""
    parser = argparse.ArgumentParser(description="Run the full air quality analysis pipeline.")
    parser.add_argument("--days", type=int, default=7, help="Number of days of data to fetch")
    parser.add_argument("--viz-type", type=str, default="time_series", 
                        choices=["time_series", "daily_pattern", "heatmap", "correlation"],
                        help="Type of visualization to create")
    parser.add_argument("--force-fetch", action="store_true", help="Force fetch new data even if file exists")
    parser.add_argument("--start-date", type=str, help="Optional start date filter (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="Optional end date filter (YYYY-MM-DD)")
    parser.add_argument("--output-json", action="store_true", help="Output detailed JSON results")
    
    args = parser.parse_args()
    
    result = run_full_analysis(
        days=args.days,
        viz_type=args.viz_type,
        force_fetch=args.force_fetch,
        start_date=args.start_date,
        end_date=args.end_date
    )
    
    # Print simple output for the visualization middleware
    if result["visualization"] is not None and result["visualization"]["path"] is not None:
        print(result["visualization"]["path"])
        print(result["visualization"]["description"])
    else:
        print("/images/error.png")
        print(result["analyze"].get("message", "Analysis failed."))
    
    # Print JSON if requested
    if args.output_json:
        print(json.dumps(result, indent=2))
    
    if not result["overall_success"]:
        sys.exit(1)

if __name__ == "__main__":
    main()
