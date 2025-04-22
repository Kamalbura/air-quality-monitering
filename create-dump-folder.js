/**
 * Script to create a dump folder for unused files
 */
const fs = require('fs');
const path = require('path');

// Create dump directory if it doesn't exist
const dumpDir = path.join(__dirname, 'dump');
if (!fs.existsSync(dumpDir)) {
  try {
    fs.mkdirSync(dumpDir, { recursive: true });
    console.log(`Created dump directory at ${dumpDir}`);
  } catch (err) {
    console.error(`Error creating dump directory: ${err.message}`);
  }
}

console.log('Run this script with: node create-dump-folder.js');
