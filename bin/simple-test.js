console.log('Testing basic functionality...');

try {
    console.log('1. Loading dependency manager...');
    const dependencyManager = require('./services/dependency-manager');
    console.log('✅ Dependency manager loaded');
    
    console.log('2. Loading app state...');
    const appState = require('./services/app-state');
    console.log('✅ App state loaded');
    
    console.log('3. Loading route consolidator...');
    const routeConsolidator = require('./services/route-consolidator');
    console.log('✅ Route consolidator loaded');
    
    console.log('4. Loading ThingSpeak service...');
    const thingSpeakService = require('./services/thingspeak-service');
    console.log('✅ ThingSpeak service loaded');
    
    console.log('5. Testing Express...');
    const express = require('express');
    console.log('✅ Express loaded');
    
    console.log('\n🎉 All core modules loaded successfully!');
    console.log('💡 System appears to be ready. Try: npm start');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
}
