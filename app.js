const express = require('express');
const path = require('path');
const app = express();

// Configure Express static file serving
app.use(express.static('public'));

// Add direct access to the data directory for CSV files
app.use('/data', express.static(path.join(__dirname, 'data')));

module.exports = app;