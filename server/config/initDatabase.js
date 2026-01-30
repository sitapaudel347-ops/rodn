require('dotenv').config();
const database = require('./database');
const { createSchema } = require('./schema');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

async function initializeDatabase() {
    try {
        logger.info('Starting database initialization...');

        // Initialize database connection
        await database.initialize();

        // Create schema
        await createSchema();

        // Seed default data
        await seedDefaultData();

        logger.info('Database initialization completed successfully');
        process.exit(0);
    } catch (error) {
        logger.error('Database initialization failed:', error);
        process.exit(1);
    }
}

async function seedDefaultData() {
    logger.info('Seeding default data...');

    // Check if data already exists
    const existingUser = await database.get('SELECT id FROM users LIMIT 1');
    if (existingUser) {
        logger.info('Data already exists, skipping seed');
        return;
    }

    // Create default roles
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
        await database.run(
            'INSERT INTO roles (name, description) VALUES (?, ?)',
            [role.name, role.description]
        );
    }
    logger.info('Default roles created');

    // Create default permissions
    const permissions = [
        // Article permissions
        { name: 'article.create', resource: 'article', action: 'create', description: 'Create articles' },
        { name: 'article.read', resource: 'article', action: 'read', description: 'Read articles' },
        { name: 'article.update', resource: 'article', action: 'update', description: 'Update articles' },
        { name: 'article.delete', resource: 'article', action: 'delete', description: 'Delete articles' },
        { name: 'article.publish', resource: 'article', action: 'publish', description: 'Publish articles' },
        { name: 'article.approve', resource: 'article', action: 'approve', description: 'Approve articles' },

        // User permissions
        { name: 'user.create', resource: 'user', action: 'create', description: 'Create users' },
        { name: 'user.read', resource: 'user', action: 'read', description: 'Read user data' },
        { name: 'user.update', resource: 'user', action: 'update', description: 'Update users' },
        { name: 'user.delete', resource: 'user', action: 'delete', description: 'Delete users' },

        // Category permissions
        { name: 'category.manage', resource: 'category', action: 'manage', description: 'Manage categories' },

        // Ads permissions
        { name: 'ads.manage', resource: 'ads', action: 'manage', description: 'Manage advertisements' },

        // Media permissions
        { name: 'media.upload', resource: 'media', action: 'upload', description: 'Upload media' },
        { name: 'media.manage', resource: 'media', action: 'manage', description: 'Manage media library' },

        // Comment permissions
        { name: 'comment.moderate', resource: 'comment', action: 'moderate', description: 'Moderate comments' },

        // System permissions
        { name: 'system.settings', resource: 'system', action: 'settings', description: 'Manage system settings' },
        { name: 'system.analytics', resource: 'system', action: 'analytics', description: 'View analytics' },
    ];

    for (const perm of permissions) {
        await database.run(
            'INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?)',
            [perm.name, perm.resource, perm.action, perm.description]
        );
    }
    logger.info('Default permissions created');

    // Assign permissions to roles
    const superAdminRole = await database.get('SELECT id FROM roles WHERE name = ?', ['super_admin']);
    const allPermissions = await database.all('SELECT id FROM permissions');

    // Super admin gets all permissions
    for (const perm of allPermissions) {
        await database.run(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
            [superAdminRole.id, perm.id]
        );
    }

    // Create default super admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const result = await database.run(
        `INSERT INTO users (username, email, password_hash, full_name, is_active) 
     VALUES (?, ?, ?, ?, ?)`,
        ['admin', 'rodb.dhulikhel@gmail.com', hashedPassword, 'System Administrator', 1]
    );

    // Assign super admin role to default user
    await database.run(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [result.lastID, superAdminRole.id]
    );
    logger.info('Default super admin user created (username: admin, password: admin123)');

    // Create default categories
    const categories = [
        { name: 'Local News', slug: 'local-news', description: 'News from Dhulikhel and surrounding areas' },
        { name: 'National', slug: 'national', description: 'National news from Nepal' },
        { name: 'International', slug: 'international', description: 'International news' },
        { name: 'Politics', slug: 'politics', description: 'Political news and analysis' },
        { name: 'Business', slug: 'business', description: 'Business and economy news' },
        { name: 'Sports', slug: 'sports', description: 'Sports news and updates' },
        { name: 'Entertainment', slug: 'entertainment', description: 'Entertainment and culture' },
        { name: 'Technology', slug: 'technology', description: 'Technology and innovation' },
        { name: 'Health', slug: 'health', description: 'Health and wellness' },
        { name: 'Education', slug: 'education', description: 'Education news' },
    ];

    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        await database.run(
            'INSERT INTO categories (name, slug, description, display_order, is_enabled) VALUES (?, ?, ?, ?, ?)',
            [cat.name, cat.slug, cat.description, i + 1, 1]
        );
    }
    logger.info('Default categories created');

    // Create organization settings
    const settings = [
        { key: 'org_name', value: 'Routine of Dhulikhel News', type: 'string' },
        { key: 'org_short_name', value: 'rodb', type: 'string' },
        { key: 'org_founded', value: '2022-07-15', type: 'date' },
        { key: 'org_address', value: 'Dhulikhel, Nepal', type: 'string' },
        { key: 'org_province', value: 'Province No. 3', type: 'string' },
        { key: 'org_email', value: 'rodb.dhulikhel@gmail.com', type: 'string' },
        { key: 'org_tiktok', value: 'routineof.dhulikhelbanda', type: 'string' },
        { key: 'org_youtube', value: 'https://www.youtube.com/@RoutineOfDhulikhelBanda', type: 'string' },
        { key: 'site_title', value: 'Routine of Dhulikhel News - Local News', type: 'string' },
        { key: 'site_description', value: 'A local yet authoritative Nepali news organization serving Dhulikhel and surrounding regions', type: 'string' },
        { key: 'maintenance_mode', value: 'false', type: 'boolean' },
        { key: 'allow_comments', value: 'true', type: 'boolean' },
        { key: 'allow_registration', value: 'true', type: 'boolean' },
    ];

    for (const setting of settings) {
        await database.run(
            'INSERT INTO settings (key, value, type) VALUES (?, ?, ?)',
            [setting.key, setting.value, setting.type]
        );
    }
    logger.info('Organization settings created');

    logger.info('Default data seeded successfully');
}

// Run initialization
initializeDatabase();
