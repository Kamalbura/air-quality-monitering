/**
 * Comprehensive repository cleanup script
 * - Runs code organization
 * - Identifies duplicate functionality
 * - Checks for unused dependencies
 * - Validates file references
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Air Quality Monitoring Repository Cleanup ===');

// Function to run a command and return the output
function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error.message);
    return '';
  }
}

// Run organize-files.js to clean up unused files
console.log('\n1. Organizing Files');
console.log('-------------------');
try {
  runCommand('node organize-files.js');
  console.log('File organization completed successfully.');
} catch (error) {
  console.error('File organization failed:', error.message);
}

// Check for unused npm dependencies
console.log('\n2. Checking Unused Dependencies');
console.log('-----------------------------');
try {
  console.log('Analyzing package.json dependencies...');
  
  // Get package.json dependencies
  const packageJson = require('./package.json');
  const dependencies = Object.keys(packageJson.dependencies || {});
  
  // Check for each dependency in files
  for (const dep of dependencies) {
    // Skip some common dependencies that might be used indirectly
    if (['express', 'dotenv', 'cors', 'compression'].includes(dep)) {
      console.log(`✓ ${dep} (core dependency, skipping check)`);
      continue;
    }
    
    // Search for the dependency in the codebase
    const searchCommand = process.platform === 'win32'
      ? `findstr /s /i /m "require.*${dep}\\|import.*${dep}" *.js`
      : `grep -r "require('${dep}'\\|require(\\"${dep}\\"" --include="*.js" .`;
    
    try {
      execSync(searchCommand, { stdio: 'pipe' });
      console.log(`✓ ${dep} (in use)`);
    } catch (err) {
      console.log(`⚠ ${dep} might not be used. Consider removing it if not needed.`);
    }
  }
} catch (error) {
  console.error('Dependency check failed:', error.message);
}

// Check for potential duplicate functionality
console.log('\n3. Checking for Duplicate Functionality');
console.log('------------------------------------');

const functionalGroups = [
  {
    name: 'Visualization Helpers',
    patterns: ['createChart', 'render', 'visualization', 'chart'],
    files: []
  },
  {
    name: 'ThingSpeak Services',
    patterns: ['thingspeak', 'getChannelData', 'api', 'getData'],
    files: []
  },
  {
    name: 'Data Processing',
    patterns: ['process', 'calculate', 'analyze', 'validateData'],
    files: []
  },
  {
    name: 'CSV Handling',
    patterns: ['csv', 'parse', 'export'],
    files: []
  }
];

// Scan the codebase for files that might have duplicate functionality
const scanDirectory = (dir) => {
  if (!fs.existsSync(dir) || dir.includes('node_modules') || dir.includes('.git') || dir.includes('dump')) {
    return;
  }
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      scanDirectory(itemPath);
    } else if (stats.isFile() && (item.endsWith('.js') || item.endsWith('.ts'))) {
      try {
        const content = fs.readFileSync(itemPath, 'utf8');
        const relativePath = path.relative(__dirname, itemPath).replace(/\\/g, '/');
        
        for (const group of functionalGroups) {
          for (const pattern of group.patterns) {
            if (content.toLowerCase().includes(pattern.toLowerCase())) {
              if (!group.files.includes(relativePath)) {
                group.files.push(relativePath);
              }
              break;
            }
          }
        }
      } catch (err) {
        console.error(`Error reading file ${itemPath}: ${err.message}`);
      }
    }
  }
};

// Start the scan
scanDirectory(__dirname);

// Report potential duplicates
for (const group of functionalGroups) {
  if (group.files.length > 1) {
    console.log(`\nPotential duplicate ${group.name} functionality in:`);
    group.files.forEach(file => console.log(`- ${file}`));
  } else {
    console.log(`\n✓ No duplicates found for ${group.name}`);
  }
}

// Verify project integrity
console.log('\n4. Verifying Project Integrity');
console.log('----------------------------');

// Check critical files exist
const criticalFiles = [
  'server.js',
  'package.json',
  'routes/api.js',
  'public/js/dashboard.js',
  'views/dashboard.ejs'
];

let missingCriticalFiles = false;
for (const file of criticalFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Critical file missing: ${file}`);
    missingCriticalFiles = true;
  }
}

if (!missingCriticalFiles) {
  console.log('✓ All critical files are present');
}

console.log('\nRepository cleanup and analysis completed!');
console.log('\nRecommendations:');
console.log('1. Run the application to verify it works correctly after cleanup');
console.log('2. Check the dump folder for any files that may have been moved incorrectly');
console.log('3. Review duplicate functionality areas for potential consolidation');
