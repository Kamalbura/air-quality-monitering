const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

console.log('Starting basic Express server...');

app.get('/', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Air Quality Monitor - Debug</title>
        </head>
        <body>
            <h1>🌬️ Air Quality Monitoring System</h1>
            <p>Server is running successfully!</p>
            <p>Time: ${new Date().toLocaleString()}</p>
            <ul>
                <li><a href="/api/health">Health Check</a></li>
                <li><a href="/api/status">Status</a></li>
                <li><a href="/api/data">Sample Data</a></li>
            </ul>
        </body>
        </html>
    `);
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

app.get('/api/status', (req, res) => {
    res.json({
        server: 'Air Quality Monitoring',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: port
    });
});

app.get('/api/data', (req, res) => {
    res.json({
        airQuality: {
            pm25: Math.random() * 50 + 10,
            pm10: Math.random() * 80 + 20,
            temperature: Math.random() * 15 + 20,
            humidity: Math.random() * 30 + 40,
            timestamp: new Date().toISOString()
        }
    });
});

app.listen(port, () => {
    console.log(`✅ Server running at http://localhost:${port}`);
    console.log(`🌐 Open your browser to see the air quality monitor`);
});
