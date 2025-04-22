/**
 * Enhanced script to identify and organize unused files
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create dump directory if it doesn't exist
const dumpDir = path.join(__dirname, 'dump');
if (!fs.existsSync(dumpDir)) {
  fs.mkdirSync(dumpDir, { recursive: true });
  console.log(`Created dump directory at ${dumpDir}`);
}

// Function to check if a file is imported or required anywhere in the codebase
function isFileReferenced(filename) {
  // Get base filename without extension
  const baseFilename = path.basename(filename, path.extname(filename));
  
  try {
    // Search for imports or requires of this file in the codebase
    // Using grep on Unix or findstr on Windows
    const isWindows = process.platform === 'win32';
    const command = isWindows 
      ? `findstr /s /i /m "require.*${baseFilename}|import.*${baseFilename}" *.js`
      : `grep -r "require.*${baseFilename}\\|import.*${baseFilename}" --include="*.js" .`;
      
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    // If grep/findstr returns non-zero exit code, file is likely not referenced
    return false;
  }
}

// List of files that are candidates for the dump folder
const filesToAnalyze = [
  // Debug and test files
  'debug-visualization.js',
  'test-visualization.js',
  'test-visualizations.js',
  
  // Potentially duplicate visualization helpers
  'helpers/js-visualization-helper.js',
  
  // Python scripts if JS alternatives exist
  'python/analysis.py',
  
  // Other potential unused files
  'visualization_wrapper.js',
  'making-report.py',
  'sketch_mar5a/sketch_mar5a.ino',
  'setup_dirs.bat',
  'run.bat',
  'install.bat',
  'test.js',
  'test-thingspeak-connection.js'
];

// Check for required directories
const requiredDirectories = [
  'data',
  'public/images',
  'logs',
  'dump/data-archive'
];

// Ensure required directories exist
requiredDirectories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created required directory: ${dir}`);
  }
});

// Move files to dump with additional checks
let movedCount = 0;
let skippedCount = 0;
let notFoundCount = 0;

filesToAnalyze.forEach(relativeFilePath => {
  const filePath = path.join(__dirname, relativeFilePath);
  const fileName = path.basename(filePath);
  const dumpPath = path.join(dumpDir, fileName);
  
  // Only proceed if file exists
  if (fs.existsSync(filePath)) {
    try {
      // For JS and Python files, check if they're referenced
      const ext = path.extname(filePath).toLowerCase();
      let shouldMove = false;
      
      if (['.js', '.py'].includes(ext)) {
        const isReferenced = isFileReferenced(filePath);
        shouldMove = !isReferenced;
        
        if (isReferenced) {
          console.log(`Skipping ${relativeFilePath}: File is referenced in the codebase`);
          skippedCount++;
          return;
        }
      } else {
        // For other file types, move without checking references
        shouldMove = true;
      }
      
      if (shouldMove) {
        // Read the original file
        const fileContent = fs.readFileSync(filePath);
        
        // Write to the new location
        fs.writeFileSync(dumpPath, fileContent);
        
        // Delete the original file
        fs.unlinkSync(filePath);
        
        console.log(`Moved ${relativeFilePath} to dump folder`);
        movedCount++;
      }
    } catch (err) {
      console.error(`Error processing ${relativeFilePath}: ${err.message}`);
    }
  } else {
    console.log(`File not found: ${relativeFilePath}`);
    notFoundCount++;
  }
});

console.log(`\nOperation complete:`);
console.log(`- ${movedCount} files moved to dump folder`);
console.log(`- ${skippedCount} files skipped (are referenced in codebase)`);
console.log(`- ${notFoundCount} files not found`);

// Clean up empty directories
console.log('\nChecking for empty directories...');
const checkEmptyDirs = (dir) => {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  
  // Skip node_modules and .git directories
  if (dir.includes('node_modules') || dir.includes('.git')) return;
  
  if (items.length === 0) {
    console.log(`Removing empty directory: ${dir}`);
    fs.rmdirSync(dir);
    return;
  }
  
  // Recursively check subdirectories
  for (const item of items) {
    const itemPath = path.join(dir, item);
    if (fs.statSync(itemPath).isDirectory()) {
      checkEmptyDirs(itemPath);
    }
  }
  
  // Check again after processing subdirectories
  const remainingItems = fs.readdirSync(dir);
  if (remainingItems.length === 0) {
    console.log(`Removing empty directory: ${dir}`);
    fs.rmdirSync(dir);
  }
};

checkEmptyDirs(__dirname);
console.log('Directory cleanup completed!');
