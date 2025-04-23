const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Add a new route to serve the CSV file directly
router.get('/feeds.csv', (req, res) => {
    const csvPath = path.join(__dirname, '..', 'data', 'feeds.csv');
    
    // Check if file exists
    if (fs.existsSync(csvPath)) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'inline; filename="feeds.csv"');
        fs.createReadStream(csvPath).pipe(res);
    } else {
        res.status(404).send('CSV file not found');
    }
});

module.exports = router;