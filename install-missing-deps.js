/**
 * Quick installation script for missing dependencies
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Installing Missing Dependencies ===');

// Define the dependencies to check and install if missing
const dependencies = ['simple-statistics', 'danfojs-node'];

// Fix package.json if it has syntax errors
const packageJsonPath = path.join(__dirname, 'package.json');
try {
  // Try to read and parse the package.json file
  let packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  
  // Check for common syntax errors
  if (packageJsonContent.includes(',,')) {
    console.log('Fixing double commas in package.json...');
    packageJsonContent = packageJsonContent.replace(/,\s*,/g, ',');
  }
  
  // Parse to check validity and reformat
  const packageJson = JSON.parse(packageJsonContent);
  
  // Write back the fixed and formatted package.json
  fs.writeFileSync(
    packageJsonPath, 
    JSON.stringify(packageJson, null, 2),
    'utf8'
  );
  console.log('✅ package.json syntax fixed successfully.');
} catch (err) {
  console.error('❌ Error fixing package.json:', err.message);
  console.log('Please fix the package.json file manually before continuing.');
  process.exit(1);
}

// Check each dependency
for (const dep of dependencies) {
  console.log(`Checking for ${dep}...`);
  try {
    require.resolve(dep);
    console.log(`✅ ${dep} is already installed.`);
  } catch (e) {
    console.log(`⚠️ ${dep} is not installed. Installing now...`);
    try {
      execSync(`npm install ${dep}`, { stdio: 'inherit' });
      console.log(`✅ Successfully installed ${dep}.`);
    } catch (installError) {
      console.error(`❌ Error installing ${dep}: ${installError.message}`);
      console.error(`Please try running "npm install ${dep}" manually.`);
    }
  }
}

// Also check and update package.json if needed
try {
  const packageJson = require(packageJsonPath);
  let updated = false;
  
  // Check and update dependencies section
  if (!packageJson.dependencies) packageJson.dependencies = {};
  for (const dep of dependencies) {
    if (!packageJson.dependencies[dep]) {
      // Use appropriate version for each dependency
      if (dep === 'simple-statistics') {
        packageJson.dependencies[dep] = "^7.8.3";
      } else if (dep === 'danfojs-node') {
        packageJson.dependencies[dep] = "^1.1.2";
      } else {
        packageJson.dependencies[dep] = "latest";
      }
      updated = true;
    }
  }
  
  if (updated) {
    console.log('Updating package.json with missing dependencies...');
    fs.writeFileSync(
      packageJsonPath, 
      JSON.stringify(packageJson, null, 2),
      'utf8'
    );
    console.log('✅ package.json updated successfully.');
  }
  
  console.log('\n✅ All done! You can now run "npm run dev" to start the application.');
  
} catch (fileError) {
  console.error('❌ Error updating package.json:', fileError.message);
}
