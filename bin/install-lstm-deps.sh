#!/bin/bash

# LSTM Dependencies Installation Script

echo "Installing LSTM Model Dependencies..."
echo "This script will install Python dependencies required for LSTM model forecasting."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "pip3 is not installed. Please install pip3 first."
    exit 1
fi

# Install required Python packages
echo "Installing Python dependencies from requirements.txt..."
pip3 install -r requirements.txt

# Create necessary directories
echo "Creating model directories..."
mkdir -p python/models

echo "Installation complete!"
echo "You can now run the application with 'npm start' and access the LSTM dashboard at http://localhost:3000/lstm"
