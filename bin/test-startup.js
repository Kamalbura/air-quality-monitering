/**
 * Simple test to verify server startup without errors
 */

console.log('🧪 Testing server startup...');

try {
    // Test requiring the main components
    console.log('📦 Loading ThingSpeak service...');
    const thingspeakService = require('./services/thingspeak-service');
    
    console.log('📦 Loading app state...');
    const appState = require('./services/app-state');
    
    console.log('📦 Loading data processing...');
    const dataProcessing = require('./services/data-processing-service');
    
    // Test that the correct method exists
    console.log('🔍 Checking ThingSpeak service methods...');
    if (typeof thingspeakService.getLatestFeed === 'function') {
        console.log('✅ thingspeakService.getLatestFeed() method exists');
    } else {
        console.log('❌ thingspeakService.getLatestFeed() method missing');
    }
    
    if (typeof thingspeakService.getLatestData === 'function') {
        console.log('❌ thingspeakService.getLatestData() method still exists (should be removed)');
    } else {
        console.log('✅ thingspeakService.getLatestData() method correctly removed');
    }
    
    // Test a simple method call (without actual network request)
    console.log('🔍 Testing method signatures...');
    console.log('Available methods:', Object.getOwnPropertyNames(thingspeakService.constructor.prototype).filter(name => name !== 'constructor'));
    
    console.log('✅ Server components loaded successfully!');
    console.log('🎉 The TypeError issue should be resolved.');
    
} catch (error) {
    console.error('❌ Error during startup test:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}
