const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const securityConfig = require('./config/security');
const logger = require('./utils/logger');

// JSON replacer to handle non-serializable types
const jsonReplacer = (key, value) => {
    // Handle BigInt
    if (typeof value === 'bigint') {
        return Number(value);
    }
    // Filter out undefined and circular references
    if (value === undefined) {
        return undefined;
    }
    // Keep everything else as-is (JSON natively supports boolean, null, string, number, array, object)
    return value;
};

// Import routes
const authRoutes = require('./routes/auth');
const { router: adminAuthRoutes } = require('./routes/admin-auth');
const articleRoutes = require('./routes/articles');
const categoryRoutes = require('./routes/categories');
const tagRoutes = require('./routes/tags');
const mediaRoutes = require('./routes/media');
const userRoutes = require('./routes/users');
const commentRoutes = require('./routes/comments');
const dashboardRoutes = require('./routes/dashboard');
const analyticsRoutes = require('./routes/analytics');
const searchRoutes = require('./routes/search');
const settingsRoutes = require('./routes/settings');
const healthRoutes = require('./routes/health');
const adsRoutes = require('./routes/ads');

const app = express();

// Custom JSON middleware to safely serialize responses
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
    // Override res.json to use our custom replacer
    const originalJson = res.json;
    res.json = function (data) {
        try {
            // Use our replacer to handle unsupported types
            const jsonString = JSON.stringify(data, jsonReplacer);
            this.set('Content-Type', 'application/json');
            this.send(jsonString);
        } catch (error) {
            logger.error('JSON serialization error:', error);
            // Fallback: try to send the data without the problematic parts
            const safeData = cleanObjectForJSON(data);
            this.set('Content-Type', 'application/json');
            this.send(JSON.stringify(safeData));
        }
        return this;
    };
    next();
});

// Security middleware
app.use(helmet(securityConfig.helmet));
app.use(cors(securityConfig.cors));

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

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Session middleware for OAuth
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'default-session-secret-change-this-in-production',
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
const passport = require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin-auth', adminAuthRoutes);
app.use('/api/oauth', require('./routes/oauth'));
app.use('/api/journalist', require('./routes/journalist'));
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
app.use('/api/navigation', require('./routes/navigation'));

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/site/index.html'));
});

app.get('/article.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/site/article.html'));
});

app.get('/category/:slug', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/site/index.html'));
});

app.get('/journalist', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/journalist/dashboard.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Application error:', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
    });

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
});

// Helper function to clean objects for JSON serialization
function cleanObjectForJSON(obj, depth = 0) {
    if (depth > 50) return null; // Prevent infinite recursion
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'bigint') return Number(obj);
    if (typeof obj === 'boolean') return obj;
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number') return obj;

    if (obj instanceof Date) return obj.toISOString();

    if (Array.isArray(obj)) {
        return obj.map(item => cleanObjectForJSON(item, depth + 1));
    }

    if (typeof obj === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value !== 'function' && typeof value !== 'symbol') {
                cleaned[key] = cleanObjectForJSON(value, depth + 1);
            }
        }
        return cleaned;
    }

    return undefined;
}

module.exports = app;