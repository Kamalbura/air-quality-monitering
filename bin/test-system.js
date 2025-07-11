/**
 * Quick Test Script
 * Tests the basic functionality of the air quality monitoring system
 */

const path = require('path');

async function runQuickTest() {
    console.log('🧪 Running Quick System Test...\n');
    
    const tests = [];
    
    // Test 1: Check core modules can be loaded
    console.log('1️⃣  Testing module loading...');
    try {
        const dependencyManager = require('./services/dependency-manager');
        const routeConsolidator = require('./services/route-consolidator');
        const appState = require('./services/app-state');
        console.log('   ✅ Core modules loaded successfully');
        tests.push({ name: 'Module Loading', status: 'PASS' });
    } catch (error) {
        console.log(`   ❌ Module loading failed: ${error.message}`);
        tests.push({ name: 'Module Loading', status: 'FAIL', error: error.message });
    }
    
    // Test 2: Check dependency manager
    console.log('\n2️⃣  Testing dependency manager...');
    try {
        const dependencyManager = require('./services/dependency-manager');
        const status = dependencyManager.getStatus();
        console.log(`   ✅ Dependency manager working (${status.missingModules.length} missing modules)`);
        tests.push({ name: 'Dependency Manager', status: 'PASS', details: `${status.missingModules.length} missing` });
    } catch (error) {
        console.log(`   ❌ Dependency manager failed: ${error.message}`);
        tests.push({ name: 'Dependency Manager', status: 'FAIL', error: error.message });
    }
    
    // Test 3: Check app state functionality
    console.log('\n3️⃣  Testing app state...');
    try {
        const appState = require('./services/app-state');
        await appState.initialize();
        
        // Test cache functionality
        appState.setCache('test-key', 'test-value', 30);
        const cached = appState.getCache('test-key');
        
        if (cached === 'test-value') {
            console.log('   ✅ App state working correctly');
            tests.push({ name: 'App State', status: 'PASS' });
        } else {
            console.log('   ⚠️  App state cache not working correctly');
            tests.push({ name: 'App State', status: 'WARN', details: 'Cache functionality issues' });
        }
    } catch (error) {
        console.log(`   ❌ App state failed: ${error.message}`);
        tests.push({ name: 'App State', status: 'FAIL', error: error.message });
    }
    
    // Test 4: Check ThingSpeak service
    console.log('\n4️⃣  Testing ThingSpeak service...');
    try {
        const thingSpeakService = require('./services/thingspeak-service');
        console.log('   ✅ ThingSpeak service loaded');
        tests.push({ name: 'ThingSpeak Service', status: 'PASS' });
    } catch (error) {
        console.log(`   ❌ ThingSpeak service failed: ${error.message}`);
        tests.push({ name: 'ThingSpeak Service', status: 'FAIL', error: error.message });
    }
    
    // Test 5: Check route consolidator
    console.log('\n5️⃣  Testing route consolidator...');
    try {
        const routeConsolidator = require('./services/route-consolidator');
        const summary = routeConsolidator.getRoutesSummary();
        console.log('   ✅ Route consolidator working');
        tests.push({ name: 'Route Consolidator', status: 'PASS' });
    } catch (error) {
        console.log(`   ❌ Route consolidator failed: ${error.message}`);
        tests.push({ name: 'Route Consolidator', status: 'FAIL', error: error.message });
    }
    
    // Test 6: Check Express server creation
    console.log('\n6️⃣  Testing Express server creation...');
    try {
        const express = require('express');
        const app = express();
        app.get('/test', (req, res) => res.json({ test: 'ok' }));
        console.log('   ✅ Express server can be created');
        tests.push({ name: 'Express Server', status: 'PASS' });
    } catch (error) {
        console.log(`   ❌ Express server creation failed: ${error.message}`);
        tests.push({ name: 'Express Server', status: 'FAIL', error: error.message });
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Summary');
    console.log('='.repeat(50));
    
    const passed = tests.filter(t => t.status === 'PASS').length;
    const failed = tests.filter(t => t.status === 'FAIL').length;
    const warned = tests.filter(t => t.status === 'WARN').length;
    
    console.log(`✅ Passed: ${passed}`);
    if (warned > 0) console.log(`⚠️  Warnings: ${warned}`);
    if (failed > 0) console.log(`❌ Failed: ${failed}`);
    
    console.log('\nDetailed Results:');
    tests.forEach(test => {
        const icon = test.status === 'PASS' ? '✅' : test.status === 'WARN' ? '⚠️ ' : '❌';
        console.log(`  ${icon} ${test.name}`);
        if (test.details) console.log(`      ${test.details}`);
        if (test.error) console.log(`      Error: ${test.error}`);
    });
    
    if (failed === 0) {
        console.log('\n🎉 All core tests passed! System appears to be working correctly.');
        console.log('💡 You can now try: npm start');
        return true;
    } else {
        console.log('\n⚠️  Some tests failed. Please check the errors above.');
        return false;
    }
}

// Run the test
if (require.main === module) {
    runQuickTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('\n💥 Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = { runQuickTest };
