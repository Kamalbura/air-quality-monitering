/**
 * Thorough debugging script for visualizations
 * This script will show verbose output at every step to help diagnose issues
 */
const { PythonShell } = require('python-shell');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('=== VISUALIZATION DEBUGGING SCRIPT ===');
console.log('Current directory:', __dirname);
console.log('Node.js version:', process.version);

// Define paths with absolute values
const dataPath = path.join(__dirname, 'data', 'air_quality_data.csv');
const outputDir = path.join(__dirname, 'public', 'images');
const pythonDir = path.join(__dirname, 'python');
const analysisScript = path.join(pythonDir, 'analysis.py');

console.log('\n=== PATH INFORMATION ===');
console.log('Data path:', dataPath);
console.log('Output directory:', outputDir);
console.log('Python directory:', pythonDir);
console.log('Analysis script:', analysisScript);

// Check if directories exist
console.log('\n=== DIRECTORY CHECKS ===');
console.log(`Data directory exists: ${fs.existsSync(path.dirname(dataPath))}`);
console.log(`Output directory exists: ${fs.existsSync(outputDir)}`);
console.log(`Python directory exists: ${fs.existsSync(pythonDir)}`);

// Create output directory if missing
if (!fs.existsSync(outputDir)) {
  console.log('Creating output directory...');
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log('Output directory created successfully');
  } catch (err) {
    console.error('ERROR creating output directory:', err);
  }
}

// Check if files exist
console.log('\n=== FILE CHECKS ===');
console.log(`Data file exists: ${fs.existsSync(dataPath)}`);
if (fs.existsSync(dataPath)) {
  const stats = fs.statSync(dataPath);
  console.log(`Data file size: ${stats.size} bytes`);
  console.log(`Data file modified: ${stats.mtime}`);
  
  // Check first few lines of the data file
  console.log('\n=== DATA FILE PREVIEW ===');
  try {
    const fileContent = fs.readFileSync(dataPath, 'utf8');
    const lines = fileContent.split('\n').slice(0, 5);
    console.log(lines.join('\n'));
  } catch (err) {
    console.error('ERROR reading data file:', err);
  }
}

console.log(`Analysis script exists: ${fs.existsSync(analysisScript)}`);
if (fs.existsSync(analysisScript)) {
  const stats = fs.statSync(analysisScript);
  console.log(`Script size: ${stats.size} bytes`);
  console.log(`Script modified: ${stats.mtime}`);
}

// Check Python installation
console.log('\n=== PYTHON ENVIRONMENT CHECK ===');
try {
  const pythonVersionCmd = 'python --version';
  const pythonVersion = execSync(pythonVersionCmd).toString().trim();
  console.log('Python version:', pythonVersion);
  
  // Check Python modules
  console.log('\nChecking required Python modules:');
  ['pandas', 'numpy', 'matplotlib'].forEach(module => {
    try {
      execSync(`python -c "import ${module}; print('${module} version:', ${module}.__version__)"`)
        .toString().trim().split('\n').forEach(line => console.log(line));
    } catch (err) {
      console.error(`ERROR: ${module} not installed or failed to import`);
    }
  });
} catch (err) {
  console.error('ERROR checking Python:', err.message);
}

// Clean existing visualization files
console.log('\n=== CLEANING EXISTING VISUALIZATIONS ===');
['time_series.png', 'pm25_trend.png'].forEach(file => {
  const filePath = path.join(outputDir, file);
  console.log(`Checking for ${filePath}...`);
  if (fs.existsSync(filePath)) {
    try {
      console.log(`Deleting ${filePath}...`);
      fs.unlinkSync(filePath);
      console.log(`Deleted successfully.`);
    } catch (err) {
      console.error(`ERROR deleting ${filePath}:`, err);
    }
  } else {
    console.log(`${file} doesn't exist, nothing to clean.`);
  }
});

// Create sample data if needed
if (!fs.existsSync(dataPath)) {
  console.log('\n=== GENERATING SAMPLE DATA ===');
  try {
    console.log('Running sample_data.py...');
    execSync(`python ${path.join(pythonDir, 'sample_data.py')}`, { stdio: 'inherit' });
  } catch (err) {
    console.error('ERROR generating sample data:', err);
  }
}

// Run Python visualization script
console.log('\n=== RUNNING PYTHON ANALYSIS SCRIPT ===');
const options = {
  mode: 'text',  // Use text mode to see all output
  pythonPath: 'python',
  scriptPath: pythonDir,
  args: [dataPath],
  pythonOptions: ['-u'] // Unbuffered output
};

console.log('PythonShell options:', JSON.stringify(options, null, 2));
console.log('\nStarting Python process...');

// Run Python with PythonShell
PythonShell.run('analysis.py', options)
  .then(results => {
    console.log('\n=== PYTHON SCRIPT OUTPUT ===');
    if (results && results.length > 0) {
      results.forEach(line => console.log(line));
    } else {
      console.log('No output from Python script');
    }
    
    // Check for generated files
    console.log('\n=== CHECKING GENERATED FILES ===');
    ['time_series.png', 'pm25_trend.png'].forEach(file => {
      const filePath = path.join(outputDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} exists (${stats.size} bytes) - Modified ${stats.mtime}`);
      } else {
        console.log(`❌ ${file} NOT found`);
      }
    });
  })
  .catch(err => {
    console.error('\n=== PYTHON SCRIPT ERROR ===');
    console.error(err);
  })
  .finally(() => {
    console.log('\n=== DEBUGGING COMPLETE ===');
  });

// Also try a direct Python execution as an alternative test
console.log('\n=== TRYING DIRECT PYTHON EXECUTION ===');
try {
  // Use execSync to directly run the Python script
  console.log('Running Python directly with execSync...');
  const output = execSync(`python "${analysisScript}" "${dataPath}"`, { 
    encoding: 'utf8',
    timeout: 30000  // 30 second timeout
  });
  console.log('Direct Python output:');
  console.log(output);
} catch (err) {
  console.error('ERROR running Python directly:', err.message);
  if (err.stdout) console.log('stdout:', err.stdout);
  if (err.stderr) console.error('stderr:', err.stderr);
}

console.log('\n=== END OF DEBUGGING SCRIPT ===');
