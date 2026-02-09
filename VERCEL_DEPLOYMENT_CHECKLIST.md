# Vercel Deployment Checklist

## Pre-Deployment ✓

- [x] All syntax checked and verified
- [x] Dependencies installed and compatible with Vercel
- [x] vercel.json configured for serverless functions
- [x] api/index.js updated to handle Vercel execution
- [x] Environment variables documented
- [x] Database routes configured for /public and /uploads
- [x] Session configuration updated with sameSite cookie policy
- [x] Build script optimized for Vercel
- [x] Node.js 18.x specified in package.json

## Deployment Steps (In Order)

### 1. Generate Secret Keys
Run locally and save outputs:
```bash
node -e "console.log('JWT_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Create Turso Database
```bash
npm install -g @turso/cli
turso auth login
turso db create rodb-news
turso db tokens create rodb-news
```
Save the connection URL and token.

### 3. Deploy to Vercel
1. Go to https://vercel.com/new
2. Import GitHub repository
3. Select project from list
4. Skip framework selection (using "Other")
5. Click "Deploy"

### 4. Add Environment Variables in Vercel
After project is created, go to **Settings > Environment Variables** and add:

**Required Variables:**
```
NODE_ENV=production
TURSO_CONNECTION_URL=libsql://rodb-news-xxxxx.turso.io
TURSO_AUTH_TOKEN=your-token-here
JWT_SECRET=your-generated-secret
JWT_REFRESH_SECRET=your-generated-secret
SESSION_SECRET=your-generated-secret
ADMIN_SECRET=secure-admin-secret
```

**Optional Variables:**
```
LOG_LEVEL=info
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
ORG_NAME=Routine of Dhulikhel Banda
ORG_EMAIL=rodb.dhulikhel@gmail.com
```

### 5. Trigger Redeployment
After adding environment variables:
1. Go to **Deployments**
2. Click **Redeploy** on the latest deployment
3. Select "Use existing Environment Variables"
4. Wait for build to complete

### 6. Verify Deployment
Once deployed, test these endpoints:
```bash
# Health check
curl https://your-app.vercel.app/api/health

# Admin panel (should load)
https://your-app.vercel.app/admin

# Main site (should load)
https://your-app.vercel.app
```

## Post-Deployment

### Database Initialization
- [ ] Database is created and tables exist
- [ ] Default admin user created (check logs)
- [ ] Health endpoint returns 200

### Testing
- [ ] Admin login works
- [ ] Create test article
- [ ] Upload test image
- [ ] Check article on public site
- [ ] Try category/tag navigation
- [ ] Test search functionality

### Monitoring
- [ ] Monitor Vercel Deployments > Functions for errors
- [ ] Check error rates and response times
- [ ] Set up alerts for errors (optional)

### Domain Configuration (Optional)
1. In Vercel project settings > Domains
2. Add custom domain
3. Follow DNS configuration instructions
4. Wait for SSL certificate (automatic)

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Database connection failed** | Verify TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN in Vercel settings |
| **Build failed: Dependencies** | Run `npm install` locally, verify all packages are in package.json |
| **Static files not serving** | Check vercel.json routes and ensure /public and /uploads directories exist |
| **Deployment keeps failing** | Check Vercel build logs - look for environment variable errors |
| **Environment variables not loading** | Redeploy after adding variables, they don't apply to existing deployments |
| **Admin panel returns 404** | Check that public/admin/index.html exists and routes are correct |
| **CORS errors from frontend** | Configure CORS in server/config/security.js for your domain |

## Rollback Plan

If deployment fails:
1. Previous deployments are preserved in Vercel
2. Go to **Deployments** tab
3. Click **Promote to Production** on a previous working version
4. Investigate issues and fix in code
5. Push to GitHub to trigger new deployment

## Production Security Checklist

- [ ] Admin credentials changed from defaults
- [ ] JWT secrets are strong (32+ hex characters)
- [ ] SESSION_SECRET is strong and unique
- [ ] HTTPS is enabled (automatic on Vercel)
- [ ] CORS is configured for your domain only
- [ ] Rate limiting is active for login attempts
- [ ] File uploads are restricted to allowed types
- [ ] Database backups are enabled (Turso feature)
- [ ] Environment variables are not in git
- [ ] .env files are in .gitignore

## Monitoring & Logs

**Check logs in Vercel:**
1. Go to Vercel Dashboard
2. Select Project
3. Go to **Deployments**
4. Click latest deployment
5. Click **Function Logs** to see real-time logs

**Local development with same environment:**
```bash
# Set environment variables locally
export NODE_ENV=production
export TURSO_CONNECTION_URL=your-url
export TURSO_AUTH_TOKEN=your-token
npm start
```

## Important Notes

⚠️ **Vercel Limitations:**
- Max function duration: 60 seconds (as configured)
- Memory: 1024 MB
- File uploads to /uploads persist only during function runtime
- For permanent file storage, use external service (AWS S3, etc.)

📝 **Serverless Architecture:**
- Each request starts a fresh Node.js process
- Database connections are created per request
- Use connection pooling (Turso handles this)
- No persistent file storage without external service

🔄 **Deployment Cycle:**
1. Code push to GitHub
2. Vercel detects change
3. Automatic build triggered
4. Tests run (if configured)
5. Deploy to production
6. Automatic SSL certificate

## Next Steps

After successful deployment:
1. Test admin functionality
2. Publish test article
3. Verify search and filtering
4. Monitor performance metrics
5. Set up monitoring alerts
6. Document your Vercel setup
7. Share deployment URL with team

## Support

For issues:
1. Check Vercel logs: Deployments > Function Logs
2. Review environment variables
3. Test locally with same environment
4. Check GitHub Issues
5. Verify Turso database is accessible

---
**Last Updated:** 2026-02-09  
**Status:** Ready for Deployment ✅
