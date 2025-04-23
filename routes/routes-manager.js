/**
 * Routes Manager
 * API endpoints for managing and testing application routes
 */
const express = require('express');
const router = express.Router();
const axios = require('axios');
const debugHelper = require('../helpers/debug-helper');

// Store discovered routes
let discoveredRoutes = [];
let routesCache = {};

// Get all routes
router.get('/', (req, res) => {
  res.json({ success: true, routes: discoveredRoutes });
});

// Test a specific route
router.get('/test', async (req, res) => {
  const { path, method } = req.query;
  
  if (!path) {
    return res.status(400).json({ success: false, error: 'Path parameter is required' });
  }
  
  try {
    // Construct the full URL
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}${path}`;
    
    // Use axios to make the request
    const response = await axios({
      method: method || 'GET',
      url,
      timeout: 5000,
    });
    
    // Update route status in the cache
    updateRouteStatus(path, method || 'GET', 'active');
    
    res.json({
      success: true,
      status: response.status,
      path,
      method: method || 'GET'
    });
  } catch (error) {
    debugHelper.log(`Error testing route ${method || 'GET'} ${path}: ${error.message}`, 'routes-manager', 'error');
    
    // Update route status in the cache
    updateRouteStatus(path, method || 'GET', 'error');
    
    res.status(500).json({
      success: false,
      error: error.message,
      path,
      method: method || 'GET'
    });
  }
});

// Check all routes
router.get('/check-all', async (req, res) => {
  try {
    const results = [];
    
    for (const route of discoveredRoutes) {
      try {
        // Skip non-GET routes for safety
        if (route.method !== 'GET') {
          route.status = 'skipped';
          results.push({
            path: route.path,
            method: route.method,
            status: 'skipped',
            reason: 'Only GET routes are tested automatically'
          });
          continue;
        }
        
        // Construct the full URL
        const protocol = req.protocol;
        const host = req.get('host');
        const url = `${protocol}://${host}${route.path}`;
        
        // Skip the route if it's this endpoint to avoid recursion
        if (route.path === '/api/routes/check-all') {
          route.status = 'skipped';
          results.push({
            path: route.path,
            method: route.method,
            status: 'skipped',
            reason: 'Skipped to avoid recursion'
          });
          continue;
        }
        
        // Use axios to make the request
        const response = await axios({
          method: route.method,
          url,
          timeout: 3000,
        });
        
        // Update route status
        route.status = 'active';
        results.push({
          path: route.path,
          method: route.method,
          status: response.status,
          success: true
        });
      } catch (error) {
        // Update route status
        route.status = 'error';
        results.push({
          path: route.path,
          method: route.method,
          status: 'error',
          error: error.message,
          success: false
        });
      }
    }
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    debugHelper.log(`Error checking all routes: ${error.message}`, 'routes-manager', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset routes cache
router.post('/reset-cache', (req, res) => {
  try {
    routesCache = {};
    res.json({ success: true });
  } catch (error) {
    debugHelper.log(`Error resetting routes cache: ${error.message}`, 'routes-manager', 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to update route status
function updateRouteStatus(path, method, status) {
  const route = discoveredRoutes.find(r => r.path === path && r.method === method);
  
  if (route) {
    route.status = status;
  }
}

// Register routes from the Express app
function registerAppRoutes(app) {
  discoveredRoutes = [];
  
  // Loop through all registered routes in the Express app
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // Route directly on the app
      const path = middleware.route.path;
      const methods = Object.keys(middleware.route.methods);
      
      methods.forEach(method => {
        routes.push({
          path,
          method: method.toUpperCase(),
          status: routesCache[`${method.toUpperCase()}-${path}`] || 'unknown'
        });
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          const path = handler.route.path;
          const basePath = middleware.regexp.toString()
            .match(/^\/\^\\\/([^\\\/\?]+)/);
          
          const fullPath = basePath ? 
            `/${basePath[1]}${path}` : path;
            
          const methods = Object.keys(handler.route.methods);
          
          methods.forEach(method => {
            routes.push({
              path: fullPath,
              method: method.toUpperCase(),
              status: routesCache[`${method.toUpperCase()}-${fullPath}`] || 'unknown'
            });
          });
        }
      });
    }
  });
  
  discoveredRoutes = routes;
}

module.exports = {
  router,
  registerAppRoutes
};
