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
  const baseFilename = path.basename(filename, path.extname(filename));
  
  try {
    // More thorough check for references
    const searchPatterns = [
      `require.*${baseFilename}`,
      `import.*${baseFilename}`,
      `from.*${baseFilename}`,
      `src=.*${baseFilename}`,
      `href=.*${baseFilename}`
    ];
    
    const pattern = searchPatterns.join('\\|');
    const isWindows = process.platform === 'win32';
    
    const command = isWindows 
      ? `findstr /s /i /m "${pattern}" *.js *.ejs *.html *.css`
      : `grep -r "${pattern}" --include="*.js" --include="*.ejs" --include="*.html" --include="*.css" .`;
      
    execSync(command, { stdio: 'pipe' });
    return true;
  } catch (error) {
    // If grep/findstr returns non-zero exit code, file is likely not referenced
    return false;
  }
}

// List of files that are candidates for the dump folder
const filesToAnalyze = [
  // Duplicate or potentially obsolete visualization helpers
  'helpers/js-visualization-helper.js',
  
  // Python scripts if JS alternatives exist
  'python/analysis.py',
  'python/create_error_image.py',
  'python/fix_encoding.py',
  
  // Test and debug files
  'debug-visualization.js',
  'test-visualization.js',
  'test-visualizations.js',
  'test-thingspeak-connection.js',
  'test.js',
  'making-report.py',
  
  // Deprecated firmware or setup scripts
  'sketch_mar5a/sketch_mar5a.ino',
  'setup_dirs.bat',
  'run.bat',
  'install.bat',
  
  // Redundant configuration files
  'create-dump-folder.js', // Now redundant with this script
  
  // Potentially unused service implementations
  'visualization_wrapper.js',
];

// Directories to check - automatically scan these for unused files
const directoriesToScan = [
  'helpers',
  'public/js',
  'public/css',
  'services',
  'python'
];

// Files that should never be moved to dump (protect critical files)
const protectedFiles = [
  'server.js',
  'package.json',
  'package-lock.json',
  'setup.js',
  'organize-files.js',
  'routes/api.js',
  'public/js/dashboard.js',
  'public/css/style.css',
  'helpers/debug-helper.js',
  'helpers/analysis-helper.js'
];

console.log('Scanning for unused files...');

// Find all JavaScript and Python files in specified directories
let additionalFilesToCheck = [];
directoriesToScan.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    try {
      const files = fs.readdirSync(dirPath);
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        if (stats.isFile() && (file.endsWith('.js') || file.endsWith('.py'))) {
          const relativePath = path.relative(__dirname, filePath).replace(/\\/g, '/');
          // Don't add if it's already in filesToAnalyze or protectedFiles
          if (!filesToAnalyze.includes(relativePath) && 
              !protectedFiles.includes(relativePath) &&
              !protectedFiles.includes(file)) {
            additionalFilesToCheck.push(relativePath);
          }
        }
      });
    } catch (err) {
      console.error(`Error scanning directory ${dir}: ${err.message}`);
    }
  }
});

// Combine the manually specified files with automatically found ones
const allFilesToCheck = [...filesToAnalyze, ...additionalFilesToCheck];

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
let protectedCount = 0;

allFilesToCheck.forEach(relativeFilePath => {
  const filePath = path.join(__dirname, relativeFilePath);
  const fileName = path.basename(filePath);
  const dumpPath = path.join(dumpDir, fileName);
  
  // Check if it's a protected file
  if (protectedFiles.includes(relativeFilePath) || protectedFiles.includes(fileName)) {
    console.log(`Protected file: ${relativeFilePath}`);
    protectedCount++;
    return;
  }
  
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
        // Create backup version with timestamp to prevent name conflicts
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(dumpDir, `${fileName}.${timestamp}.bak`);
        
        // Read the original file
        const fileContent = fs.readFileSync(filePath);
        
        // Write to the dump location
        fs.writeFileSync(backupPath, fileContent);
        
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
console.log(`- ${protectedCount} files protected from moving`);

// Clean up empty directories
console.log('\nChecking for empty directories...');
const checkEmptyDirs = (dir) => {
  if (!fs.existsSync(dir)) return;
  
  const items = fs.readdirSync(dir);
  
  // Skip node_modules, .git directories and the dump directory
  if (dir.includes('node_modules') || dir.includes('.git') || dir === dumpDir) return;
  
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
