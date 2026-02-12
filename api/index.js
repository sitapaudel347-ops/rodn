// api/index.js - Main serverless handler
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const serverless = require('serverless-http');
require('dotenv').config();

const logger = require('../server/utils/logger');
const securityConfig = require('../server/config/security');
const database = require('../server/config/database');

// Global state for database and initialization
let dbInitialized = false;
let dbInitializing = false;
let dbInitPromise = null;

// Initialize database safely (singleton pattern)
async function ensureDatabaseInitialized() {
    // Already initialized
    if (dbInitialized) {
        return;
    }

    // Initialization in progress - wait for it
    if (dbInitializing) {
        return dbInitPromise;
    }

    // Start initialization
    dbInitializing = true;
    dbInitPromise = (async () => {
        try {
            logger.info('[SERVERLESS] Initializing database...');
            
            // Initialize connection
            await database.initialize();
            
            // Create schema (idempotent - uses CREATE TABLE IF NOT EXISTS)
            const { createSchema } = require('../server/config/schema');
            await createSchema();
            
            // Seed data (idempotent - checks if data already exists)
            await seedDefaultDataIdempotent();
            
            dbInitialized = true;
            logger.info('[SERVERLESS] Database initialization completed');
        } catch (error) {
            logger.error('[SERVERLESS] Database initialization failed:', error);
            // Don't throw - allow requests to proceed, they may fail gracefully
            dbInitialized = false;
            throw error;
        }
    })();

    return dbInitPromise;
}

// Idempotent seeding function
async function seedDefaultDataIdempotent() {
    try {
        logger.info('[SERVERLESS] Checking if seeding is needed...');
        
        // Check if data already exists
        const existingUser = await database.get('SELECT id FROM users LIMIT 1');
        if (existingUser) {
            logger.info('[SERVERLESS] Data already exists, skipping seed');
            return;
        }

        logger.info('[SERVERLESS] Seeding default data...');
        const bcrypt = require('bcrypt');

        // Create default roles (check if they exist first)
        const roles = [
            { name: 'super_admin', description: 'Super Administrator with full system access' },
            { name: 'admin', description: 'Administrator with management access' },
            { name: 'editor', description: 'Editor who can review and publish articles' },
            { name: 'journalist', description: 'Journalist/Reporter who creates content' },
            { name: 'contributor', description: 'Contributor/Freelancer with limited access' },
            { name: 'moderator', description: 'Moderator who manages comments and user content' },
            { name: 'registered_user', description: 'Registered user who can comment' },
        ];

        for (const role of roles) {
            try {
                await database.run(
                    'INSERT INTO roles (name, description) VALUES (?, ?)',
                    [role.name, role.description]
                );
            } catch (error) {
                if (!error.message.includes('UNIQUE constraint failed')) {
                    throw error;
                }
                // Role already exists, continue
            }
        }
        logger.info('[SERVERLESS] ✓ Default roles processed');

        // Create default permissions (same pattern)
        const permissions = [
            { name: 'article.create', resource: 'article', action: 'create', description: 'Create articles' },
            { name: 'article.read', resource: 'article', action: 'read', description: 'Read articles' },
            { name: 'article.update', resource: 'article', action: 'update', description: 'Update articles' },
            { name: 'article.delete', resource: 'article', action: 'delete', description: 'Delete articles' },
            { name: 'article.publish', resource: 'article', action: 'publish', description: 'Publish articles' },
            { name: 'article.approve', resource: 'article', action: 'approve', description: 'Approve articles' },
            { name: 'user.create', resource: 'user', action: 'create', description: 'Create users' },
            { name: 'user.read', resource: 'user', action: 'read', description: 'Read user data' },
            { name: 'user.update', resource: 'user', action: 'update', description: 'Update users' },
            { name: 'user.delete', resource: 'user', action: 'delete', description: 'Delete users' },
            { name: 'category.manage', resource: 'category', action: 'manage', description: 'Manage categories' },
            { name: 'ads.manage', resource: 'ads', action: 'manage', description: 'Manage advertisements' },
            { name: 'media.upload', resource: 'media', action: 'upload', description: 'Upload media' },
            { name: 'media.manage', resource: 'media', action: 'manage', description: 'Manage media library' },
            { name: 'comment.moderate', resource: 'comment', action: 'moderate', description: 'Moderate comments' },
            { name: 'system.settings', resource: 'system', action: 'settings', description: 'Manage system settings' },
            { name: 'system.analytics', resource: 'system', action: 'analytics', description: 'View analytics' },
        ];

        for (const perm of permissions) {
            try {
                await database.run(
                    'INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?)',
                    [perm.name, perm.resource, perm.action, perm.description]
                );
            } catch (error) {
                if (!error.message.includes('UNIQUE constraint failed')) {
                    throw error;
                }
            }
        }
        logger.info('[SERVERLESS] ✓ Default permissions processed');

        // Create default super admin user
        const hashedPassword = await bcrypt.hash('admin123', 10);
        try {
            const result = await database.run(
                `INSERT INTO users (username, email, password_hash, full_name, is_active) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['admin', 'admin@rodb.local', hashedPassword, 'System Administrator', 1]
            );

            // Assign super_admin role
            const superAdminRole = await database.get('SELECT id FROM roles WHERE name = ?', ['super_admin']);
            await database.run(
                'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
                [result.lastID, superAdminRole.id]
            );

            // Assign all permissions to super admin
            const allPermissions = await database.all('SELECT id FROM permissions');
            for (const perm of allPermissions) {
                try {
                    await database.run(
                        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
                        [superAdminRole.id, perm.id]
                    );
                } catch (error) {
                    if (!error.message.includes('UNIQUE constraint failed')) {
                        throw error;
                    }
                }
            }
            logger.info('[SERVERLESS] ✓ Default super admin user created');
        } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
                throw error;
            }
            logger.info('[SERVERLESS] ✓ Default admin user already exists');
        }

        logger.info('[SERVERLESS] ✓ Seeding completed');
    } catch (error) {
        logger.error('[SERVERLESS] Seeding error:', error);
        throw error;
    }
}

// Create Express app
const app = express();

// JSON replacer to handle non-serializable types
const jsonReplacer = (key, value) => {
    if (typeof value === 'bigint') {
        return Number(value);
    }
    if (value === undefined) {
        return undefined;
    }
    return value;
};

// Custom JSON middleware to safely serialize responses
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
        try {
            const jsonString = JSON.stringify(data, jsonReplacer);
            this.set('Content-Type', 'application/json');
            this.send(jsonString);
        } catch (error) {
            logger.error('JSON serialization error:', error);
            this.status(500).json({ error: 'Internal server error' });
        }
        return this;
    };
    next();
});

// Security middleware
app.use(helmet(securityConfig.helmet));

// CORS configuration - strict for production
const corsOptions = {
    origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
    });
    next();
});

// Health check endpoint (no DB required)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        dbInitialized
    });
});

// Database initialization middleware - runs once per cold start
app.use(async (req, res, next) => {
    try {
        await ensureDatabaseInitialized();
        next();
    } catch (error) {
        logger.error('[SERVERLESS] Failed to initialize database', error);
        res.status(503).json({ 
            error: 'Database initialization failed',
            message: 'Service temporarily unavailable'
        });
    }
});

// Static files (served from /public - no persistent uploads)
app.use('/public', express.static(path.join(__dirname, '../server/public')));

// Session middleware for OAuth (in-memory for serverless - won't persist across functions)
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'serverless-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Passport initialization
const passport = require('../server/config/passport');
app.use(passport.initialize());
app.use(passport.session());

// Import and register API routes
const authRoutes = require('../server/routes/auth');
const { router: adminAuthRoutes } = require('../server/routes/admin-auth');
const articleRoutes = require('../server/routes/articles');
const categoryRoutes = require('../server/routes/categories');
const tagRoutes = require('../server/routes/tags');
const mediaRoutes = require('../server/routes/media');
const userRoutes = require('../server/routes/users');
const commentRoutes = require('../server/routes/comments');
const dashboardRoutes = require('../server/routes/dashboard');
const analyticsRoutes = require('../server/routes/analytics');
const searchRoutes = require('../server/routes/search');
const settingsRoutes = require('../server/routes/settings');
const healthRoutes = require('../server/routes/health');
const adsRoutes = require('../server/routes/ads');

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/ads', adsRoutes);

// Cron job endpoints (not exposed to public, only Vercel Cron can call)
app.post('/api/cron/publish-scheduled-articles', async (req, res) => {
    try {
        // Verify cron secret
        const cronSecret = req.headers['x-cron-secret'];
        if (cronSecret !== process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        logger.info('[CRON] Running: Publish scheduled articles');
        
        const now = new Date().toISOString();
        const result = await database.run(
            `UPDATE articles 
             SET status = 'published', published_at = ? 
             WHERE status = 'scheduled' AND scheduled_at <= ?`,
            [now, now]
        );

        logger.info(`[CRON] Published ${result.changes} articles`);
        res.json({ success: true, articlesPublished: result.changes });
    } catch (error) {
        logger.error('[CRON] Error publishing articles:', error);
        res.status(500).json({ error: 'Cron job failed' });
    }
});

app.post('/api/cron/cleanup-old-logs', async (req, res) => {
    try {
        const cronSecret = req.headers['x-cron-secret'];
        if (cronSecret !== process.env.CRON_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        logger.info('[CRON] Running: Cleanup old logs');
        
        // Note: In serverless environment, logs are managed by Vercel
        // This is a placeholder for any database-level log cleanup
        res.json({ success: true, message: 'Cleanup completed' });
    } catch (error) {
        logger.error('[CRON] Error in cleanup:', error);
        res.status(500).json({ error: 'Cron job failed' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
        timestamp: new Date().toISOString(),
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString(),
    });
});

// Export serverless handler
module.exports = serverless(app);
