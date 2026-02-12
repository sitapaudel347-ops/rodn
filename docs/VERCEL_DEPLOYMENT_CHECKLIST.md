# Vercel Deployment Checklist

## Pre-Deployment

### Code Preparation
- [x] Refactored `api/index.js` with serverless handler
- [x] Added `serverless-http` to package.json
- [x] Updated `vercel.json` with configuration
- [x] Made database seeding idempotent
- [x] Added cron job endpoints
- [ ] Tested locally: `npm run dev`
- [ ] All endpoints returning correct responses
- [ ] No hardcoded URLs or secrets in code

### Security
- [ ] All secrets moved to environment variables
- [ ] JWT_SECRET is strong (32+ characters)
- [ ] CRON_SECRET is randomly generated
- [ ] No sensitive data in logs
- [ ] CORS_ORIGIN matches your domain
- [ ] Rate limiting configured

### Database
- [ ] Turso database created
- [ ] TURSO_CONNECTION_URL obtained
- [ ] TURSO_AUTH_TOKEN obtained
- [ ] Database schema tested locally
- [ ] Sample data seeded locally
- [ ] Connection tested from Vercel

### Git Repository
- [ ] Code pushed to GitHub
- [ ] `.env` file in `.gitignore`
- [ ] No secrets in git history
- [ ] Clean commit history

---

## Deployment Steps

### 1. Create Vercel Project
- [ ] Create account at [vercel.com](https://vercel.com)
- [ ] Import GitHub repository
- [ ] Name project (e.g., `rodb`)
- [ ] Verify project detected correctly

### 2. Configure Environment Variables
In Vercel Dashboard → Settings → Environment Variables:

```
☐ NODE_ENV = production
☐ TURSO_CONNECTION_URL = libsql://[your-url]
☐ TURSO_AUTH_TOKEN = [your-token]
☐ JWT_SECRET = [generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
☐ JWT_REFRESH_SECRET = [generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
☐ SESSION_SECRET = [generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
☐ ADMIN_SECRET = [generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
☐ CRON_SECRET = [generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
☐ CORS_ORIGIN = https://yourdomain.com (or * for testing)
☐ FRONTEND_URL = https://yourdomain.com
```

### 3. Set Environment Scope
For each variable:
- [ ] Production: ✓
- [ ] Preview: ✓
- [ ] Development: ✓

### 4. Deploy
- [ ] Click "Deploy" button
- [ ] Wait for build to complete (should be < 1 minute)
- [ ] Verify no build errors
- [ ] Check deployment logs

---

## Post-Deployment

### Immediate Testing
```bash
# Test health endpoint
curl https://your-app.vercel.app/api/health
# Expected: { "status": "ok", "dbInitialized": true }

# Test API
curl https://your-app.vercel.app/api/articles
# Expected: List of articles or empty array
```

### Functional Testing
- [ ] Login works: POST /api/auth/login
- [ ] Can create article: POST /api/articles
- [ ] Can read articles: GET /api/articles
- [ ] Can update article: PUT /api/articles/:id
- [ ] Can delete article: DELETE /api/articles/:id
- [ ] Permissions enforced: Unauthorized returns 403
- [ ] Admin panel accessible
- [ ] Search functionality works
- [ ] Categories accessible
- [ ] User management works

### Database Testing
- [ ] Tables created successfully
- [ ] Default admin user exists
- [ ] Roles and permissions seeded
- [ ] Can insert new data
- [ ] Can read data
- [ ] Can update data
- [ ] Can delete data

### Cron Jobs Testing
```bash
# Test cron endpoint (from Vercel's IP, won't work locally)
# In Vercel Logs, you should see cron jobs running at scheduled times

# Generate cron secret if needed:
CRON_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo $CRON_SECRET
```

### Logging Verification
- [ ] Check Vercel logs in dashboard
- [ ] No error messages
- [ ] Startup logs show successful initialization
- [ ] Request logs show incoming traffic

### Performance Check
- [ ] Response times < 1 second (warm)
- [ ] Cold start < 5 seconds (first request)
- [ ] No timeout errors (60s limit)
- [ ] Database queries fast (< 500ms)

---

## File Uploads Setup (Optional)

### If Using File Upload Feature

#### 1. Enable Vercel Blob Storage
- [ ] Go to Vercel Dashboard
- [ ] Storage → Blob → Create
- [ ] Copy token provided

#### 2. Add BLOB_READ_WRITE_TOKEN
- [ ] Go to Settings → Environment Variables
- [ ] Add `BLOB_READ_WRITE_TOKEN` with provided token
- [ ] Scope: Production

#### 3. Update Upload Code
```bash
npm install @vercel/blob
```

Update your media routes to use Vercel Blob (see migration guide).

- [ ] Upload endpoint working
- [ ] Files stored in Blob
- [ ] URLs returned correctly
- [ ] Public access working

---

## Session Setup (Optional)

### If Using Sessions (Not Recommended)

Prefer JWT tokens instead. But if needed:

#### 1. Set Up Redis
```bash
# Use Redis Cloud (free tier available)
# Get REDIS_URL from redis.com
```

#### 2. Add Redis Dependency
```bash
npm install connect-redis redis
```

#### 3. Add REDIS_URL to Environment
- [ ] REDIS_URL = redis://...
- [ ] Test connection

#### 4. Update Session Middleware
See migration guide for code changes.

- [ ] Sessions persisting correctly
- [ ] Login works across requests
- [ ] Logout clears session
- [ ] Redis connection stable

---

## Performance Optimization

### Monitoring
- [ ] Set up Vercel Analytics
- [ ] Monitor response times
- [ ] Monitor error rate
- [ ] Monitor function duration

### Optimization
- [ ] Cache GET endpoints (Cache-Control headers)
- [ ] Optimize database queries
- [ ] Remove unused dependencies
- [ ] Implement pagination for large result sets
- [ ] Compress responses

### Scaling
- [ ] Monitor database connection count
- [ ] Plan for scaling if needed
- [ ] Test load handling
- [ ] Set up alerts for high error rates

---

## Security Hardening

### Before Going Public
- [ ] Change default admin password
- [ ] Enable 2FA if available
- [ ] Review CORS settings
- [ ] Enable rate limiting
- [ ] Set up audit logging
- [ ] Review database backups
- [ ] Set up disaster recovery plan
- [ ] Enable SSL/TLS (Vercel handles this)

### Ongoing
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Monitor for security vulnerabilities
- [ ] Review access logs
- [ ] Regular database backups

---

## Monitoring & Alerts

### Set Up Alerts For
- [ ] Error rate > 5%
- [ ] Response time > 2000ms
- [ ] Cold start > 5000ms
- [ ] Database connection failures
- [ ] Cron job failures
- [ ] Deployment failures

### Tools
- [ ] Vercel Dashboard monitoring
- [ ] Email alerts configured
- [ ] Slack integration (optional)
- [ ] PagerDuty (optional)

---

## Documentation

### Update Project Documentation
- [ ] README.md updated with deployment info
- [ ] API docs updated
- [ ] Setup guide created for new developers
- [ ] Architecture documentation added
- [ ] Troubleshooting guide created

### Internal Documentation
- [ ] Database schema documented
- [ ] API endpoints documented
- [ ] Environment variables documented
- [ ] Deployment process documented
- [ ] Rollback procedure documented

---

## Rollback Plan

### If Deployment Issues Occur

#### Immediate Actions
- [ ] Check Vercel logs for errors
- [ ] Review recent changes
- [ ] Check environment variables

#### Quick Fixes
- [ ] Redeploy latest working version
- [ ] Verify environment variables
- [ ] Check database connectivity
- [ ] Restart function

#### If Critical
- [ ] Rollback to previous version
- [ ] Notify team
- [ ] Post mortem analysis
- [ ] Implement fixes
- [ ] Redeploy

### Preventing Issues
- [ ] Test changes locally first
- [ ] Use preview deployments
- [ ] Stage changes in production gradually
- [ ] Monitor after each deployment
- [ ] Have a rollback plan ready

---

## Post-Launch

### First Week
- [ ] Daily monitoring
- [ ] Watch error logs
- [ ] Gather user feedback
- [ ] Monitor performance
- [ ] Fix any issues immediately

### First Month
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Database optimization
- [ ] Update documentation
- [ ] Team training on new system

### Ongoing
- [ ] Regular backups
- [ ] Security patches
- [ ] Performance monitoring
- [ ] User support
- [ ] Continuous improvement

---

## Troubleshooting

### Common Issues

#### "Database connection failed"
```bash
# Check:
✓ TURSO_CONNECTION_URL is set
✓ TURSO_AUTH_TOKEN is set
✓ Values copied exactly (no extra spaces)
✓ Connection string format: libsql://...
```

#### "Cold start too long"
```bash
# Solutions:
✓ Reduce dependencies
✓ Optimize schema creation
✓ Use lazy loading
✓ Upgrade function memory
```

#### "Sessions lost between requests"
```bash
# Use JWT instead:
✓ Remove sessions middleware
✓ Use JWT tokens in Authorization header
✓ Or implement Redis session store
```

#### "File uploads not working"
```bash
# Use Vercel Blob Storage:
✓ Install @vercel/blob
✓ Add BLOB_READ_WRITE_TOKEN
✓ Update upload endpoint
```

---

## Contacts & Support

### Getting Help
- Vercel Support: [support.vercel.com](https://support.vercel.com)
- Turso Support: [turso.tech](https://turso.tech)
- GitHub Issues: [github.com/your-repo/issues](https://github.com/your-repo/issues)
- Community: [Vercel Discord](https://discord.gg/vercel)

### Team
- [ ] Deployment responsible: ___________
- [ ] Database admin: ___________
- [ ] On-call support: ___________
- [ ] Backup contact: ___________

---

## Sign-Off

- [ ] Project Manager: _____________ Date: _______
- [ ] Tech Lead: _____________ Date: _______
- [ ] DevOps/Infrastructure: _____________ Date: _______
- [ ] QA Lead: _____________ Date: _______

---

**Deployment Status**: ☐ Not Started  ☐ In Progress  ☐ Complete  ☐ Issues Found

**Date Deployed**: _____________

**Deployed By**: _____________

**Issues**: _____________

---

**Last Updated**: February 12, 2026  
**Version**: 1.0
