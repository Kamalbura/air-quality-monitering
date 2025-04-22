import sys 
import os 
 
# This is a wrapper script for backward compatibility 
# Redirects to the consolidated python/analysis.py 
 
python_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'python') 
sys.path.append(python_dir) 
 
from python.analysis import analyze_air_quality_data 
 
if __name__ == "__main__": 
    # Forward arguments to main script 
    args = sys.argv[1:] 
    csv_path = args[0] if len(args) > 0 else None 
    start_date = args[1] if len(args) > 1 else None 
    end_date = args[2] if len(args) > 2 else None 
    result = analyze_air_quality_data(csv_path, start_date, end_date) 
    import json 
    print(json.dumps(result))
