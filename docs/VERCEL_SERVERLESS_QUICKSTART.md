# Vercel Serverless - Quick Start

## 5-Minute Setup

### 1. Install Dependencies

```bash
npm install serverless-http
```

### 2. Set Environment Variables

Create `.env.vercel` in project root:

```bash
NODE_ENV=production
TURSO_CONNECTION_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token-here
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
SESSION_SECRET=your-session-secret
ADMIN_SECRET=your-admin-secret
CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
CORS_ORIGIN=https://yourdomain.com
```

### 3. Verify API is Serverless-Ready

The `api/index.js` file is already updated with:
- ✅ `serverless-http` wrapper
- ✅ Database initialization on cold start
- ✅ Idempotent schema creation
- ✅ Safe data seeding
- ✅ Cron job handlers
- ✅ Health check endpoint

### 4. Deploy to Vercel

#### Option A: Via CLI

```bash
npm install -g vercel
vercel --prod
```

#### Option B: Via Web UI

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your repository
5. Configure environment variables
6. Click "Deploy"

### 5. Add Environment Variables in Vercel

In Vercel Dashboard:
1. Go to your project
2. **Settings > Environment Variables**
3. Add each variable from `.env.vercel`
4. Select environments (Production, Preview, Development)
5. Save

### 6. Test Deployment

```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health

# Response:
{
  "status": "ok",
  "timestamp": "2026-02-12T10:00:00.000Z",
  "environment": "production",
  "dbInitialized": true
}
```

### 7. Test an API Endpoint

```bash
# Get articles
curl https://your-app.vercel.app/api/articles

# Login
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Done! ✅

Your application is now running on Vercel serverless functions.

---

## Important Notes

### ⚠️ File Uploads

The `/uploads` directory doesn't persist on Vercel. You need:

```bash
npm install @vercel/blob
```

Then update your media routes to use Vercel Blob Storage (see full guide).

### ⚠️ Sessions

In-memory sessions don't persist across function invocations. Use JWT tokens or Redis instead.

### ⚠️ Cron Jobs

Update your environment variable `CRON_SECRET` from the generated value to your Vercel Dashboard.

---

## For More Details

See [docs/VERCEL_SERVERLESS_MIGRATION.md](./VERCEL_SERVERLESS_MIGRATION.md) for:
- Complete architecture guide
- Database initialization details
- Cron job setup
- File upload handling
- Session management
- Performance optimization
- Troubleshooting
