/**
 * Test script to directly generate visualizations using Python
 */
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');

// Path to data file
const dataPath = path.join(__dirname, 'data', 'air_quality_data.csv');
const outputDir = path.join(__dirname, 'public', 'images');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Force clean existing visualization files to ensure fresh generation
console.log('Cleaning up any existing visualization images...');
['time_series.png', 'pm25_trend.png'].forEach(file => {
  const filePath = path.join(outputDir, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Deleted existing file: ${filePath}`);
    } catch (err) {
      console.error(`Failed to delete file ${filePath}:`, err);
    }
  }
});

// Check if data file exists
if (!fs.existsSync(dataPath)) {
  console.error(`Data file not found: ${dataPath}`);
  console.log('Generating sample data...');
  
  try {
    // Run sample data generation script
    const sampleDataOptions = {
      mode: 'text',
      pythonPath: 'python',
      scriptPath: path.join(__dirname, 'python')
    };
    
    PythonShell.run('sample_data.py', sampleDataOptions)
      .then(() => {
        console.log('Sample data generated, now running visualization test...');
        runVisualizationTest();
      })
      .catch(err => {
        console.error('Failed to generate sample data:', err);
        process.exit(1);
      });
  } catch (err) {
    console.error('Error running sample data script:', err);
    process.exit(1);
  }
} else {
  // Data file exists, proceed with visualization test
  runVisualizationTest();
}

function runVisualizationTest() {
  console.log('Running visualization test with Python...');
  console.log(`Data file: ${dataPath}`);
  console.log(`Output directory: ${outputDir}`);
  
  const options = {
    mode: 'json',
    pythonPath: 'python',  // Use default Python
    scriptPath: path.join(__dirname, 'python'),
    args: [dataPath],     // Pass data file path as argument
  };
  
  console.log('Starting Python process with script: analysis.py');
  console.log('Options:', JSON.stringify(options));
  
  PythonShell.run('analysis.py', options)
    .then(results => {
      console.log('\n===== Python Script Output =====');
      console.log(results);
      console.log('===============================\n');
      
      if (results && results.length > 0) {
        console.log('Analysis results:', results[0]);
        
        // Check if image files were created
        const timeSeriesPath = path.join(outputDir, 'time_series.png');
        const pm25TrendPath = path.join(outputDir, 'pm25_trend.png');
        
        console.log('\nChecking for generated image files:');
        if (fs.existsSync(timeSeriesPath)) {
          const stats = fs.statSync(timeSeriesPath);
          console.log(`✅ time_series.png exists (${stats.size} bytes)`);
        } else {
          console.log(`❌ time_series.png NOT found`);
        }
        
        if (fs.existsSync(pm25TrendPath)) {
          const stats = fs.statSync(pm25TrendPath);
          console.log(`✅ pm25_trend.png exists (${stats.size} bytes)`);
        } else {
          console.log(`❌ pm25_trend.png NOT found`);
        }
      } else {
        console.error('No results returned from Python script');
      }
    })
    .catch(err => {
      console.error('Error running Python script:', err);
    });
}
