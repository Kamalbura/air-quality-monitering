# Air Quality Monitoring System

A comprehensive web-based dashboard for monitoring, analyzing, and visualizing PM2.5 and PM10 particulate matter levels in real-time. This application interfaces with ThingSpeak IoT platform for data storage and retrieval, and provides advanced visualization and analysis features.

![Dashboard Preview](public/images/dashboard_preview.png)

## Features

- **Real-time Data Monitoring**: Live updates of air quality measurements
- **Comprehensive Dashboard**: User-friendly interface with key statistics and visualizations
- **Advanced Visualizations**: Time series, daily patterns, heatmaps, and correlation analysis
- **Data Analysis**: Statistical analysis of air quality trends
- **Flexible Data Sources**: ThingSpeak API integration with local CSV fallback
- **Responsive Design**: Works on desktop and mobile devices
- **Offline Capability**: Fallback to local data when cloud services are unavailable
- **Python-powered Visualizations**: Matplotlib/Seaborn for high-quality charts with JavaScript fallback

## Technologies Used

- **Backend**:
  - Node.js with Express
  - Python for advanced data analysis and visualization
  - RESTful API design
  
- **Frontend**:
  - Bootstrap 5 for responsive UI
  - Chart.js for client-side fallback visualizations
  - EJS templating
  
- **Data Management**:
  - ThingSpeak IoT platform integration
  - Local CSV storage
  - Node-Cache for optimization
  
- **Visualization Libraries**:
  - Matplotlib/Seaborn (Python)
  - Chart.js (JavaScript)

## Project Structure

```
air-quality-monitering/
├── data/                 # Local data storage directory
│   ├── air_quality_data.csv    # Primary data file for air quality measurements
│   └── feeds-data.csv          # Alternative format data backup
├── helpers/              # Helper modules for common functionality
│   ├── debug-helper.js         # Debugging utilities and logging functions
│   ├── diagnostic-helper.js    # Network and system diagnostic tools
│   ├── visualization-helper.js # Utilities for generating visualizations
│   ├── data-validator.js       # Data validation utilities (optional)
│   └── network-diagnostics.js  # Advanced network troubleshooting tools
├── iithyd/               # Arduino/ESP32 firmware for sensor nodes
│   └── iithyd.ino              # Main firmware code for the sensor hardware
├── logs/                 # Application log files
│   ├── debug.log               # General debugging information
│   ├── error.log               # Application error messages
│   └── diagnostic.log          # Network and API diagnostics
├── middleware/           # Express middleware components
│   ├── api-monitor.js          # API request monitoring and metrics
│   └── security-middleware.js  # Security-related middleware (optional)
├── public/               # Publicly accessible static files
│   ├── css/                    # CSS stylesheets
│   │   └── style.css           # Main application styles
│   ├── images/                 # Generated visualizations and static images
│   │   └── dashboard_preview.png # Preview image for README
│   └── js/                     # Client-side JavaScript
│       ├── config.js           # Client-side configuration
│       ├── dashboard.js        # Main dashboard functionality
│       ├── data-renderer.js    # Data rendering utilities
│       ├── fallback-viz.js     # Client-side visualization fallbacks
│       └── status.js           # System status page functionality
├── python/               # Python scripts for analysis and visualization
│   ├── analysis.py             # Data analysis script for statistics
│   ├── check_deps.py           # Python dependency checker
│   ├── correlation_large.py    # Memory-efficient correlation analysis for large datasets
│   ├── create_error_image.py   # Generates error images for visualization failures
│   ├── data_validator.py       # Validates data integrity and structure
│   ├── fix_encoding.py         # Fixes encoding issues in Python files
│   ├── sample_data.py          # Generates sample data for testing
│   ├── verify_data.py          # Verifies dataset integrity
│   └── visualization.py        # Main visualization generator
├── routes/               # Express route handlers
│   └── api.js                  # API endpoints implementation
├── services/             # Service modules for external integrations
│   ├── local-data-service.js   # Local CSV data provider service
│   └── thingspeak-service.js   # ThingSpeak API client service
├── sketch_mar5a/         # Alternative sensor firmware
│   └── sketch_mar5a/           # ESP8266/Arduino firmware files
├── views/                # EJS templates for rendering HTML
│   ├── dashboard.ejs           # Main dashboard view template
│   ├── error.ejs               # Error page template
│   └── status.ejs              # System status page template
├── .env                  # Environment variables (API keys, etc.)
├── error-handler.js      # Centralized application error handler
├── install.bat           # Installation script for Windows
├── making-report.py      # Script for generating project reports
├── package.json          # Node.js dependencies and scripts
├── requirements.txt      # Python dependencies
├── run.bat               # Application launcher for Windows
├── server.js             # Main application entry point
├── setup_dirs.bat        # Directory structure setup script
├── start.bat             # Simplified startup script
├── test.js               # Basic test script
├── test-thingspeak-connection.js # ThingSpeak connectivity tester
├── validate.js           # Dependency validation script
└── visualization_wrapper.js # JavaScript wrapper for Python visualizations
```

## File Descriptions

### Core Application Files

- **server.js**: The main entry point of the application. Initializes Express server, sets up middleware, and defines routes. Manages server startup with port selection and graceful shutdown.

- **package.json**: Defines Node.js dependencies, project metadata, and npm scripts for running, testing, and managing the application.

- **error-handler.js**: Centralized error handling mechanism that logs errors, creates error images when needed, and formats error responses consistently.

### Configuration Files

- **.env**: Stores environment variables including ThingSpeak API keys, channel IDs, and application settings. Not committed to version control for security.

- **requirements.txt**: Lists Python package dependencies including pandas, matplotlib, numpy, seaborn, and scikit-learn.

### Service Modules

- **services/thingspeak-service.js**: Handles all ThingSpeak API communication with enhanced error handling, rate limiting, and caching. Provides data retrieval, status checking, and data submission.

- **services/local-data-service.js**: Provides fallback data services using local CSV files when ThingSpeak is unavailable. Handles efficient streaming for large datasets.

### Helper Modules

- **helpers/debug-helper.js**: Provides debugging utilities including logging, data sampling, and operational tracking to help identify issues.

- **helpers/diagnostic-helper.js**: Tools for diagnosing network and API connectivity issues, particularly with ThingSpeak.

- **helpers/visualization-helper.js**: Manages the generation of visualizations, handling Python script execution, temporary file management, and caching.

- **helpers/network-diagnostics.js**: Advanced network diagnostics including DNS resolution, ping tests, and network interface information.

### Middleware

- **middleware/api-monitor.js**: Monitors API usage, tracks request counts, response times, and errors to help optimize performance.

- **middleware/security-middleware.js**: Optional security middleware for request validation, rate limiting, and other security measures.

### API Routes

- **routes/api.js**: Defines all RESTful API endpoints for data retrieval, visualization generation, system status, and cache management.

### Frontend JavaScript

- **public/js/dashboard.js**: Core dashboard functionality, managing user interactions, data loading, visualization display, and real-time updates.

- **public/js/data-renderer.js**: Utilities for rendering data tables and processing raw data for display.

- **public/js/fallback-viz.js**: Client-side fallback visualization using Chart.js when Python-generated visualizations are unavailable.

- **public/js/status.js**: Controls the system status page functionality including API endpoint testing and cache management.

- **public/js/config.js**: Client-side configuration with parameters for sampling rates, pagination settings, and feature flags.

## Python Scripts

All Python analysis scripts are located in the `python/` directory:

- `analysis.py` - Main analysis script that generates visualizations
  - Creates `time_series.png` and `pm25_trend.png` in public/images directory
  - Can be run with `--extended` flag to generate additional visualizations

To run manually:

- **python/visualization.py**: Core visualization generator that creates time series, daily patterns, heatmaps, and correlation plots.

- **python/analysis.py**: Performs statistical analysis on air quality data, calculating averages, maximums, and trends.

- **python/correlation_large.py**: Memory-efficient implementation of correlation analysis for very large datasets.

- **python/sample_data.py**: Generates sample air quality data for testing and demonstration purposes.

- **python/data_validator.py**: Validates data integrity, field mapping, and structure to ensure proper analysis.

### Views (Templates)

- **views/dashboard.ejs**: Main dashboard interface template with panels for visualizations, data tables, and controls.

- **views/status.ejs**: System status and diagnostic page template showing API health and performance metrics.

- **views/error.ejs**: Error page template for displaying user-friendly error messages.

### Hardware Firmware

- **iithyd/iithyd.ino**: ESP32-based firmware for the air quality monitoring node that reads sensors and uploads data to ThingSpeak.

- **sketch_mar5a/sketch_mar5a.ino**: Alternative firmware version for different hardware configurations.

### Utility Scripts

- **run.bat**: Windows batch script that sets up the environment, checks dependencies, and launches the application with optimized settings.

- **install.bat**: Installation script that installs Node.js and Python dependencies and sets up the directory structure.

- **validate.js**: Validates that all required dependencies are properly installed before running the application.

- **test-thingspeak-connection.js**: Tests connectivity to ThingSpeak API to verify configuration and network access.

## Data Flow

1. Sensor nodes collect PM2.5, PM10, temperature and humidity data
2. Data is sent to ThingSpeak via WiFi/Internet
3. The Node.js application retrieves data from ThingSpeak (or local CSV if unavailable)
4. Python scripts process the data for analysis and visualization
5. Results are displayed on the web dashboard via Express and EJS templates
6. Real-time updates are pushed to the UI when new data arrives

## Subsystems

- **Data Collection**: Hardware sensors and firmware
- **Data Storage**: ThingSpeak cloud platform and local CSV fallback
- **Data Processing**: Python analysis scripts and Node.js services
- **Visualization**: Python-generated plots with JavaScript fallbacks
- **Presentation**: Express web server and Bootstrap UI

