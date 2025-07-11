#!/usr/bin/env node

/**
 * Simple server starter for debugging
 */

console.log('🚀 Starting Air Quality Monitoring Server...\n');

try {
    // Set some default environment variables if not set
    if (!process.env.PORT) process.env.PORT = '3000';
    if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development';
    
    console.log('📋 Environment:');
    console.log(`   - PORT: ${process.env.PORT}`);
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`);
    console.log('');
    
    // Import and start the server
    console.log('📦 Loading server module...');
    const { server } = require('./server-main');
    
    console.log('🔧 Starting server...');
    server.start().then(() => {
        console.log('✅ Server started successfully!');
        console.log(`🌐 Open your browser to: http://localhost:${process.env.PORT}`);
    }).catch(error => {
        console.error('❌ Failed to start server:', error.message);
        console.error(error.stack);
        process.exit(1);
    });
    
} catch (error) {
    console.error('💥 Startup error:', error.message);
    console.error(error.stack);
    process.exit(1);
}
