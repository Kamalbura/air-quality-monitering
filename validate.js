/**
 * Dependency Validation Script
 * This script checks if all required dependencies are installed properly
 */

console.log('Checking Node.js dependencies...');
const dependencies = [
  'express', 
  'ejs', 
  'csv-parser', 
  'multer', 
  'python-shell', 
  'cors', 
  'dotenv',
  'chart.js',
  'moment'
];

let hasErrors = false;

dependencies.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`✅ ${dep} is installed.`);
  } catch (e) {
    console.error(`❌ ${dep} is NOT installed. Run 'npm install' to fix.`);
    hasErrors = true;
  }
});

console.log('\nChecking Python dependencies...');
const { PythonShell } = require('python-shell');

PythonShell.run('python/check_deps.py', null, function (err, results) {
  if (err) {
    console.error('❌ Error checking Python dependencies:', err.message);
    console.error('Make sure Python is installed and in your PATH environment variable.');
  } else {
    results.forEach(line => console.log(line));
  }
  
  if (!hasErrors) {
    console.log('\nAll Node.js dependencies are installed correctly!');
    console.log('\nRun start.bat to launch the application.');
  }
});
