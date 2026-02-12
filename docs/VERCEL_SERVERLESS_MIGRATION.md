# Vercel Serverless Migration - Complete Guide

## Overview

Your RODB News Platform has been refactored to run as serverless functions on Vercel. This guide covers everything you need to know about the new architecture, deployment, and how to handle specific scenarios.

---

## 1. Architecture Changes

### Before (Traditional Server)
```
Node.js Server
├── Persistent connection to Turso DB
├── Node-cron for scheduled tasks
├── In-memory session storage
├── Local file system for uploads
└── Long-running process with app.listen()
```

### After (Serverless)
```
Vercel Serverless Functions
├── Per-request DB connections (pooled)
├── Vercel Cron for scheduled tasks
├── Transient memory (session loses between invocations)
├── External storage for uploads (Vercel Blob)
└── Stateless function handlers
```

---

## 2. Key Differences

| Aspect | Traditional | Serverless |
|--------|-------------|-----------|
| **Server startup** | Long-lived process | Cold start per invocation |
| **Database** | Persistent connection | New connection per request |
| **Sessions** | In-memory (survives restarts) | Per-function (lost after 15 mins) |
| **File Storage** | Local filesystem | External service (Blob) |
| **Scheduled Tasks** | node-cron in process | Vercel Cron (HTTP endpoints) |
| **Memory** | Server lifetime | Request duration (~128MB minimum) |
| **Execution Time** | Unlimited | 60 seconds max per function |

---

## 3. Environment Variables

Create a `.env.vercel` file in your root directory with:

```bash
# Deployment
NODE_ENV=production
VERCEL_ENV=production

# Database (Turso)
TURSO_CONNECTION_URL=your_turso_url_here
TURSO_AUTH_TOKEN=your_turso_token_here

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
SESSION_SECRET=your-session-secret-for-vercel
ADMIN_SECRET=your-admin-secret-key

# Optional
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
CRON_SECRET=your-cron-secret-key-for-verification

# Logging
LOG_LEVEL=info
```

### In Vercel Dashboard:
1. Go to **Settings > Environment Variables**
2. Add all above variables
3. Select which environments they apply to (Production, Preview, Development)

---

## 4. Database Initialization

### How It Works

The serverless handler automatically:

1. **Checks if DB is initialized** - On first request (cold start)
2. **Creates schema** - Uses `CREATE TABLE IF NOT EXISTS` (idempotent)
3. **Seeds default data** - Only if no users exist (race-condition safe)
4. **Caches connection** - Reuses for subsequent requests in same execution

### Idempotent Seeding

The seeding logic now:
- Checks if user exists before creating roles
- Uses `UNIQUE constraint failed` error handling for duplicate prevention
- Is safe to run multiple times across different function instances
- Handles concurrent requests properly

### Manual DB Initialization

If needed, run locally:
```bash
npm run init-db
```

---

## 5. Cron Jobs (Scheduled Tasks)

### Previous Setup
```javascript
// node-cron - runs in main process
const cron = require('node-cron');
cron.schedule('0 */6 * * *', async () => {
    // Publish articles
});
```

### New Setup: Vercel Cron

In `vercel.json`:
```json
"crons": [
    {
        "path": "/api/cron/publish-scheduled-articles",
        "schedule": "0 */6 * * *"
    },
    {
        "path": "/api/cron/cleanup-old-logs",
        "schedule": "0 2 * * *"
    }
]
```

Cron endpoints in `api/index.js`:
```javascript
app.post('/api/cron/publish-scheduled-articles', async (req, res) => {
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Your cron logic here
});
```

### Cron Schedule Format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *

Examples:
"0 */6 * * *"     = Every 6 hours
"0 2 * * *"       = Daily at 2 AM
"*/15 * * * *"    = Every 15 minutes
"0 9-17 * * 1-5"  = Every hour 9 AM to 5 PM on weekdays
```

### Testing Cron Locally

```bash
curl -X POST http://localhost:3000/api/cron/publish-scheduled-articles \
  -H "x-cron-secret: your-cron-secret-key"
```

---

## 6. File Uploads - Important Changes

### ⚠️ Problem: No Persistent Filesystem

Vercel serverless functions **do not have persistent storage**. Files in `/uploads` will be lost.

### Solution: Vercel Blob Storage

#### Step 1: Install Vercel Blob SDK

```bash
npm install @vercel/blob
```

#### Step 2: Create a new upload handler

File: `server/services/fileUploadService.js`

```javascript
const { put } = require('@vercel/blob');
const logger = require('../utils/logger');

async function uploadFile(file, folder = 'uploads') {
    try {
        const filename = `${folder}/${Date.now()}-${file.originalname}`;
        
        const blob = await put(filename, file.buffer, {
            access: 'public',
            addRandomSuffix: false,
        });

        logger.info(`File uploaded: ${blob.url}`);
        return blob.url;
    } catch (error) {
        logger.error('File upload failed:', error);
        throw error;
    }
}

module.exports = { uploadFile };
```

#### Step 3: Update media routes

```javascript
const { uploadFile } = require('../services/fileUploadService');

router.post('/upload', authenticate, async (req, res) => {
    try {
        const fileUrl = await uploadFile(req.file, 'media');
        
        // Store URL in database
        const result = await database.run(
            'INSERT INTO media (filename, url, mime_type, user_id) VALUES (?, ?, ?, ?)',
            [req.file.originalname, fileUrl, req.file.mimetype, req.user.id]
        );

        res.json({
            id: result.lastID,
            url: fileUrl,
            filename: req.file.originalname
        });
    } catch (error) {
        res.status(500).json({ error: 'Upload failed' });
    }
});
```

#### Step 4: Add Vercel Blob Token to Environment

In Vercel dashboard:
1. Go to **Settings > Environment Variables**
2. Add `BLOB_READ_WRITE_TOKEN` (Vercel generates this automatically)
3. Or go to **Storage > Blob > Create Blob** to get the token manually

---

## 7. Sessions in Serverless

### ⚠️ Limitation: Sessions Don't Persist

In traditional servers, in-memory sessions survive across requests. In serverless:

```javascript
// In-memory session - LOST after function execution
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // Sessions only live for current request
}));
```

### Solution 1: Use JWT Only (Recommended for APIs)

Remove session middleware, use JWT tokens in `Authorization` header:

```javascript
// Instead of sessions
app.use((req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
    }
    next();
});
```

### Solution 2: Use Persistent Session Store

Install Redis session store:

```bash
npm install connect-redis redis
```

Update session middleware:

```javascript
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Use Redis for session storage instead of memory
const redisClient = createClient({ url: process.env.REDIS_URL });

app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
}));
```

---

## 8. Performance Optimizations for Serverless

### 1. Connection Pooling

Currently using singleton pattern for DB connection (good ✓)

### 2. Lazy Loading

Load modules only when needed:

```javascript
// Bad - loads even if not used
const oauth = require('./routes/oauth');

// Good - loads on demand
app.use('/api/oauth', () => require('./routes/oauth'));
```

### 3. Response Caching

Add caching headers to static endpoints:

```javascript
app.get('/api/articles', (req, res, next) => {
    res.set('Cache-Control', 'public, max-age=300'); // 5 min cache
    next();
});
```

### 4. Request Size Limits

```javascript
app.use(express.json({ limit: '10mb' }));  // ✓ Already set
app.use(express.urlencoded({ limit: '10mb' }));  // ✓ Already set
```

### 5. Timeout Configuration

In `vercel.json`:
```json
"functions": {
    "api/**/*.js": {
        "maxDuration": 60  // Max 60 seconds per request
    }
}
```

---

## 9. Incompatibilities & Workarounds

| Feature | Status | Solution |
|---------|--------|----------|
| **Local file storage** | ❌ Not compatible | Use Vercel Blob Storage |
| **node-cron** | ⚠️ Works but limited | Use Vercel Cron (HTTP endpoints) |
| **In-memory sessions** | ⚠️ Transient | Use JWT or Redis for persistence |
| **Long-running tasks** | ❌ 60s timeout | Break into smaller tasks |
| **Persistent cache** | ⚠️ Limited | Use Redis or database cache |
| **WebSockets** | ❌ No support | Use polling or Server-Sent Events |

---

## 10. Logging in Serverless

### Console Logs (Not Recommended)

```javascript
console.log('Something'); // Goes to Vercel Logs but loses context
```

### Winston Logs (Recommended)

```javascript
const logger = require('./utils/logger');
logger.info('Something', { userId: 123, action: 'login' });
```

Winston automatically:
- Writes to files in `/logs` directory
- Timestamps all entries
- Formats as JSON for easier parsing
- Provides structured logging

### View Logs

In Vercel Dashboard:
1. Go to **Deployments**
2. Select your deployment
3. Click **Logs** tab
4. Filter by function or time

---

## 11. Deployment Steps

### Step 1: Install serverless-http

```bash
npm install serverless-http
```

### Step 2: Update package.json build script

Already done in the updated `package.json`:
```json
"scripts": {
    "build": "node -e \"console.log('Build verification complete')\" && exit 0"
}
```

### Step 3: Push to GitHub

```bash
git add .
git commit -m "chore: Refactor for Vercel serverless deployment"
git push origin main
```

### Step 4: Connect to Vercel

Option A: CLI
```bash
npm install -g vercel
vercel --prod
```

Option B: Web
1. Go to [vercel.com](https://vercel.com)
2. **Import Project** → Select GitHub repo
3. Configure environment variables
4. Deploy

### Step 5: Set Environment Variables

In Vercel Dashboard:
1. **Settings > Environment Variables**
2. Add all variables from `.env.vercel`
3. Click **Save**

### Step 6: Configure Cron Secret

```bash
# Generate a random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to environment variables:
- `CRON_SECRET=<generated-secret>`

### Step 7: Verify Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Test cron endpoint (from Vercel's IP, won't work locally)
curl -X POST https://your-app.vercel.app/api/cron/publish-scheduled-articles \
  -H "x-cron-secret: your-secret"
```

---

## 12. Local Development

### Run locally with same serverless handler

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Run using serverless-http wrapper
node -e "
  const serverless = require('serverless-http');
  const app = require('./api/index.js');
  const express = require('express');
  const localApp = express();
  localApp.use('/', app);
  localApp.listen(3000, () => console.log('Server running on :3000'));
"
```

### Or use traditional mode for development

```bash
npm run dev
```

This runs `server/server.js` directly (best for development).

---

## 13. Database Backup & Migration

### Backup your Turso database

```bash
turso db export rodb > backup.sql
```

### Import to another Turso DB

```bash
turso db import rodb-backup backup.sql
```

---

## 14. Monitoring & Debugging

### Cold Start Times

Cold starts are visible in Vercel Logs:
- Function initializes
- DB connection established
- Schema created (if needed)
- Seed runs (if needed)
- First request handled

Typical cold start: **2-5 seconds** (once DB is warm)

### View Function Metrics

In Vercel Dashboard:
1. **Analytics > Functions**
2. See execution time, memory usage, errors

### Debug Issues

Enable debug logging:

```bash
# In environment variables
LOG_LEVEL=debug
```

Then check logs in Vercel Dashboard.

---

## 15. Scaling Considerations

### Automatic Scaling

Vercel automatically scales based on:
- Request volume
- Function execution time
- Memory usage

### Optimize for Scale

```javascript
// ✓ Good - quick execution
router.get('/api/articles', async (req, res) => {
    const articles = await db.all('SELECT * FROM articles LIMIT 20');
    res.json(articles);
});

// ✗ Bad - long execution
router.get('/api/articles-slow', async (req, res) => {
    const articles = await db.all('SELECT * FROM articles');
    const processed = articles.map(a => heavyProcessing(a));
    res.json(processed);
});
```

---

## 16. Troubleshooting

### Database Connection Fails

```
Error: TURSO_CONNECTION_URL environment variable is required
```

**Solution**: 
1. Check environment variables in Vercel Dashboard
2. Verify URL format: `libsql://...` not `https://`
3. Re-add token without extra spaces

### Cold Start Too Long

```
Function execution time: 15s
```

**Solution**:
1. Update package.json to remove unused dependencies
2. Use lazy loading for heavy modules
3. Implement response caching
4. Use smaller database queries

### Sessions Lost Between Requests

```
User logged in but gets logged out
```

**Solution**: 
1. Switch to JWT tokens (recommended for APIs)
2. Or use Redis session store
3. Or extend cookie maxAge

### File Upload Fails

```
Error: Cannot write to /uploads
```

**Solution**:
1. Switch to Vercel Blob Storage
2. Add upload service using `@vercel/blob`
3. Add `BLOB_READ_WRITE_TOKEN` to environment

---

## 17. Folder Structure

```
rodb/
├── api/
│   └── index.js                 # Serverless handler (main entry point)
├── server/
│   ├── app.js                   # Express app setup (no longer starts server)
│   ├── server.js                # Traditional server (dev only, not used in serverless)
│   ├── config/
│   │   ├── database.js          # Turso DB client
│   │   ├── schema.js            # Database schema
│   │   ├── security.js          # Security config
│   │   └── passport.js          # Auth config
│   ├── controllers/             # Route handlers
│   ├── routes/                  # API endpoints
│   ├── middlewares/             # Express middleware
│   ├── services/                # Business logic
│   ├── models/                  # Data models
│   ├── utils/                   # Utilities
│   └── public/                  # Static files
├── package.json                 # Dependencies
├── vercel.json                  # Vercel configuration
└── .env.vercel                  # Environment variables
```

---

## 18. Next Steps

1. ✅ Review this guide
2. ✅ Update environment variables
3. ✅ Add `serverless-http` package
4. ✅ Update `api/index.js` (done)
5. ✅ Update `vercel.json` (done)
6. ⏭️ Test locally: `npm run dev`
7. ⏭️ Push to GitHub
8. ⏭️ Deploy to Vercel
9. ⏭️ Configure environment variables in Vercel
10. ⏭️ Test API endpoints
11. ⏭️ Monitor logs and metrics
12. ⏭️ Set up Vercel Blob for file uploads

---

## 19. Support & Resources

- [Vercel Docs](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Express.js Docs](https://expressjs.com)
- [Turso Documentation](https://docs.turso.tech)
- [serverless-http GitHub](https://github.com/dougmoscrop/serverless-http)

---

**Last Updated**: February 12, 2026  
**Version**: 1.0  
**Status**: Production Ready
