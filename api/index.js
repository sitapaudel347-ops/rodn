/**
 * Vercel Serverless Function Entry Point
 * This allows Vercel to properly handle the Express app as a serverless function
 * Handles both local development and Turso database connections
 */

require('dotenv').config();

const app = require('../server/app');

// Initialize database connection on first request (Vercel requires this)
let dbInitialized = false;
const database = require('../server/config/database');

app.use(async (req, res, next) => {
    if (!dbInitialized) {
        try {
            await database.initialize();
            dbInitialized = true;
        } catch (error) {
            console.error('Database initialization failed:', error.message);
            // For Vercel, continue with degraded functionality if DB is not available
            if (!process.env.TURSO_CONNECTION_URL) {
                return res.status(503).json({ error: 'Database not configured. Set TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN environment variables.' });
            }
        }
    }
    next();
});

// Export the app for Vercel
module.exports = app;
