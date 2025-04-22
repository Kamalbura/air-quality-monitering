# Air Quality Monitoring System - Setup Guide

This document provides detailed instructions for setting up and running the Air Quality Monitoring System.

## Prerequisites

- **Node.js** (v14 or higher) - [Download from nodejs.org](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download from python.org](https://python.org/)
- **pip** (Python package manager)
- **Git** (optional) - For version control

## System Requirements

- **Memory**: 2GB RAM minimum (4GB recommended)
- **Storage**: 50MB for application, plus space for data storage
- **Network**: Internet connection for ThingSpeak API access

## Installation Options

### Option 1: Quick Automated Setup

For Windows:
```bash
# Clone the repository (if using Git)
git clone <your-repository-url>

# Navigate to the project directory
cd air-quality-monitering

# Run the setup script and install dependencies
setup.js
# OR
node setup.js
```

For Unix/Linux/Mac:
```bash
# Clone the repository (if using Git)
git clone <your-repository-url>

# Navigate to the project directory
cd air-quality-monitering

# Make the start script executable
chmod +x start.sh

# Run the setup script
node setup.js
```

### Option 2: Manual Setup

1. **Create project directories**:
   ```bash
   mkdir -p data logs public/images python services helpers routes middleware views
   ```

2. **Install Node.js dependencies**:
   ```bash
   npm install
   ```

3. **Install Python dependencies**:
   ```bash
   pip install pandas numpy matplotlib seaborn scikit-learn
   # OR
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   - Create a `.env` file with the following content:
   ```
   # ThingSpeak Configuration
   THINGSPEAK_CHANNEL_ID=your_channel_id
   THINGSPEAK_READ_API_KEY=your_read_api_key
   THINGSPEAK_WRITE_API_KEY=your_write_api_key

   # Application Settings
   PORT=3000
   NODE_ENV=development
   ```

## Running the Application

### Windows

Option 1: Using the batch file
```bash
start.bat
```

Option 2: Using Node.js directly
```bash
node server.js
```

### Unix/Linux/Mac

Option 1: Using the shell script
```bash
./start.sh
```

Option 2: Using Node.js directly
```bash
node server.js
```

## Cleaning Up Redundant Files

If you need to clean up redundant files:

Windows:
```bash
cleanup.bat
```

Unix/Linux/Mac:
```bash
# First make sure the script is executable
chmod +x cleanup.sh
./cleanup.sh
```

## Directory Structure

```
air-quality-monitering/
├── data/                  # CSV data storage
├── logs/                  # Application logs
├── public/                # Static assets
│   ├── css/               # CSS styles
│   ├── js/                # JavaScript files
│   └── images/            # Generated visualizations and images
├── python/                # Python scripts
│   ├── fetch_data.py      # Data fetching from ThingSpeak
│   ├── analyze.py         # Data analysis and visualization
│   └── run_analysis.py    # Combined runner script
├── services/              # Backend services
├── helpers/               # Helper functions
├── routes/                # Express routes
├── middleware/            # Express middleware
├── views/                 # EJS view templates
├── .env                   # Environment variables
├── package.json           # Node.js dependencies
├── requirements.txt       # Python dependencies
└── server.js              # Main application entry point
```

## Troubleshooting

### Python Issues

If you encounter Python-related errors:

1. Verify Python is in your PATH:
   ```bash
   python --version  # or python3 --version
   ```

2. Check if Python packages are installed:
   ```bash
   pip list  # or pip3 list
   ```

3. Make sure Python scripts are executable (Unix systems):
   ```bash
   chmod +x python/*.py
   ```

### Node.js Issues

1. Verify Node.js installation:
   ```bash
   node --version
   npm --version
   ```

2. Reinstall Node.js dependencies:
   ```bash
   rm -rf node_modules
   npm install
   ```

### ThingSpeak Connection Issues

1. Verify your internet connection
2. Check API keys in the `.env` file
3. Run the diagnostic tool:
   ```bash
   node helpers/network-diagnostics.js
   ```

For more assistance, please file an issue on the project repository.

## License

Copyright (c) 2023. All rights reserved.
