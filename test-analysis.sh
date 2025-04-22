#!/bin/bash
echo "Testing Python analysis script and visualization paths..."

# Run analysis script
echo "Running analysis.py..."
python python/analysis.py

# Check if visualizations were generated
if [ -f "public/images/time_series.png" ]; then
  echo "✅ time_series.png generated successfully"
else
  echo "❌ time_series.png not found!"
fi

if [ -f "public/images/pm25_trend.png" ]; then
  echo "✅ pm25_trend.png generated successfully"
else
  echo "❌ pm25_trend.png not found!"
fi

# Test wrapper scripts
echo "Testing analisis.py wrapper..."
python analisis.py

echo "Testing analisis2.py wrapper..."
python analisis2.py

echo "Testing complete"
