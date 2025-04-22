/**
 * Setup script for Air Quality Monitoring System
 * Creates necessary directories, validates configuration, and prepares the environment
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

console.log('=== Air Quality Monitoring System Setup ===');

// Create necessary directories
const directories = [
  'data',
  'logs',
  'public/images',
  'public/js',
  'public/css',
  'python',
  'services',
  'helpers',
  'routes',
  'middleware',
  'views'
];

console.log('Creating directory structure...');
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created: ${dir}`);
  } else {
    console.log(`Exists: ${dir}`);
  }
});

// Create .env file if it doesn't exist
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('Creating .env file with default configuration...');
  const envContent = `# ThingSpeak Configuration
THINGSPEAK_CHANNEL_ID=2863798
THINGSPEAK_READ_API_KEY=RIXYDDDMXDBX9ALI
THINGSPEAK_WRITE_API_KEY=PV514C353A367A3J

# Application Settings
PORT=3000
NODE_ENV=development
`;
  fs.writeFileSync(envPath, envContent);
  console.log('Created .env file with default configuration.');
} else {
  console.log('.env file already exists, skipping creation.');
}

// Create a public index.html if it doesn't exist
const publicIndexPath = path.join(__dirname, 'public', 'index.html');
if (!fs.existsSync(publicIndexPath)) {
  console.log('Creating a redirect index.html...');
  const indexContent = `<!DOCTYPE html>
<html>
<head>
  <title>Air Quality Monitoring</title>
  <meta http-equiv="refresh" content="0;url=/" />
</head>
<body>
  <p>Redirecting to dashboard...</p>
  <script>
    window.location.href = "/";
  </script>
</body>
</html>`;
  fs.writeFileSync(publicIndexPath, indexContent);
  console.log('Created redirect index.html');
}

// Check if required Python scripts exist
const requiredPythonScripts = ['fetch_data.py', 'analyze.py', 'run_analysis.py'];
console.log('\nChecking required Python scripts...');

requiredPythonScripts.forEach(script => {
  const scriptPath = path.join(__dirname, 'python', script);
  if (!fs.existsSync(scriptPath)) {
    console.log(`Warning: ${script} not found. This script is required for data processing.`);
  } else {
    console.log(`Found: ${script}`);
  }
});

// Check Node.js dependencies
console.log('\nChecking Node.js dependencies...');
try {
  console.log('Installing Node.js dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  console.log('Node.js dependencies installed successfully.');
} catch (error) {
  console.error('Failed to install Node.js dependencies:', error.message);
  console.log('Please run `npm install` manually.');
}

// Check Python dependencies
console.log('\nChecking Python dependencies...');
const requirementsPath = path.join(__dirname, 'requirements.txt');
if (!fs.existsSync(requirementsPath)) {
  console.log('Creating requirements.txt file...');
  const requirements = `pandas==2.1.1
numpy==1.26.0
matplotlib==3.8.0
seaborn==0.13.0
scikit-learn==1.3.1
`;
  fs.writeFileSync(requirementsPath, requirements);
  console.log('Created requirements.txt file.');
}

try {
  console.log('Attempting to install Python dependencies...');
  if (os.platform() === 'win32') {
    execSync('pip install -r requirements.txt', { stdio: 'inherit' });
  } else {
    execSync('pip3 install -r requirements.txt', { stdio: 'inherit' });
  }
  console.log('Python dependencies installed successfully.');
} catch (error) {
  console.error('Failed to install Python dependencies:', error.message);
  console.log('You may need to install Python dependencies manually:');
  console.log('pip install -r requirements.txt');
}

// Test Python availability
try {
  console.log('\nTesting Python availability...');
  
  const checkPythonPath = path.join(__dirname, 'python', 'check_python.py');
  if (!fs.existsSync(path.dirname(checkPythonPath))) {
    fs.mkdirSync(path.dirname(checkPythonPath), { recursive: true });
  }
  
  fs.writeFileSync(checkPythonPath, 'print("Python OK")\n');
  
  try {
    if (os.platform() === 'win32') {
      execSync('python python/check_python.py', { stdio: 'inherit' });
    } else {
      execSync('python3 python/check_python.py', { stdio: 'inherit' });
    }
    console.log('Python is available! Visualization features will work.');
  } catch (err) {
    console.warn('Python not available or not in PATH. Visualization features will be limited.');
  }
} catch (error) {
  console.error('Error testing Python:', error.message);
}

// Make start.sh executable on Unix systems
if (os.platform() !== 'win32') {
  try {
    console.log('\nMaking start.sh executable...');
    execSync('chmod +x start.sh', { stdio: 'inherit' });
    console.log('start.sh is now executable.');
  } catch (error) {
    console.error('Failed to make start.sh executable:', error.message);
  }
}

// Generate sample data if needed
const dataPath = path.join(__dirname, 'data', 'feeds-data.csv');
const airQualityDataPath = path.join(__dirname, 'data', 'air_quality_data.csv');

if (!fs.existsSync(dataPath) && !fs.existsSync(airQualityDataPath)) {
  console.log('\nGenerating sample data for testing...');
  try {
    const sampleDataPath = path.join(__dirname, 'python', 'sample_data.py');
    if (!fs.existsSync(sampleDataPath)) {
      console.log('Creating sample_data.py script...');
      const sampleDataContent = `import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

def generate_sample_data():
    """Generate sample air quality data."""
    np.random.seed(42)
    end_date = datetime.now()
    start_date = end_date - timedelta(days=7)
    date_range = pd.date_range(start=start_date, end=end_date, freq='H')
    
    # Create data with correct field names matching the CSV structure
    data = {
        'created_at': date_range,
        'entry_id': range(1, len(date_range) + 1),
        'field1': np.random.uniform(30, 90, len(date_range)),    # humidity
        'field2': np.random.uniform(10, 35, len(date_range)),    # temperature
        'field3': np.random.uniform(5, 50, len(date_range)),     # pm2.5
        'field4': np.random.uniform(10, 100, len(date_range)),   # pm10
        'latitude': '',
        'longitude': '',
        'elevation': '',
        'status': ''
    }
    
    # Also add alternate column names for compatibility
    data['pm25'] = data['field3']
    data['pm10'] = data['field4']
    data['humidity'] = data['field1']
    data['temperature'] = data['field2']
    
    df = pd.DataFrame(data)
    os.makedirs('data', exist_ok=True)
    df.to_csv('data/feeds-data.csv', index=False)
    print(f"Generated {len(df)} sample records")
    
    # Also create a copy with the filename expected by the application
    df.to_csv('data/air_quality_data.csv', index=False)

if __name__ == "__main__":
    generate_sample_data()`;
      fs.writeFileSync(sampleDataPath, sampleDataContent);
    }
    
    if (os.platform() === 'win32') {
      execSync('python python/sample_data.py', { stdio: 'inherit' });
    } else {
      execSync('python3 python/sample_data.py', { stdio: 'inherit' });
    }
    console.log('Sample data generated successfully.');
  } catch (error) {
    console.error('Failed to generate sample data:', error.message);
  }
}

console.log('\nSetup completed!');
console.log('Run "npm start" or "node server.js" to start the application.');
console.log('For Unix systems, use "./start.sh" to launch the app.');
