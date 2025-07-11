/**
 * Web Routes
 * HTML page routes for the Air Quality Monitoring System
 */
const express = require('express');
const router = express.Router();
const path = require('path');

// Get package version
let packageVersion = '1.0.0';
try {
    const pkg = require('../package.json');
    packageVersion = pkg.version || '1.0.0';
} catch (error) {
    console.warn('Could not load package.json for version info');
}
``
/**
 * Main dashboard route
 */
router.get('/', (req, res) => {
    try {
        res.render('dashboard', {
            title: 'Air Quality Monitoring Dashboard',
            version: packageVersion
        });
    } catch (error) {
        console.error('Error rendering dashboard:', error);
        res.status(500).send('Error loading dashboard');
    }
});

/**
 * Status page
 */
router.get('/status', (req, res) => {
    try {
        res.render('status', {
            title: 'System Status',
            version: packageVersion
        });
    } catch (error) {
        console.error('Error rendering status page:', error);
        res.status(500).send('Error loading status page');
    }
});

/**
 * Configuration page
 */
router.get('/config', (req, res) => {
    try {
        res.render('config', {
            title: 'Configuration',
            version: packageVersion
        });
    } catch (error) {
        console.error('Error rendering config page:', error);
        res.status(500).send('Error loading configuration page');
    }
});

/**
 * ThingSpeak information page
 */
router.get('/thingspeak-info', (req, res) => {
    try {
        res.render('thingspeak-info', {
            title: 'ThingSpeak Information',
            version: packageVersion
        });
    } catch (error) {
        console.error('Error rendering ThingSpeak info page:', error);
        res.status(500).send('Error loading ThingSpeak information page');
    }
});

/**
 * LSTM predictions dashboard
 */
router.get('/lstm', (req, res) => {
    try {
        res.render('lstm-dashboard', {
            title: 'LSTM Predictions',
            version: packageVersion
        });
    } catch (error) {
        console.error('Error rendering LSTM dashboard:', error);
        res.status(500).send('Error loading LSTM dashboard');
    }
});

/**
 * Analytics page
 */
router.get('/analytics', (req, res) => {
    try {
        res.render('analytics', {
            title: 'Data Analytics',
            version: packageVersion
        });
    } catch (error) {
        console.error('Error rendering analytics page:', error);
        res.status(500).send('Error loading analytics page');
    }
});

module.exports = router;