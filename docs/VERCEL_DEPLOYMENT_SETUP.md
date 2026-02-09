# Vercel Deployment Setup Guide

This guide will help you deploy the Routine of Dhulikhel Banda (RoDB) application to Vercel with Turso database.

## Prerequisites

1. **Vercel Account**: Create an account at [vercel.com](https://vercel.com)
2. **GitHub Account**: Repository already pushed to GitHub
3. **Turso Account**: Create account at [turso.tech](https://turso.tech)
4. **Node.js 18.x**: Already configured in vercel.json

## Step 1: Set Up Turso Database

### 1.1 Create Turso Database
```bash
# Install Turso CLI
npm install -g @turso/cli

# Login to Turso
turso auth login

# Create database for RoDB
turso db create rodb-news

# Get connection URL and token (will be displayed in output)
```

### 1.2 Get Database Credentials
```bash
# Get connection URL
turso db show rodb-news

# Create API token
turso db tokens create rodb-news
```

Save these values:
- `TURSO_CONNECTION_URL`: libsql://rodb-news-xxxxx.turso.io
- `TURSO_AUTH_TOKEN`: your-auth-token

## Step 2: Generate Secret Keys

Generate secure random keys for JWT and Session:

```bash
node -e "console.log('JWT_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('SESSION_SECRET:', require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: Deploy to Vercel

### 3.1 Connect GitHub Repository
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click "Import Git Repository"
3. Select your GitHub repository containing RoDB
4. Click "Import"

### 3.2 Set Environment Variables
In the "Environment Variables" section, add:

```
NODE_ENV=production
TURSO_CONNECTION_URL=libsql://rodb-news-xxxxx.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
JWT_SECRET=your-generated-jwt-secret
JWT_REFRESH_SECRET=your-generated-jwt-refresh-secret
SESSION_SECRET=your-generated-session-secret
ADMIN_SECRET=your-admin-secret (or use default from docs)
LOG_LEVEL=info
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

### 3.3 Configure Build Settings
- **Framework Preset**: Other
- **Build Command**: `npm run build`
- **Output Directory**: `.` (current directory)
- **Install Command**: `npm install`

### 3.4 Deploy
Click "Deploy" and wait for the build to complete.

## Step 4: Initialize Database

Once deployed, the database will be automatically initialized on the first request to:
- Create tables
- Set up schema
- Seed default data (if needed)

**Health Check**: Visit `https://your-vercel-app.vercel.app/api/health` to verify deployment.

## Step 5: Configure Domain (Optional)

1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow Vercel's DNS configuration

## Troubleshooting

### Database Connection Issues
- Verify `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` are correctly set
- Check Vercel Deployments > Functions tab for logs
- Ensure token has database access permissions

### Build Failures
- Check Vercel build logs for error messages
- Verify all dependencies in package.json are correct
- Ensure Node.js version is 18.x

### Environment Variables Not Loading
- Verify variables are set in Vercel project settings
- Redeploy after adding new variables
- Check that variable names match exactly (case-sensitive)

### Static Files Not Serving
- Verify `/public` and `/uploads` directories exist
- Check Vercel routes in vercel.json are correct
- Ensure cache-control headers are set properly

## Monitoring & Logs

1. **Vercel Dashboard**: View real-time deployment status
2. **Functions Logs**: Check API logs at Vercel Deployments > Functions
3. **Error Tracking**: Monitor error rates and performance

## Updating Code

To update your application:

```bash
# Make changes locally
git add .
git commit -m "Your commit message"
git push origin main

# Vercel will automatically deploy the changes
```

## Database Migrations

For database changes:

1. Create migration file in `/migrations` directory
2. Test locally with Turso database
3. Push to GitHub
4. Monitor Vercel deployment

## Important Notes

⚠️ **Production Checklist:**
- [ ] All environment variables are set in Vercel
- [ ] Database credentials are secure and not in git
- [ ] Admin credentials are changed from defaults
- [ ] JWT secrets are strong (32+ characters)
- [ ] HTTPS is enabled (automatic on Vercel)
- [ ] CORS settings are configured for your domain
- [ ] Rate limiting is active

## Support & Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Turso Documentation](https://docs.turso.tech)
- [Express.js Guide](https://expressjs.com)
- Project Issues: Check GitHub issues for known problems

## Next Steps

1. ✅ Verify deployment at health endpoint
2. ✅ Test login functionality
3. ✅ Upload test article
4. ✅ Check admin panel
5. ✅ Monitor performance and logs
