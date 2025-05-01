/**
 * ThingSpeak Integration Service
 * Provides a unified interface for interacting with ThingSpeak API
 */

const axios = require('axios');
const thingspeakService = require('./thingspeak-service');
const debugHelper = require('../helpers/debug-helper');
const NodeCache = require('node-cache');

// Create a cache specifically for integrated ThingSpeak data
const integrationCache = new NodeCache({ stdTTL: 300 }); // 5 minutes TTL

/**
 * Get the latest air quality data from ThingSpeak
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Latest air quality data
 */
async function getLatestAirQuality(options = {}) {
    const cacheKey = `latest_air_quality_${JSON.stringify(options)}`;
    const cachedData = integrationCache.get(cacheKey);
    
    if (cachedData) {
        debugHelper.log('Using cached latest air quality data', 'thingspeak-integration');
        return cachedData;
    }
    
    try {
        const results = options.results || 1;
        const rawData = await thingspeakService.getChannelData({ results });
        
        if (!rawData || !rawData.data || rawData.data.length === 0) {
            throw new Error('No data available from ThingSpeak');
        }
        
        // Transform the data into a more usable format
        const latestData = rawData.data[0];
        const airQuality = {
            pm25: parseFloat(latestData.pm25 || latestData.field3) || null,
            pm10: parseFloat(latestData.pm10 || latestData.field4) || null,
            temperature: parseFloat(latestData.temperature || latestData.field2) || null,
            humidity: parseFloat(latestData.humidity || latestData.field1) || null,
            timestamp: latestData.created_at,
            entry_id: latestData.entry_id,
            aqi: calculateAQI(parseFloat(latestData.pm25 || latestData.field3))
        };
        
        // Calculate AQI category
        airQuality.aqiCategory = getAQICategory(airQuality.aqi);
        
        // Cache the result
        integrationCache.set(cacheKey, airQuality);
        
        return airQuality;
    } catch (error) {
        debugHelper.log(`Error getting latest air quality: ${error.message}`, 'thingspeak-integration', 'error');
        throw error;
    }
}

/**
 * Calculate Air Quality Index (AQI) based on PM2.5
 * @param {number} pm25 - PM2.5 value in μg/m³
 * @returns {number} AQI value
 */
function calculateAQI(pm25) {
    if (pm25 === null || pm25 === undefined || isNaN(pm25)) {
        return null;
    }
    
    // EPA AQI breakpoints for PM2.5
    const breakpoints = [
        { min: 0, max: 12.0, aqiMin: 0, aqiMax: 50 },
        { min: 12.1, max: 35.4, aqiMin: 51, aqiMax: 100 },
        { min: 35.5, max: 55.4, aqiMin: 101, aqiMax: 150 },
        { min: 55.5, max: 150.4, aqiMin: 151, aqiMax: 200 },
        { min: 150.5, max: 250.4, aqiMin: 201, aqiMax: 300 },
        { min: 250.5, max: 500.4, aqiMin: 301, aqiMax: 500 }
    ];
    
    // Find the appropriate breakpoint
    for (const bp of breakpoints) {
        if (pm25 >= bp.min && pm25 <= bp.max) {
            // Linear interpolation
            return Math.round(
                ((bp.aqiMax - bp.aqiMin) / (bp.max - bp.min)) * (pm25 - bp.min) + bp.aqiMin
            );
        }
    }
    
    // If above highest breakpoint
    if (pm25 > 500.4) {
        return 500;
    }
    
    return null;
}

/**
 * Get AQI category based on AQI value
 * @param {number} aqi - AQI value
 * @returns {Object} AQI category information
 */
function getAQICategory(aqi) {
    if (aqi === null || aqi === undefined) {
        return { name: 'Unknown', color: '#CCCCCC', description: 'No data available' };
    }
    
    if (aqi <= 50) {
        return { 
            name: 'Good', 
            color: '#00E400', 
            description: 'Air quality is satisfactory, and air pollution poses little or no risk.'
        };
    } else if (aqi <= 100) {
        return { 
            name: 'Moderate', 
            color: '#FFFF00', 
            description: 'Air quality is acceptable. However, there may be a risk for some people, particularly those who are unusually sensitive to air pollution.'
        };
    } else if (aqi <= 150) {
        return { 
            name: 'Unhealthy for Sensitive Groups', 
            color: '#FF7E00', 
            description: 'Members of sensitive groups may experience health effects. The general public is less likely to be affected.'
        };
    } else if (aqi <= 200) {
        return { 
            name: 'Unhealthy', 
            color: '#FF0000', 
            description: 'Some members of the general public may experience health effects; members of sensitive groups may experience more serious health effects.'
        };
    } else if (aqi <= 300) {
        return { 
            name: 'Very Unhealthy', 
            color: '#8F3F97', 
            description: 'Health alert: The risk of health effects is increased for everyone.'
        };
    } else {
        return { 
            name: 'Hazardous', 
            color: '#7E0023', 
            description: 'Health warning of emergency conditions: everyone is more likely to be affected.'
        };
    }
}

/**
 * Get time-series data for dashboard visualization
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Formatted time-series data
 */
async function getTimeSeriesData(options = {}) {
    const days = options.days || 7;
    const results = options.results || 1000;
    
    const cacheKey = `time_series_${days}_${results}`;
    const cachedData = integrationCache.get(cacheKey);
    
    if (cachedData) {
        debugHelper.log('Using cached time series data', 'thingspeak-integration');
        return cachedData;
    }
    
    try {
        const rawData = await thingspeakService.getDirectThingspeakData({
            days,
            results
        });
        
        if (!rawData || !rawData.data || rawData.data.length === 0) {
            throw new Error('No data available for time series');
        }
        
        // Format the data for Chart.js time series
        const timeSeriesData = {
            labels: rawData.data.map(entry => new Date(entry.created_at).toISOString()),
            datasets: [
                {
                    label: 'PM2.5',
                    data: rawData.data.map(entry => parseFloat(entry.field3 || entry.pm25) || null),
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)'
                },
                {
                    label: 'PM10',
                    data: rawData.data.map(entry => parseFloat(entry.field4 || entry.pm10) || null),
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)'
                },
                {
                    label: 'Temperature',
                    data: rawData.data.map(entry => parseFloat(entry.field2 || entry.temperature) || null),
                    borderColor: 'rgba(255, 159, 64, 1)',
                    backgroundColor: 'rgba(255, 159, 64, 0.2)',
                    yAxisID: 'y1'
                },
                {
                    label: 'Humidity',
                    data: rawData.data.map(entry => parseFloat(entry.field1 || entry.humidity) || null),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    yAxisID: 'y1'
                }
            ]
        };
        
        // Cache the result
        integrationCache.set(cacheKey, timeSeriesData);
        
        return timeSeriesData;
    } catch (error) {
        debugHelper.log(`Error getting time series data: ${error.message}`, 'thingspeak-integration', 'error');
        throw error;
    }
}

/**
 * Get channel health status
 * @returns {Promise<Object>} Channel health status
 */
async function getChannelHealth() {
    const cacheKey = 'channel_health';
    const cachedHealth = integrationCache.get(cacheKey);
    
    if (cachedHealth) {
        return cachedHealth;
    }
    
    try {
        const connectionStatus = await thingspeakService.checkConnection();
        const statusInfo = await thingspeakService.getChannelStatus();
        
        const health = {
            online: connectionStatus.connected,
            channel_exists: connectionStatus.channel_exists,
            last_data_received: connectionStatus.last_data_received,
            data_age_seconds: connectionStatus.data_age_seconds,
            data_fresh: connectionStatus.data_fresh,
            api_rate_limit: statusInfo.usage?.rate_limit || null,
            api_daily_limit: statusInfo.usage?.daily_limit || null,
            api_remaining: statusInfo.usage?.remaining || null
        };
        
        // Calculate health score (0-100%)
        let healthScore = 100;
        
        if (!health.online) healthScore -= 50;
        if (!health.channel_exists) healthScore -= 25;
        if (!health.data_fresh) healthScore -= 25;
        
        health.score = Math.max(0, healthScore);
        health.grade = getHealthGrade(healthScore);
        
        // Cache the result for 5 minutes
        integrationCache.set(cacheKey, health, 300);
        
        return health;
    } catch (error) {
        debugHelper.log(`Error getting channel health: ${error.message}`, 'thingspeak-integration', 'error');
        
        // Return offline status
        return {
            online: false,
            error: error.message,
            score: 0,
            grade: 'F'
        };
    }
}

/**
 * Get health grade based on health score
 */
function getHealthGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
}

/**
 * Clear integration cache
 */
function clearCache() {
    return integrationCache.flushAll();
}

module.exports = {
    getLatestAirQuality,
    getTimeSeriesData,
    getChannelHealth,
    calculateAQI,
    getAQICategory,
    clearCache
};
