import pandas as pd
import numpy as np
import json
import sys
import os
from datetime import datetime

def validate_air_quality_data(csv_path, max_records=None):
    """
    Validate air quality data for proper structure and integrity
    """
    results = {
        'valid': True,
        'recordCount': 0,
        'validRecords': 0,
        'completion': 0,
        'issues': [],
        'invalidRecords': [],
        'fieldStatistics': {
            'field1_coverage': 0,
            'field2_coverage': 0,
            'field3_coverage': 0,
            'field4_coverage': 0,
            'valid_dates_coverage': 0
        }
    }
    
    # Check if file exists
    if not os.path.isfile(csv_path):
        results['valid'] = False
        results['issues'].append(f"File not found: {csv_path}")
        return results
    
    try:
        # Read file with chunks if it's large
        if max_records and max_records.isdigit():
            max_records = int(max_records)
        else:
            max_records = None
        
        # Get file info
        file_size = os.path.getsize(csv_path)
        file_size_mb = file_size / (1024 * 1024)
        results['fileInfo'] = {
            'path': csv_path,
            'size': file_size,
            'size_mb': round(file_size_mb, 2)
        }
        
        # Initialize counters
        total_records = 0
        valid_records = 0
        field_stats = {
            'field1_present': 0,
            'field2_present': 0,
            'field3_present': 0,
            'field4_present': 0,
            'valid_dates': 0
        }
        
        # Process in chunks to handle large files
        chunk_size = 10000
        invalid_examples = []
        
        # Use reader to get total count first
        with open(csv_path, 'r') as f:
            for i, _ in enumerate(f):
                if i == 0:  # Skip header
                    continue
                total_records += 1
                if max_records and i >= max_records:
                    break
        
        # Now process with pandas for detailed validation
        for chunk in pd.read_csv(csv_path, chunksize=chunk_size):
            if max_records and total_records > max_records:
                chunk = chunk.head(max_records - total_records + len(chunk))
                
            # Check for required columns
            for col in ['created_at', 'field1', 'field2', 'field3', 'field4']:
                if col not in chunk.columns:
                    results['valid'] = False
                    results['issues'].append(f"Missing required column: {col}")
            
            # Convert timestamp
            chunk['created_at'] = pd.to_datetime(chunk['created_at'], errors='coerce')
            
            # Validate each row
            for i, row in chunk.iterrows():
                # Check field presence
                if pd.notna(row.get('field1')): field_stats['field1_present'] += 1
                if pd.notna(row.get('field2')): field_stats['field2_present'] += 1
                if pd.notna(row.get('field3')): field_stats['field3_present'] += 1
                if pd.notna(row.get('field4')): field_stats['field4_present'] += 1
                
                # Check date validity
                if pd.notna(row['created_at']):
                    field_stats['valid_dates'] += 1
                
                # Check overall validity
                is_valid = (
                    pd.notna(row['created_at']) and
                    pd.notna(row.get('field3')) and  # PM2.5
                    pd.notna(row.get('field4'))      # PM10
                )
                
                if is_valid:
                    valid_records += 1
                elif len(invalid_examples) < 10:  # Store sample of invalid records
                    invalid_examples.append({
                        'index': i,
                        'issues': [
                            f"Invalid timestamp" if pd.isna(row['created_at']) else None,
                            f"Missing PM2.5 value" if pd.isna(row.get('field3')) else None,
                            f"Missing PM10 value" if pd.isna(row.get('field4')) else None
                        ]
                    })
            
            if max_records and total_records >= max_records:
                break
        
        # Process results
        results['recordCount'] = total_records
        results['validRecords'] = valid_records
        results['completion'] = round((valid_records / total_records * 100), 2) if total_records > 0 else 0
        results['invalidRecords'] = invalid_examples
        
        # Calculate field statistics
        if total_records > 0:
            results['fieldStatistics'] = {
                'field1_coverage': round(field_stats['field1_present'] / total_records * 100, 2),
                'field2_coverage': round(field_stats['field2_present'] / total_records * 100, 2),
                'field3_coverage': round(field_stats['field3_present'] / total_records * 100, 2),
                'field4_coverage': round(field_stats['field4_present'] / total_records * 100, 2),
                'valid_dates_coverage': round(field_stats['valid_dates'] / total_records * 100, 2)
            }
        
        # Check for integrity issues
        if field_stats['field1_present'] < total_records * 0.9:
            results['issues'].append('field1 (Humidity) is missing in more than 10% of records')
        if field_stats['field2_present'] < total_records * 0.9:
            results['issues'].append('field2 (Temperature) is missing in more than 10% of records')
        if field_stats['field3_present'] < total_records * 0.9:
            results['issues'].append('field3 (PM2.5) is missing in more than 10% of records')
        if field_stats['field4_present'] < total_records * 0.9:
            results['issues'].append('field4 (PM10) is missing in more than 10% of records')
        if field_stats['valid_dates'] < total_records * 0.95:
            results['issues'].append('Invalid timestamps found in more than 5% of records')
            
        # Final validation status
        if len(results['issues']) > 0:
            results['valid'] = False
        
        return results
        
    except Exception as e:
        results['valid'] = False
        results['issues'].append(f"Error validating data: {str(e)}")
        return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({'valid': False, 'error': 'Missing file path argument'}))
    else:
        csv_path = sys.argv[1]
        max_records = sys.argv[2] if len(sys.argv) > 2 else None
        result = validate_air_quality_data(csv_path, max_records)
        print(json.dumps(result))
