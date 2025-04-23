/**
 * Air Quality Monitoring System - Theme Management
 * Centralized theme functionality to eliminate code duplication
 */

// Create a global ThemeManager object
const ThemeManager = (function() {
    // Private variables
    const STORAGE_KEY = 'theme';
    const DARK_MODE_CLASS = 'dark-mode';
    
    /**
     * Get the current theme
     * @returns {string} 'dark' or 'light'
     */
    function getCurrentTheme() {
        return document.body.classList.contains(DARK_MODE_CLASS) ? 'dark' : 'light';
    }
    
    /**
     * Toggle between light and dark themes
     * @returns {string} The new theme that was set ('dark' or 'light')
     */
    function toggleTheme() {
        const currentTheme = getCurrentTheme();
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        setTheme(newTheme);
        return newTheme;
    }
    
    /**
     * Set a specific theme
     * @param {string} theme - 'dark' or 'light'
     */
    function setTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add(DARK_MODE_CLASS);
            updateThemeIcon(true);
        } else {
            document.body.classList.remove(DARK_MODE_CLASS);
            updateThemeIcon(false);
        }
        
        // Save preference to localStorage
        localStorage.setItem(STORAGE_KEY, theme);
        
        // Dispatch an event so other components can react
        document.dispatchEvent(new CustomEvent('themechange', { 
            detail: { theme: theme }
        }));
    }
    
    /**
     * Update theme icon in the UI
     * @param {boolean} isDark - Whether the theme is dark
     */
    function updateThemeIcon(isDark) {
        const themeIcon = document.querySelector('#toggleTheme i');
        if (themeIcon) {
            if (isDark) {
                themeIcon.classList.replace('bi-moon-fill', 'bi-sun-fill');
            } else {
                themeIcon.classList.replace('bi-sun-fill', 'bi-moon-fill');
            }
        }
    }
    
    /**
     * Load saved theme preference or use system preference
     */
    function loadThemePreference() {
        const savedTheme = localStorage.getItem(STORAGE_KEY);
        
        if (savedTheme) {
            setTheme(savedTheme);
        } else {
            // Check for system preference if no theme is saved
            const prefersDark = window.matchMedia && 
                window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'dark' : 'light');
        }
    }
    
    /**
     * Setup theme toggle button event listener
     */
    function setupThemeToggle() {
        const toggleBtn = document.getElementById('toggleTheme');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }
    }
    
    /**
     * Initialize theme functionality
     */
    function init() {
        // Load theme preference on document load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadThemePreference);
        } else {
            loadThemePreference();
        }
        
        // Setup theme toggle when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupThemeToggle);
        } else {
            setupThemeToggle();
        }
        
        // Listen for system theme changes
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)')
                .addEventListener('change', event => {
                    if (!localStorage.getItem(STORAGE_KEY)) {
                        setTheme(event.matches ? 'dark' : 'light');
                    }
                });
        }
    }
    
    // Public API
    return {
        init: init,
        getCurrentTheme: getCurrentTheme,
        toggleTheme: toggleTheme,
        setTheme: setTheme
    };
})();

// Automatically initialize the theme manager
ThemeManager.init();
