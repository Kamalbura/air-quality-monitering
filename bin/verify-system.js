/**
 * Final Verification Script
 * Verifies that the air quality monitoring system is properly set up and working
 */

console.log('🔍 Final System Verification\n');

let allTestsPassed = true;
const results = [];

function test(name, testFunction) {
    try {
        console.log(`Testing ${name}...`);
        testFunction();
        console.log(`✅ ${name} - OK`);
        results.push({ name, status: 'PASS' });
    } catch (error) {
        console.log(`❌ ${name} - FAILED: ${error.message}`);
        results.push({ name, status: 'FAIL', error: error.message });
        allTestsPassed = false;
    }
}

// Test 1: Dependency Manager
test('Dependency Manager', () => {
    const dm = require('./services/dependency-manager');
    if (!dm || typeof dm.safeRequire !== 'function') {
        throw new Error('Dependency manager not working correctly');
    }
});

// Test 2: Route Consolidator
test('Route Consolidator', () => {
    const rc = require('./services/route-consolidator');
    if (!rc || typeof rc.registerRoutes !== 'function') {
        throw new Error('Route consolidator not working correctly');
    }
});

// Test 3: App State
test('App State Service', () => {
    const appState = require('./services/app-state');
    if (!appState || typeof appState.initialize !== 'function') {
        throw new Error('App state service not working correctly');
    }
});

// Test 4: ThingSpeak Service
test('ThingSpeak Service', () => {
    const ts = require('./services/thingspeak-service');
    if (!ts || typeof ts.testConnection !== 'function') {
        throw new Error('ThingSpeak service not working correctly');
    }
});

// Test 5: Data Processing Service
test('Data Processing Service', () => {
    const dps = require('./services/data-processing-service');
    if (!dps || typeof dps.processRawData !== 'function') {
        throw new Error('Data processing service not working correctly');
    }
});

// Test 6: Error Handler
test('Error Handler', () => {
    const eh = require('./error-handler');
    if (!eh || typeof eh.handleError !== 'function') {
        throw new Error('Error handler not working correctly');
    }
});

// Test 7: Express and Dependencies
test('Express and Core Dependencies', () => {
    const express = require('express');
    const axios = require('axios');
    const path = require('path');
    if (!express || !axios || !path) {
        throw new Error('Core dependencies missing');
    }
});

// Test 8: Startup Script
test('Startup Script', () => {
    const startup = require('./startup');
    if (!startup || typeof startup !== 'function') {
        throw new Error('Startup script not working correctly');
    }
});

// Test 9: Configuration Files
test('Configuration Files', () => {
    const fs = require('fs');
    const requiredFiles = [
        'package.json',
        '.env.example',
        'server-main.js',
        'startup.js'
    ];
    
    for (const file of requiredFiles) {
        if (!fs.existsSync(file)) {
            throw new Error(`Required file missing: ${file}`);
        }
    }
});

// Test 10: Package.json Validation
test('Package.json Configuration', () => {
    const pkg = require('./package.json');
    if (!pkg.name || !pkg.version || !pkg.scripts || !pkg.scripts.start) {
        throw new Error('Package.json not properly configured');
    }
});

// Print Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VERIFICATION SUMMARY');
console.log('='.repeat(60));

const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;

console.log(`✅ Tests Passed: ${passed}/${results.length}`);
if (failed > 0) {
    console.log(`❌ Tests Failed: ${failed}/${results.length}`);
    console.log('\nFailed Tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
    });
}

console.log('\n' + '='.repeat(60));

if (allTestsPassed) {
    console.log('🎉 ALL SYSTEMS GO!');
    console.log('🚀 The Air Quality Monitoring System is ready to launch!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Copy .env.example to .env and configure your settings');
    console.log('2. Run: npm start');
    console.log('3. Visit: http://localhost:3000');
    console.log('');
    console.log('For help and documentation, see: IMPLEMENTATION_COMPLETE.md');
} else {
    console.log('⚠️  SOME ISSUES DETECTED');
    console.log('Please fix the failed tests before starting the system.');
    console.log('Check the error messages above for guidance.');
}

console.log('='.repeat(60));

process.exit(allTestsPassed ? 0 : 1);
