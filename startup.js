#!/usr/bin/env node

/**
 * Air Quality Monitoring System - Startup Script
 * Comprehensive startup with dependency checking, environment validation, and graceful error handling
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for better console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m'
};

class StartupManager {
    constructor() {
        this.startTime = Date.now();
        this.checks = [];
    }

    /**
     * Log with color support
     */
    log(message, color = 'white') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    /**
     * Print startup banner
     */
    printBanner() {
        const banner = `
${colors.cyan}╔══════════════════════════════════════════════════════════════════╗
║                   🌬️  Air Quality Monitoring System              ║
║                        Starting Up...                            ║
╚══════════════════════════════════════════════════════════════════╝${colors.reset}
`;
        console.log(banner);
    }

    /**
     * Run a check and record the result
     */
    async runCheck(name, checkFunction) {
        const startTime = Date.now();
        this.log(`🔍 ${name}...`, 'blue');
        
        try {
            const result = await checkFunction();
            const duration = Date.now() - startTime;
            
            if (result.success) {
                this.log(`✅ ${name} - OK (${duration}ms)`, 'green');
                this.checks.push({ name, status: 'OK', duration, details: result.details });
            } else {
                this.log(`⚠️  ${name} - WARNING: ${result.message} (${duration}ms)`, 'yellow');
                this.checks.push({ name, status: 'WARNING', duration, message: result.message, details: result.details });
            }
            
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.log(`❌ ${name} - FAILED: ${error.message} (${duration}ms)`, 'red');
            this.checks.push({ name, status: 'FAILED', duration, error: error.message });
            return { success: false, error: error.message };
        }
    }

    /**
     * Check Node.js version
     */
    async checkNodeVersion() {
        const nodeVersion = process.version;
        const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
        
        if (majorVersion >= 14) {
            return { 
                success: true, 
                details: `Node.js ${nodeVersion} (✓ Compatible)` 
            };
        } else {
            return { 
                success: false, 
                message: `Node.js ${nodeVersion} is too old. Please upgrade to v14 or later.` 
            };
        }
    }

    /**
     * Check required directories
     */
    async checkDirectories() {
        const requiredDirs = [
            'logs',
            'data',
            'data/exports',
            'data/uploads',
            'data/state'
        ];

        const results = [];
        let allSuccess = true;

        for (const dir of requiredDirs) {
            try {
                if (!fs.existsSync(dir)) {
                    await fs.promises.mkdir(dir, { recursive: true });
                    results.push(`Created: ${dir}`);
                } else {
                    results.push(`Exists: ${dir}`);
                }
            } catch (error) {
                results.push(`Failed: ${dir} - ${error.message}`);
                allSuccess = false;
            }
        }

        return {
            success: allSuccess,
            details: results.join(', '),
            message: allSuccess ? '' : 'Some directories could not be created'
        };
    }

    /**
     * Check package.json and dependencies
     */
    async checkPackageJson() {
        try {
            const packagePath = path.join(process.cwd(), 'package.json');
            
            if (!fs.existsSync(packagePath)) {
                return { 
                    success: false, 
                    message: 'package.json not found' 
                };
            }

            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
            const depCount = Object.keys(packageJson.dependencies || {}).length;
            const devDepCount = Object.keys(packageJson.devDependencies || {}).length;

            return {
                success: true,
                details: `${packageJson.name}@${packageJson.version} (${depCount} deps, ${devDepCount} dev deps)`
            };
        } catch (error) {
            return {
                success: false,
                message: `Package.json error: ${error.message}`
            };
        }
    }

    /**
     * Check environment configuration
     */
    async checkEnvironment() {
        const envFile = path.join(process.cwd(), '.env');
        const envExampleFile = path.join(process.cwd(), '.env.example');
        
        const issues = [];
        let hasEnvFile = false;

        // Check .env file
        if (fs.existsSync(envFile)) {
            hasEnvFile = true;
        } else if (fs.existsSync(envExampleFile)) {
            issues.push('No .env file found, but .env.example exists');
        } else {
            issues.push('No environment configuration files found');
        }

        // Check key environment variables
        const requiredEnvVars = ['PORT', 'NODE_ENV'];
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            issues.push(`Missing env vars: ${missingVars.join(', ')}`);
        }

        return {
            success: issues.length === 0,
            details: hasEnvFile ? 'Environment file loaded' : 'Using default configuration',
            message: issues.length > 0 ? issues.join('; ') : undefined
        };
    }

    /**
     * Check core dependencies
     */
    async checkCoreDependencies() {
        const coreDeps = [
            'express',
            'axios',
            'socket.io',
            'helmet',
            'cors'
        ];

        const available = [];
        const missing = [];

        for (const dep of coreDeps) {
            try {
                require.resolve(dep);
                available.push(dep);
            } catch (error) {
                missing.push(dep);
            }
        }

        return {
            success: missing.length === 0,
            details: `Available: ${available.length}/${coreDeps.length}`,
            message: missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined
        };
    }

    /**
     * Check services availability
     */
    async checkServices() {
        const services = [
            { name: 'app-state', path: './services/app-state' },
            { name: 'thingspeak-service', path: './services/thingspeak-service' },
            { name: 'data-processing-service', path: './services/data-processing-service' },
            { name: 'error-handler', path: './error-handler' }
        ];

        const available = [];
        const failed = [];

        for (const service of services) {
            try {
                require(service.path);
                available.push(service.name);
            } catch (error) {
                failed.push(`${service.name}: ${error.message}`);
            }
        }

        return {
            success: failed.length === 0,
            details: `${available.length}/${services.length} services available`,
            message: failed.length > 0 ? `Service issues: ${failed.join('; ')}` : undefined
        };
    }

    /**
     * Print startup summary
     */
    printSummary() {
        const totalDuration = Date.now() - this.startTime;
        const successful = this.checks.filter(c => c.status === 'OK').length;
        const warnings = this.checks.filter(c => c.status === 'WARNING').length;
        const failed = this.checks.filter(c => c.status === 'FAILED').length;

        console.log('\n' + '='.repeat(70));
        this.log(`🎯 Startup Summary (${totalDuration}ms total)`, 'cyan');
        console.log('='.repeat(70));
        
        this.log(`✅ Successful: ${successful}`, 'green');
        if (warnings > 0) this.log(`⚠️  Warnings: ${warnings}`, 'yellow');
        if (failed > 0) this.log(`❌ Failed: ${failed}`, 'red');

        console.log('\n📋 Detailed Results:');
        this.checks.forEach(check => {
            const icon = check.status === 'OK' ? '✅' : check.status === 'WARNING' ? '⚠️ ' : '❌';
            const color = check.status === 'OK' ? 'green' : check.status === 'WARNING' ? 'yellow' : 'red';
            
            this.log(`  ${icon} ${check.name} (${check.duration}ms)`, color);
            if (check.details) {
                console.log(`      ${check.details}`);
            }
            if (check.message) {
                console.log(`      ${check.message}`);
            }
            if (check.error) {
                console.log(`      Error: ${check.error}`);
            }
        });

        console.log('='.repeat(70));
        
        if (failed === 0) {
            this.log('🚀 All systems ready! Starting server...', 'green');
            return true;
        } else {
            this.log('⚠️  Issues detected. Starting with degraded functionality...', 'yellow');
            return false;
        }
    }

    /**
     * Run all startup checks
     */
    async runAllChecks() {
        this.printBanner();
        
        await this.runCheck('Node.js Version', () => this.checkNodeVersion());
        await this.runCheck('Package Configuration', () => this.checkPackageJson());
        await this.runCheck('Environment Setup', () => this.checkEnvironment());
        await this.runCheck('Required Directories', () => this.checkDirectories());
        await this.runCheck('Core Dependencies', () => this.checkCoreDependencies());
        await this.runCheck('Service Availability', () => this.checkServices());
        
        return this.printSummary();
    }

    /**
     * Start the application
     */
    async startApplication() {
        try {
            // Import and start the main server
            const { server } = require('./server-main');
            await server.start();
        } catch (error) {
            this.log(`❌ Failed to start application: ${error.message}`, 'red');
            console.error(error);
            process.exit(1);
        }
    }
}

// Main execution
async function main() {
    const manager = new StartupManager();
    
    try {
        const allGood = await manager.runAllChecks();
        
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await manager.startApplication();
        
    } catch (error) {
        manager.log(`💥 Startup failed: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run if this is the main module
if (require.main === module) {
    main();
}

module.exports = StartupManager;
