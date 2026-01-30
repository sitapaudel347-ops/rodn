require('dotenv').config();
const database = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;
// Bind to 0.0.0.0 by default to allow port forwarding / external access
const HOST = process.env.HOST || '0.0.0.0';

logger.info('='.repeat(60));
logger.info('RODB Server Starting');
logger.info(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
logger.info(`PORT: ${PORT}`);
logger.info(`HOST: ${HOST}`);
logger.info(`DB_PATH: ${process.env.DB_PATH || 'default (./server/data/rodb.db)'}`);
logger.info('='.repeat(60));

// Routes are defined in app.js - no need to redefine here

let server;

// Seed function (from initDatabase.js)
async function seedDefaultData() {
    logger.info('Checking if default data needs to be seeded...');

    // Check if data already exists
    const existingUser = await database.get('SELECT id FROM users LIMIT 1');
    if (existingUser) {
        logger.info('Data already exists, skipping seed');
        return;
    }

    logger.info('Seeding default data...');
    const bcrypt = require('bcrypt');

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
    logger.info('✓ Default roles created');

    // Create default permissions
    const permissions = [
        // Article permissions
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
        await database.run(
            'INSERT INTO permissions (name, resource, action, description) VALUES (?, ?, ?, ?)',
            [perm.name, perm.resource, perm.action, perm.description]
        );
    }
    logger.info('✓ Default permissions created');

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
    logger.info('✓ Default super admin user created (username: admin, password: admin123)');

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
    logger.info('✓ Default categories created');

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
    logger.info('✓ Organization settings created');

    // Create sample articles to bootstrap the site
    try {
        const localCategory = await database.get('SELECT id FROM categories WHERE slug = ?', ['local-news']);
        const adminUser = await database.get('SELECT id FROM users WHERE username = ?', ['admin']);
        
        if (localCategory && adminUser) {
            const sampleArticles = [
                {
                    headline: 'दोलखामा नयाँ सड़क परियोजना शुरु',
                    sub_headline: 'स्थानीय विकास कार्य तेज हुँदैछ',
                    summary: 'दोलखा जिल्लामा नयाँ सड़क परियोजना सुरु भएको छ। यो परियोजनाले क्षेत्रमा परिवहन सेवा सुधार गर्नेछ।',
                    body: 'दोलखा जिल्लामा नयाँ सड़क परियोजना सुरु भएको छ। यो परियोजनाले क्षेत्रमा परिवहन सेवा सुधार गर्नेछ र स्थानीय अर्थनीति विकसित हुनेछ।',
                    slug: 'naya-sadak-pariyojana-doalkha',
                    category_id: localCategory.id,
                    author_id: adminUser.id,
                    status: 'published',
                    is_featured: 0,
                    is_breaking: 1,
                },
                {
                    headline: 'दोलखामा स्वास्थ्य सेवा केन्द्र भर्सन हुँदै छ',
                    sub_headline: 'स्थानीय स्वास्थ्य सुविधा सुधार',
                    summary: 'दोलखा जिल्लामा नयाँ स्वास्थ्य सेवा केन्द्र स्थापन गरिन् जसले क्षेत्रीय स्वास्थ्य सेवा अनुकूल बनाउनेछ।',
                    body: 'दोलखा जिल्लामा नयाँ स्वास्थ्य सेवा केन्द्र स्थापन गरिएको छ। यो केन्द्रले स्थानीय जनताको स्वास्थ्य सेवा प्रदान गर्नेछ।',
                    slug: 'swasthya-sewa-kendra-doalkha',
                    category_id: localCategory.id,
                    author_id: adminUser.id,
                    status: 'published',
                    is_featured: 1,
                },
                {
                    headline: 'बजार में नयाँ व्यापार केन्द्र खोलिएको',
                    sub_headline: 'व्यापार गतिविधि बृद्धि हुँदैछ',
                    summary: 'दोलखा जिल्लामा नयाँ व्यापार केन्द्र खोलिएको छ जसले स्थानीय अर्थनीति मजबुत गर्नेछ।',
                    body: 'दोलखा जिल्लामा नयाँ व्यापार केन्द्र खोलिएको छ। यो केन्द्रले छोटो व्यवसायीहरुलाई आवश्यक सहयोग प्रदान गर्नेछ।',
                    slug: 'vyapar-kendra-khola',
                    category_id: localCategory.id,
                    author_id: adminUser.id,
                    status: 'published',
                    is_featured: 0,
                },
                {
                    headline: 'शिक्षा क्षेत्रमा नयाँ पहल भएको',
                    sub_headline: 'शिक्षा गुणस्तर सुधार',
                    summary: 'दोलखामा शिक्षा गुणस्तर सुधारका लागि नयाँ पहल भएको छ।',
                    body: 'दोलखामा शिक्षा गुणस्तर सुधारका लागि नयाँ पहल भएको छ। यो पहलले विद्यार्थीहरुको शिक्षा स्तर सुधार गर्नेछ।',
                    slug: 'shiksha-gun-sudhaar',
                    category_id: localCategory.id,
                    author_id: adminUser.id,
                    status: 'published',
                    is_featured: 0,
                },
                {
                    headline: 'सांस्कृतिक कार्यक्रम सफलतासाथ सम्पन्न',
                    sub_headline: 'स्थानीय संस्कृति प्रदर्शन',
                    summary: 'दोलखामा आयोजित सांस्कृतिक कार्यक्रम सफलतासाथ सम्पन्न भएको छ।',
                    body: 'दोलखामा आयोजित सांस्कृतिक कार्यक्रम सफलतासाथ सम्पन्न भएको छ। यो कार्यक्रमले स्थानीय संस्कृति र परम्परा प्रदर्शन गरेको छ।',
                    slug: 'sanskritik-karyakram',
                    category_id: localCategory.id,
                    author_id: adminUser.id,
                    status: 'published',
                    is_featured: 0,
                },
            ];

            for (const article of sampleArticles) {
                const wordCount = article.body.split(/\s+/).length;
                const reading_time = Math.ceil(wordCount / 200);
                
                await database.run(
                    `INSERT INTO articles (
                        headline, sub_headline, summary, body, slug,
                        category_id, author_id, language, status, is_featured, is_breaking, reading_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        article.headline, article.sub_headline, article.summary, article.body, article.slug,
                        article.category_id, article.author_id, 'ne', article.status, article.is_featured || 0, article.is_breaking || 0, reading_time
                    ]
                );
            }
            logger.info('✓ Sample articles created');
        }
    } catch (articleError) {
        logger.warn('Could not seed sample articles (may already exist):', articleError.message);
    }

    logger.info('✓ Default data seeded successfully');
}

async function startServer() {
    try {
        // Initialize database FIRST before loading app (which loads routes/models)
        logger.info('Initializing database...');
        await database.initialize();
        logger.info('✓ Database initialized successfully');

        // Create schema if tables don't exist
        try {
            logger.info('Checking/creating database schema...');
            const { createSchema } = require('./config/schema');
            await createSchema();
            logger.info('✓ Database schema ready');
        } catch (schemaError) {
            logger.error('Schema creation error (might be OK if already exists):', schemaError.message);
        }

        // Seed default data if needed
        try {
            await seedDefaultData();
        } catch (seedError) {
            logger.error('Seed data error:', seedError.message);
        }
        
        // NOW load the app after database is ready
        logger.info('Loading Express app...');
        const app = require('./app');
        logger.info('✓ Express app loaded');

        // Auto-publish approved articles
        try {
            const Article = require('./models/Article');
            const publishedCount = await Article.autoPublishApproved();
            logger.info(`Auto-published ${publishedCount} approved articles (if any).`);
        } catch (err) {
            logger.error('Auto-publish error:', err);
        }

        // Start server
        server = app.listen(PORT, HOST, () => {
            logger.info('='.repeat(60));
            logger.info('✓ Server running successfully!');
            logger.info(`  URL: http://${HOST}:${PORT}`);
            logger.info(`  Admin: http://${HOST}:${PORT}/admin (Ctrl+Alt+A)`);
            logger.info(`  Health: http://${HOST}:${PORT}/api/health`);
            logger.info('='.repeat(60));
        });

        // Graceful shutdown
        process.on('SIGTERM', gracefulShutdown);
        process.on('SIGINT', gracefulShutdown);

    } catch (error) {
        logger.error('='.repeat(60));
        logger.error('✗ Failed to start server:');
        logger.error(error);
        logger.error('='.repeat(60));
        process.exit(1);
    }
}

async function gracefulShutdown() {
    logger.info('Received shutdown signal, closing server gracefully...');

    if (server) {
        server.close(async () => {
            logger.info('HTTP server closed');

            try {
                await database.close();
                logger.info('Database connection closed');
                process.exit(0);
            } catch (error) {
                logger.error('Error closing database:', error);
                process.exit(1);
            }
        });
    }
}

// Start the server
startServer();
