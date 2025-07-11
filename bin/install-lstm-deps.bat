@echo off
echo Installing LSTM Model Dependencies...
echo This script will install Python dependencies required for LSTM model forecasting.

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Python is not installed or not in PATH. Please install Python first.
    exit /b 1
)

REM Check if pip is available
python -m pip --version >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo pip is not installed. Please install pip first.
    exit /b 1
)

REM Install required packages
echo Installing Python dependencies from requirements.txt...
python -m pip install -r requirements.txt

REM Create necessary directories
echo Creating model directories...
if not exist "python\models" mkdir python\models

echo Installation complete!
echo You can now run the application with 'npm start' and access the LSTM dashboard at http://localhost:3000/lstm
pause
