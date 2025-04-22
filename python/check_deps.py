def check_dependencies(): 
    """Check if required Python packages are installed.""" 
    dependencies = [ 
        "pandas", 
        "numpy", 
        "matplotlib", 
        "seaborn", 
        "scikit-learn" 
    ] 
    missing = [] 
    for dep in dependencies: 
        try: 
            __import__(dep) 
            print(f"[OK] {dep} is installed.") 
        except ImportError: 
            missing.append(dep) 
            print(f"[MISSING] {dep} is NOT installed.") 
    if not missing: 
        print("\nAll Python dependencies are installed correctly") 
        return True 
    else: 
        print(f"\nMissing {len(missing)} dependencies. Please install them.") 
        return False 
 
if __name__ == "__main__": 
    check_dependencies() 
