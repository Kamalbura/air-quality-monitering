# 🌬️ Air Quality Monitoring System

<div align="center">

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org/)
[![Express](https://img.shields.io/badge/Express-4.18+-lightgrey.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen.svg)]()

**A comprehensive real-time air quality monitoring system with IoT sensors, machine learning predictions, and interactive dashboards**

[Live Demo](#demo) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Hardware Setup](#hardware-setup)

</div>

---

## 🎯 What This Project Does

This system provides **real-time air quality monitoring** by collecting PM2.5 and PM10 particulate matter data from IoT sensors, analyzing it with machine learning, and presenting insights through interactive web dashboards.

### 🔑 Key Features
- **📊 Real-time monitoring** of PM2.5, PM10, temperature, and humidity
- **🤖 AI-powered predictions** using LSTM neural networks  
- **📱 Responsive web dashboard** with live charts and analytics
- **🔗 IoT integration** with ThingSpeak cloud platform
- **🏠 Local & cloud deployment** options with Docker support
- **📈 Historical analysis** and trend visualization
- **⚡ Real-time alerts** and data validation

---

## 🧠 Project Mind Map & Architecture

```
                    🌬️ AIR QUALITY MONITORING SYSTEM
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
         📡 HARDWARE              💾 DATA LAYER          🖥️ APPLICATION
              │                       │                       │
    ┌─────────┴─────────┐    ┌────────┴────────┐    ┌─────────┴─────────┐
    │                   │    │                 │    │                   │
🔧 ESP32/Arduino    📊 Sensors    🌐 ThingSpeak   💿 Local CSV    🚀 Node.js Server  📱 Web Dashboard
    │                   │    │                 │    │                   │
  WiFi Setup        PM2.5/PM10      Cloud API    Backup Data     Express Routes    Bootstrap UI
  Firmware          Temp/Humidity   Real-time    Data Storage    RESTful API       Chart.js
  Auto-upload       SDS011/AHT10    Storage      File System     WebSockets        Responsive
                                                                                   
              │                       │                       │
         🤖 INTELLIGENCE          🔧 PROCESSING          🚀 DEPLOYMENT
              │                       │                       │
    ┌─────────┴─────────┐    ┌────────┴────────┐    ┌─────────┴─────────┐
    │                   │    │                 │    │                   │
🧠 LSTM Models      📈 Analytics    🐍 Python Scripts  🔄 Data Pipeline   🐳 Docker         ☁️ Cloud Deploy
    │                   │    │                 │    │                   │
TensorFlow/PyTorch  Trend Analysis   Visualization    Background Jobs   Containerized     Vercel/Railway
Time Series         Statistical      Matplotlib/      Cron Tasks        Multi-stage       Auto-scaling
Forecasting         Calculations     Seaborn          Data Validation   Production        Load Balancing
```

---

## 🔄 Data Flow Diagram

```
   🔧 Hardware Sensors  →  🌐 ThingSpeak Cloud  →  🚀 Node.js Backend
        │                       │                       │
        ├─ PM2.5/PM10          ├─ API Endpoints         ├─ Data Processing
        ├─ Temperature         ├─ Channel Storage       ├─ Cache Management  
        └─ Humidity            └─ Real-time Feed        └─ Error Handling
                                       │                       │
                                       ↓                       ↓
   📱 Web Dashboard  ←  🤖 ML Predictions  ←  🐍 Python Analytics
        │                       │                       │
        ├─ Live Charts         ├─ LSTM Models          ├─ Statistical Analysis
        ├─ Historical Data     ├─ Forecasting          ├─ Trend Detection
        └─ Real-time Updates   └─ Pattern Recognition  └─ Visualization Generation
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ and **npm**
- **Python** 3.8+ with pip
- **Git** for cloning
- ThingSpeak account (optional, has local fallback)

### 1️⃣ Clone & Install
```bash
# Clone the repository
git clone https://github.com/Kamalbura/air-quality-monitering.git
cd air-quality-monitering

# Install Node.js dependencies
npm install

# Install Python dependencies  
pip install -r requirements.txt
```

### 2️⃣ Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit configuration (optional - works with defaults)
nano .env
```

### 3️⃣ Start the System
```bash
# Quick start (includes dependency checks)
npm start

# Or start development server with auto-reload
npm run dev
```

### 4️⃣ Access Dashboard
Open your browser to: **http://localhost:3000**

**🎉 That's it! Your air quality monitoring system is running!**

---

## 📚 System Components

### 🔧 Hardware Layer
**IoT Sensors & Microcontrollers**
- **ESP32/Arduino** boards with WiFi connectivity
- **SDS011** particulate matter sensor (PM2.5/PM10)
- **AHT10** temperature and humidity sensor
- **Auto-uploading firmware** with ThingSpeak integration

**Files:** `sketch_mar5a/`, `sketch_mar5b/`

### 🌐 Data Collection Layer  
**Cloud & Local Storage**
- **ThingSpeak IoT Platform** for cloud data storage
- **Local CSV files** as backup/offline mode
- **Real-time data streams** with automatic fallback
- **Data validation** and error handling

**Files:** `services/thingspeak-service.js`, `services/local-data-service.js`

### 🚀 Application Layer
**Node.js Backend Services**
- **Express.js server** with RESTful API
- **WebSocket support** for real-time updates  
- **Microservices architecture** with service modules
- **Caching system** for performance optimization
- **Error handling** and logging

**Files:** `server.js`, `routes/`, `services/`, `middleware/`

### 🤖 Machine Learning Layer
**AI-Powered Analytics**
- **LSTM neural networks** for time-series forecasting
- **TensorFlow/PyTorch** model implementations
- **Real-time predictions** via Python API
- **Model training** and optimization tools

**Files:** `python/lstm_api.py`, `python/model_manager.py`, `ml/`

### 📊 Visualization Layer
**Data Analysis & Charts**
- **Python-generated plots** (Matplotlib/Seaborn)
- **Interactive JavaScript charts** (Chart.js)
- **Real-time dashboard** with Bootstrap UI
- **Statistical analysis** and trend detection

**Files:** `python/visualization.py`, `public/js/`, `views/`

### 🐳 Deployment Layer
**Container & Cloud Ready**
- **Docker containerization** with multi-stage builds
- **Cloud deployment** configurations (Vercel, Railway)
- **Environment management** and secrets handling
- **Production optimization** and scaling

**Files:** `Dockerfile`, `docker-compose.yml`, `vercel.json`

---

## 🏗️ Project Structure

<details>
<summary>📁 <strong>Click to expand detailed file structure</strong></summary>

```
air-quality-monitering/
│
├── 🔧 HARDWARE & FIRMWARE
│   ├── sketch_mar5a/               # ESP32 firmware (main)
│   │   └── sketch_mar5a.ino        # Arduino code for sensors
│   └── sketch_mar5b/               # Alternative firmware
│       └── sketch_mar5b.ino        # ESP8266 variant
│
├── 🚀 BACKEND APPLICATION  
│   ├── server.js                   # Main application entry point
│   ├── startup.js                  # System initialization
│   ├── package.json               # Node.js dependencies & scripts
│   ├── routes/                     # API endpoints
│   │   ├── api.js                  # Main API routes
│   │   ├── api/                    # Specialized API modules
│   │   └── diagnostics-routes.js   # System diagnostics
│   ├── services/                   # Backend services
│   │   ├── thingspeak-service.js   # ThingSpeak API client
│   │   ├── local-data-service.js   # Local data management
│   │   ├── python-backend-service.js # Python ML integration
│   │   └── data-processing-service.js # Data processing
│   ├── middleware/                 # Express middleware
│   │   ├── api-monitor.js          # API monitoring
│   │   └── security-middleware.js  # Security features
│   └── helpers/                    # Utility modules
│       ├── debug-helper.js         # Debugging tools
│       ├── diagnostic-helper.js    # System diagnostics
│       └── visualization-helper.js # Chart generation
│
├── 🤖 MACHINE LEARNING
│   ├── python/                     # Python ML services
│   │   ├── lstm_api.py             # LSTM prediction API
│   │   ├── model_manager.py        # Model management
│   │   ├── visualization.py        # Data visualization
│   │   └── api/                    # ML API modules
│   ├── ml/                         # ML models & training
│   │   └── lstm-trainer.js         # Model training scripts
│   └── models/                     # Trained model files
│
├── 📱 FRONTEND APPLICATION
│   ├── views/                      # EJS templates
│   │   ├── dashboard.ejs           # Main dashboard
│   │   ├── status.ejs              # System status
│   │   ├── lstm-dashboard.ejs      # ML predictions view
│   │   └── config.ejs              # Configuration panel
│   └── public/                     # Static assets
│       ├── css/style.css           # Application styles  
│       ├── js/                     # Client-side JavaScript
│       │   ├── dashboard.js        # Dashboard functionality
│       │   ├── data-renderer.js    # Data visualization
│       │   └── config.js           # Client configuration
│       └── images/                 # Generated visualizations
│
├── 💾 DATA & CONFIGURATION
│   ├── data/                       # Data storage
│   │   ├── air_quality_data.csv    # Main dataset
│   │   └── feeds-data.csv          # Backup data
│   ├── config/                     # Configuration files
│   ├── logs/                       # Application logs
│   ├── .env.example               # Environment template
│   └── requirements.txt           # Python dependencies
│
├── 🐳 DEPLOYMENT
│   ├── Dockerfile                 # Container configuration
│   ├── docker-compose.yml         # Multi-container setup
│   ├── vercel.json               # Vercel deployment
│   └── DEPLOYMENT.md             # Deployment guide
│
└── 📖 DOCUMENTATION
    ├── README.md                  # This file
    ├── ANALYSIS_REPORT.md         # Code analysis
    ├── SETUP.md                   # Setup instructions
    └── IMPLEMENTATION_COMPLETE.md # Implementation notes
```

</details>

---

## 🔧 Hardware Setup

### Required Components
- **ESP32** or **Arduino with WiFi** (NodeMCU, Wemos D1)
- **SDS011** laser PM2.5/PM10 sensor
- **AHT10** temperature/humidity sensor  
- Jumper wires and breadboard
- USB cable for programming

### Wiring Diagram
```
ESP32          SDS011 Sensor      AHT10 Sensor
GPIO14    →    RX (Yellow)        
GPIO12    →    TX (Blue)          
3.3V      →    VCC (Red)          VCC
GND       →    GND (Black)        GND
GPIO21    →                      SDA
GPIO22    →                      SCL
```

### Firmware Installation
1. **Install Arduino IDE** with ESP32 board support
2. **Add required libraries:**
   - WiFi (built-in)
   - ThingSpeak by MathWorks
   - Adafruit AHTX0
   - SDS011 sensor library
3. **Configure WiFi credentials** in `sketch_mar5a.ino`
4. **Upload firmware** to your ESP32 board

### Sensor Calibration
- Allow **15 minutes warm-up** for accurate readings
- Place sensor **away from direct airflow**
- **Outdoor deployment** requires weatherproof enclosure

---

## 🌐 API Documentation

### Core Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/api/latest` | Latest sensor readings | Real-time data |
| `GET` | `/api/historical` | Historical dataset | Time-series data |
| `GET` | `/api/stats` | Statistical summary | Analytics |
| `GET` | `/api/health` | System health check | Status info |
| `GET` | `/api/predictions` | ML forecasts | LSTM predictions |
| `POST` | `/api/refresh` | Manual data refresh | Status update |

### Data Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "pm25": 15.2,
  "pm10": 22.1, 
  "temperature": 24.5,
  "humidity": 60.2,
  "quality_index": "Good"
}
```

### WebSocket Events
- `data-update` - New sensor readings
- `prediction-update` - ML forecast updates
- `system-alert` - Error notifications

---

## 🚀 Deployment Options

### 🐳 Docker Deployment (Recommended)
```bash
# Build and run with Docker Compose
docker-compose up --build

# Access at http://localhost:3000
```

### ☁️ Cloud Deployment

**Vercel (Frontend + API)**
```bash
npm run deploy:vercel
```

**Railway (Full Stack)**
```bash
railway login
railway deploy
```

**Heroku (Full Stack)**
```bash
heroku create your-app-name
git push heroku main
```

### 🖥️ Local Development
```bash
# Start development server
npm run dev

# Start with debugging
DEBUG=* npm start

# Run Python services separately
cd python && python lstm_api.py
```

---

## 🔍 Monitoring & Analytics

### System Health Dashboard
Access **http://localhost:3000/status** for:
- ✅ API endpoint health
- 📊 Performance metrics  
- 🔄 Cache statistics
- 🌐 ThingSpeak connectivity
- 💾 Database status

### Available Analytics
- **Air Quality Index (AQI)** calculations
- **Trend analysis** and pattern detection
- **Correlation studies** between environmental factors
- **Predictive modeling** with confidence intervals
- **Comparative analysis** across time periods

### Visualization Types
- 📈 **Time series plots** for trend analysis
- 🗓️ **Daily/weekly patterns** with heatmaps
- 🔗 **Correlation matrices** for factor relationships
- 🎯 **Forecast charts** with uncertainty bands
- 📊 **Statistical summaries** and distributions

---

## 🛠️ Development Guide

### Development Setup
```bash
# Clone and setup
git clone <repo-url>
cd air-quality-monitering

# Install dependencies
npm install
pip install -r requirements.txt

# Setup environment
cp .env.example .env

# Start development
npm run dev
```

### Code Structure Guidelines
- **Services**: Business logic in `services/`
- **Routes**: API endpoints in `routes/`
- **Middleware**: Request processing in `middleware/`
- **Views**: EJS templates in `views/`
- **Public**: Static assets in `public/`

### Testing
```bash
# Run basic tests
npm test

# Test ThingSpeak connection
node test-thingspeak-connection.js

# Validate system dependencies
npm run validate
```

### Adding New Features
1. **Backend**: Add service in `services/`, route in `routes/`
2. **Frontend**: Add JavaScript in `public/js/`, template in `views/`
3. **ML Models**: Add Python script in `python/`, integrate via API
4. **Sensors**: Modify firmware in `sketch_mar5a/`

---

## 🤝 Contributing

We welcome contributions! Please see our guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Standards
- Follow **ESLint** configuration for JavaScript
- Use **PEP 8** for Python code
- Write **clear commit messages**
- Add **tests** for new features
- Update **documentation** as needed

---

## 📖 Additional Resources

### Documentation
- 📚 [Complete Setup Guide](SETUP.md)
- 🚀 [Deployment Instructions](DEPLOYMENT.md)  
- 🔍 [Code Analysis Report](ANALYSIS_REPORT.md)
- ⚡ [Implementation Details](IMPLEMENTATION_COMPLETE.md)

### External Links
- 🌐 [ThingSpeak Documentation](https://thingspeak.com/docs)
- 🤖 [TensorFlow Guides](https://tensorflow.org/tutorials)
- 📊 [Chart.js Documentation](https://chartjs.org/docs/)
- 🔧 [Arduino ESP32 Guide](https://docs.espressif.com/projects/arduino-esp32/)

### Support
- 💬 [GitHub Issues](../../issues) for bug reports
- 💡 [GitHub Discussions](../../discussions) for questions
- 📧 Email: [your-email@example.com](mailto:your-email@example.com)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **ThingSpeak** for IoT platform services
- **ESP32/Arduino** community for hardware support  
- **TensorFlow** team for ML framework
- **Chart.js** for visualization library
- **Bootstrap** for responsive UI framework
- **Node.js & Express** communities

---

<div align="center">

**🌬️ Made with ❤️ for cleaner air and better environmental monitoring**

[![GitHub stars](https://img.shields.io/github/stars/Kamalbura/air-quality-monitering.svg?style=social&label=Star)](https://github.com/Kamalbura/air-quality-monitering)
[![GitHub forks](https://img.shields.io/github/forks/Kamalbura/air-quality-monitering.svg?style=social&label=Fork)](https://github.com/Kamalbura/air-quality-monitering/fork)

</div>