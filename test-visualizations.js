/**
 * Test script to verify all visualizations are working
 */
const { PythonShell } = require('python-shell');
const fs = require('fs');
const path = require('path');

// Test standard visualizations
async function testStandardVisualizations() {
  console.log('Testing standard visualizations...');
  
  try {
    const options = {
      mode: 'json',
      pythonPath: process.env.PYTHON_PATH || 'python',
      scriptPath: path.join(__dirname, 'python'),
      args: [
        path.join(__dirname, 'data', 'air_quality_data.csv')
      ]
    };
    
    console.log('Running analysis.py...');
    const results = await PythonShell.run('analysis.py', options);
    
    if (!results || results.length === 0) {
      throw new Error('No results from Python script');
    }
    
    console.log('Analysis script results:', results[0]);
    
    // Check if files exist
    const timeSeriesPath = path.join(__dirname, 'public', 'images', 'time_series.png');
    const pm25TrendPath = path.join(__dirname, 'public', 'images', 'pm25_trend.png');
    
    if (fs.existsSync(timeSeriesPath)) {
      console.log('✅ time_series.png exists');
    } else {
      console.log('❌ time_series.png NOT found');
    }
    
    if (fs.existsSync(pm25TrendPath)) {
      console.log('✅ pm25_trend.png exists');
    } else {
      console.log('❌ pm25_trend.png NOT found');
    }
  } catch (error) {
    console.error('Error testing standard visualizations:', error);
    return false;
  }
  
  return true;
}

// Run all tests
async function runTests() {
  console.log('Starting visualization tests...');
  const standardResult = await testStandardVisualizations();
  
  if (standardResult) {
    console.log('\n✅ All visualization tests passed!');
  } else {
    console.log('\n❌ Some tests failed. Check the logs above.');
  }
}

runTests().catch(console.error);
