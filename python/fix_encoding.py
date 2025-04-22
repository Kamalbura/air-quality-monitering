import os
import re

def fix_python_files():
    py_dir = os.path.dirname(os.path.abspath(__file__))
    for filename in os.listdir(py_dir):
        if filename.endswith('.py') and filename != 'fix_encoding.py':
            filepath = os.path.join(py_dir, filename)
            print(f"Checking {filename}...")
            
            # Read with error handling
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Fix common encoding issues
                content = content.replace('\u2705', '[OK]')
                content = content.replace('\u274c', '[ERROR]')
                content = content.replace('\\u2705', '[OK]')
                content = content.replace('\\u274c', '[ERROR]')
                
                # Fix special quotes
                content = content.replace('\u201c', '"')
                content = content.replace('\u201d', '"')
                content = content.replace('\u2018', "'")
                content = content.replace('\u2019', "'")
                
                # Write back with proper encoding
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                    
                print(f"✓ Fixed encoding issues in {filename}")
            except Exception as e:
                print(f"✗ Error fixing {filename}: {str(e)}")
    
    print("All Python files checked and fixed for encoding issues.")

if __name__ == "__main__":
    fix_python_files()
