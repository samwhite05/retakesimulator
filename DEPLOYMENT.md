# Render Deployment Guide

This guide will walk you through deploying Retake Roulette to Render.

## Prerequisites

1. A [Render account](https://render.com/) (free tier is fine)
2. Your code pushed to a GitHub/GitLab/Bitbucket repository
3. Render CLI installed (optional, but helpful)

## Deployment Options

### Option 1: Using Render Dashboard (Recommended)

1. **Connect your repository to Render:**
   - Go to [https://dashboard.render.com](https://dashboard.render.com)
   - Click "New +" → "Blueprint"
   - Connect your Git repository
   - Render will automatically detect the `render.yaml` file

2. **Deploy:**
   - Render will create all services defined in `render.yaml`:
     - PostgreSQL database
     - Backend API service
     - Frontend Next.js service
   - Click "Apply" to deploy

3. **Monitor:**
   - Watch the deployment logs in the Render dashboard
   - All services will be linked automatically

### Option 2: Manual Setup via Render CLI

> **Note:** The Render CLI is currently not well-maintained. Using the dashboard is recommended.

If you want to try the CLI approach:

```bash
# Login to Render
render login

# Deploy using render.yaml blueprint
render blueprint apply -f render.yaml
```

## Environment Variables

The `render.yaml` file automatically configures most environment variables. You may need to add these manually if your app needs them:

- `REDIS_URL` (optional) - If you add Redis later
- Any API keys or secrets

## Service Architecture

```
┌─────────────────────┐
│   Frontend (Next.js)│
│   Port: 3000        │
└──────────┬──────────┘
           │
           │ NEXT_PUBLIC_API_URL
           ▼
┌─────────────────────┐
│   Backend (Express) │
│   Port: 4000        │
└──────────┬──────────┘
           │
           │ DATABASE_URL
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │
└─────────────────────┘
```

## Custom Domain (Optional)

1. Go to your service in the Render dashboard
2. Click "Settings" → "Custom Domain"
3. Add your domain and update DNS records as instructed

## Monitoring & Logs

- View logs: Dashboard → Your Service → "Logs" tab
- Monitor health: Dashboard → Your Service → "Health"
- Metrics: Dashboard → Your Service → "Metrics" tab

## Scaling

If you need to upgrade from the free tier:

1. Go to your service settings
2. Change the instance plan
3. Redeploy

## Troubleshooting

### Build fails

- Check that all dependencies are in `package.json`
- Ensure build commands are correct in `render.yaml`
- Review build logs in Render dashboard

### Database connection issues

- Verify `DATABASE_URL` is correctly linked
- Check that the database name matches: `retake_roulette`

### Frontend can't reach backend

- Ensure `NEXT_PUBLIC_API_URL` environment variable is set correctly
- Check that the backend service name matches in `render.yaml`

## Updating Your Deployment

Every time you push to your repository:

1. **Auto-deploy** (if enabled):
   - Render will automatically deploy new commits
   
2. **Manual deploy**:
   - Go to dashboard → Your service → "Manual Deploy"
   - Select branch and click "Deploy"

## Cost Estimation (Free Tier)

- **PostgreSQL**: Free (90 days, then ~$7/month)
- **Backend Web Service**: Free (750 hours/month)
- **Frontend Web Service**: Free (750 hours/month)

**Total**: Free for the first 90 days, then ~$7-14/month depending on usage

## Post-Deployment Checklist

- [ ] Verify backend health endpoint: `https://your-backend.onrender.com/api/health`
- [ ] Test frontend: `https://your-frontend.onrender.com`
- [ ] Confirm database connection works
- [ ] Test API endpoints
- [ ] Set up custom domains (optional)
- [ ] Enable auto-deploy from Git
- [ ] Add monitoring/alerting (optional)
