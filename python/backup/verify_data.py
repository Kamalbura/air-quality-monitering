import pandas as pd
import numpy as np
import sys
import os
import json
from datetime import datetime

def verify_dataset(file_path):
    """
    Verify the data file integrity and return diagnostic information
    """
    if not os.path.exists(file_path):
        return {
            "status": "error",
            "message": f"File not found: {file_path}",
            "valid": False
        }
    
    try:
        # Get file stats
        file_size = os.path.getsize(file_path)
        file_size_mb = file_size / (1024 * 1024)
        
        # Check if the file is too large for full validation
        if file_size_mb > 100:
            # For large files, validate the first and last 1000 rows
            head = pd.read_csv(file_path, nrows=1000)
            
            # Read last 1000 rows efficiently
            with open(file_path, 'rb') as f:
                f.seek(max(0, file_size - 1000000))  # Seek to roughly last 1000 rows
                last_chunk = pd.read_csv(f)
                tail = last_chunk.tail(1000)
        else:
            # For smaller files, read everything
            df = pd.read_csv(file_path)
            head = df.head(1000)
            tail = df.tail(1000)
            
        # Check required columns
        required_columns = ['created_at']
        
        # Check for PM2.5 and PM10 in either field3/field4 or pm25/pm10 columns
        has_pm_standard = all(col in head.columns for col in ['pm25', 'pm10'])
        has_pm_field = all(col in head.columns for col in ['field3', 'field4'])
        
        missing_columns = [col for col in required_columns if col not in head.columns]
        
        if missing_columns:
            return {
                "status": "error",
                "message": f"Missing required columns: {', '.join(missing_columns)}",
                "valid": False
            }
        
        if not (has_pm_standard or has_pm_field):
            return {
                "status": "error",
                "message": "Missing PM data columns. Need either field3/field4 or pm25/pm10.",
                "valid": False
            }
            
        # Check timestamp validity in head and tail
        head['created_at'] = pd.to_datetime(head['created_at'], errors='coerce')
        tail['created_at'] = pd.to_datetime(tail['created_at'], errors='coerce')
        
        invalid_head_dates = head['created_at'].isna().sum()
        invalid_tail_dates = tail['created_at'].isna().sum()
        
        if invalid_head_dates > 0 or invalid_tail_dates > 0:
            return {
                "status": "warning",
                "message": f"Found {invalid_head_dates + invalid_tail_dates} invalid timestamps in sampled data",
                "valid": True,  # Still valid but with warnings
                "warnings": ["Some timestamps are invalid and will be ignored"]
            }
            
        # Successfully validated
        return {
            "status": "success",
            "message": "Data file validated successfully",
            "valid": True,
            "file_size_mb": round(file_size_mb, 2),
            "date_range": {
                "start": head['created_at'].min().strftime('%Y-%m-%d %H:%M:%S') if not head['created_at'].empty else None,
                "end": tail['created_at'].max().strftime('%Y-%m-%d %H:%M:%S') if not tail['created_at'].empty else None
            },
            "field_mapping": {
                "pm25": "field3" if has_pm_field else "pm25",
                "pm10": "field4" if has_pm_field else "pm10",
                "timestamp": "created_at"
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error validating file: {str(e)}",
            "valid": False,
            "exception": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "status": "error",
            "message": "No file path provided",
            "valid": False
        }))
    else:
        file_path = sys.argv[1]
        result = verify_dataset(file_path)
        print(json.dumps(result))
