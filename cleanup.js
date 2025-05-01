/**
 * Repository cleanup utility
 * Creates a dump folder and moves unwanted files
 */
const fs = require('fs');
const path = require('path');

// Create dump folder structure
const dumpFolderPath = path.join(__dirname, 'dump');
const dumpFolderServices = path.join(dumpFolderPath, 'services');
const dumpFolderPublicJs = path.join(dumpFolderPath, 'public', 'js');

// Create folders if they don't exist
[dumpFolderPath, dumpFolderServices, dumpFolderPublicJs].forEach(folderPath => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Created folder: ${folderPath}`);
  }
});

// Files to move to dump folder
const filesToMove = [
  { from: 'services/thingspeak-api.js', to: 'dump/services/thingspeak-api.js' },
  { from: 'app.js', to: 'dump/app.js' }, // Using server.js instead as main entry point
  { from: 'public/js/thingspeak-connection.js', to: 'dump/public/js/thingspeak-connection.js' },
  { from: 'public/js/thingspeak-config.js', to: 'dump/public/js/thingspeak-config.js' }
];

// Move files
filesToMove.forEach(file => {
  const sourcePath = path.join(__dirname, file.from);
  const destPath = path.join(__dirname, file.to);
  
  if (fs.existsSync(sourcePath)) {
    try {
      // Read file content
      const fileContent = fs.readFileSync(sourcePath, 'utf8');
      
      // Write to new location
      fs.writeFileSync(destPath, fileContent);
      console.log(`Moved: ${file.from} -> ${file.to}`);
      
      // Append note to the file
      const note = `\n\n/* 
* This file has been moved to the dump folder as part of repository cleanup.
* It may contain outdated code or duplicate functionality.
* See thingspeak-service.js for the current implementation.
* Moved on ${new Date().toISOString()}
*/`;
      
      fs.appendFileSync(destPath, note);
      
      // Remove original file
      fs.unlinkSync(sourcePath);
    } catch (err) {
      console.error(`Error moving file ${file.from}: ${err.message}`);
    }
  } else {
    console.log(`File not found: ${sourcePath}`);
  }
});

console.log('Cleanup complete!');
