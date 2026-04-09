# Render Deployment Checklist

## Pre-Deployment

- [ ] Push code to GitHub/GitLab/Bitbucket repository
- [ ] Ensure all environment variables are documented
- [ ] Test locally with: `npm run dev`
- [ ] Verify backend builds: `cd backend && npm run build`
- [ ] Verify frontend builds: `cd frontend && npm run build`

## Deploy to Render

### Step 1: Connect Repository
- [ ] Go to https://dashboard.render.com
- [ ] Click **New +** → **Blueprint**
- [ ] Select your Git provider and repository
- [ ] Render will detect `render.yaml` automatically

### Step 2: Configure Services
- [ ] Review service names and settings
- [ ] Verify database configuration
- [ ] Check environment variables are mapped correctly

### Step 3: Deploy
- [ ] Click **Apply** to create services
- [ ] Monitor deployment logs
- [ ] Wait for all services to turn green (healthy)

### Step 4: Verify Deployment
- [ ] Backend health check: `https://your-backend.onrender.com/api/health`
- [ ] Frontend loads: `https://your-frontend.onrender.com`
- [ ] Database connection works
- [ ] API endpoints respond correctly

## Post-Deployment

- [ ] Set up custom domain (optional)
- [ ] Enable auto-deploy on push
- [ ] Add monitoring alerts (optional)
- [ ] Update README with live URLs
- [ ] Test full user flow (plan → execute → results)

## Environment Variables Reference

### Backend
```
NODE_ENV=production
PORT=4000
DATABASE_URL=(auto-linked from database)
FRONTEND_URL=(auto-linked from frontend service)
```

### Frontend
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=(auto-linked from backend service)
```

## Troubleshooting

**Build Fails:**
- Check build logs in Render dashboard
- Ensure all dependencies are in package.json
- Verify build commands match your project structure

**Database Connection Fails:**
- Verify DATABASE_URL is auto-linked in render.yaml
- Check database name matches: `retake_roulette`

**Frontend Can't Reach Backend:**
- Verify NEXT_PUBLIC_API_URL is set correctly
- Check CORS settings in backend allow frontend URL

**Service Crashes:**
- Check logs in Render dashboard
- Verify all required env vars are set
- Ensure PORT environment variable is set to 4000

## Useful Commands

```bash
# View Render CLI help (if installed)
render --help

# Test production build locally
cd backend && npm run build && npm start

# Check backend health
curl http://localhost:4000/api/health
```

## Support

- [Render Docs](https://render.com/docs)
- [Render Support](https://render.com/support)
- [Project Issues](link-to-your-repo/issues)
