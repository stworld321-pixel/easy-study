# Zeal Catalyst - Free Deployment Guide

Deploy your application completely FREE using:
- **Frontend**: Vercel (Free)
- **Backend**: Render.com (Free)
- **Database**: MongoDB Atlas (Free 512MB)

---

## Step 1: MongoDB Atlas (Database)

### 1.1 Create Account
1. Go to: https://www.mongodb.com/cloud/atlas/register
2. Sign up with Google or Email

### 1.2 Create Free Cluster
1. Click **"Build a Database"**
2. Select **FREE - Shared** (M0 Sandbox)
3. Choose provider: **AWS**
4. Choose region: **Mumbai (ap-south-1)** (closest to India)
5. Cluster name: `zealcatalyst-cluster`
6. Click **"Create"**

### 1.3 Create Database User
1. Go to **Database Access** (left sidebar)
2. Click **"Add New Database User"**
3. Authentication: **Password**
   - Username: `zealapp`
   - Password: Generate a secure password (SAVE THIS!)
4. Database User Privileges: **Read and write to any database**
5. Click **"Add User"**

### 1.4 Whitelist All IPs (for Render.com)
1. Go to **Network Access** (left sidebar)
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (adds 0.0.0.0/0)
4. Click **"Confirm"**

### 1.5 Get Connection String
1. Go to **Database** (left sidebar)
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Driver: Python, Version: 3.12 or later
5. Copy the connection string:
   ```
   mongodb+srv://zealapp:<password>@zealcatalyst-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with your actual password
7. Add database name:
   ```
   mongodb+srv://zealapp:YOUR_PASSWORD@zealcatalyst-cluster.xxxxx.mongodb.net/zealcatalyst?retryWrites=true&w=majority
   ```

**Save this connection string - you'll need it for Render.com!**

---

## Step 2: Render.com (Backend)

### 2.1 Create Account
1. Go to: https://render.com
2. Sign up with **GitHub** (recommended - easier deployment)

### 2.2 Create Web Service
1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository: `KUMARESAN-PANDA/zealcatalyst`
3. Configure:
   - **Name**: `zealcatalyst-api`
   - **Region**: Singapore (closest to India)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: `Free`

### 2.3 Add Environment Variables
Click **"Advanced"** → **"Add Environment Variable"**

Add these variables:

| Key | Value |
|-----|-------|
| `MONGODB_URL` | `mongodb+srv://zealapp:PASSWORD@cluster.mongodb.net/zealcatalyst?retryWrites=true&w=majority` |
| `DATABASE_NAME` | `zealcatalyst` |
| `SECRET_KEY` | `your-super-secret-key-generate-random-string` |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` |
| `RAZORPAY_KEY_ID` | `rzp_test_RBTpHZkMrSNAmB` |
| `RAZORPAY_KEY_SECRET` | `VV6UXZMHTsZ8UJR8C42bkLmR` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | `your-email@gmail.com` |
| `SMTP_PASSWORD` | `your-app-password` |
| `FROM_EMAIL` | `your-email@gmail.com` |
| `DEBUG` | `false` |
| `ALLOWED_ORIGINS` | `https://zealcatalyst.vercel.app,http://localhost:5173` |

### 2.4 Deploy
1. Click **"Create Web Service"**
2. Wait for deployment (5-10 minutes first time)
3. Your API URL will be: `https://zealcatalyst-api.onrender.com`

### 2.5 Verify
Open: `https://zealcatalyst-api.onrender.com/docs`
You should see the FastAPI Swagger documentation!

---

## Step 3: Vercel (Frontend)

### 3.1 Create Account
1. Go to: https://vercel.com
2. Sign up with **GitHub**

### 3.2 Import Project
1. Click **"Add New..."** → **"Project"**
2. Import: `KUMARESAN-PANDA/zealcatalyst`
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: Click "Edit" → Select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 3.3 Add Environment Variable
Click **"Environment Variables"**

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://zealcatalyst-api.onrender.com/api` |

### 3.4 Deploy
1. Click **"Deploy"**
2. Wait for deployment (2-3 minutes)
3. Your site will be: `https://zealcatalyst.vercel.app`

---

## Step 4: Update CORS in Backend

After deploying, update the `ALLOWED_ORIGINS` in Render.com:

Go to Render Dashboard → Your Service → Environment → Edit `ALLOWED_ORIGINS`:
```
https://zealcatalyst.vercel.app,https://your-custom-domain.com
```

---

## Step 5: Custom Domain (Optional)

### For Vercel (Frontend):
1. Go to Project Settings → Domains
2. Add your domain: `www.zealcatalyst.com`
3. Add DNS records as shown

### For Render (Backend):
1. Go to Service Settings → Custom Domains
2. Add: `api.zealcatalyst.com`
3. Add DNS records as shown

---

## URLs After Deployment

| Service | URL |
|---------|-----|
| Frontend | https://zealcatalyst.vercel.app |
| Backend API | https://zealcatalyst-api.onrender.com/api |
| API Docs | https://zealcatalyst-api.onrender.com/docs |

---

## Important Notes

### Free Tier Limitations:

**Render.com Free:**
- Spins down after 15 min inactivity
- First request after sleep takes ~30 seconds
- 750 hours/month

**MongoDB Atlas Free:**
- 512 MB storage
- Shared RAM/CPU
- Good for development/small apps

**Vercel Free:**
- 100 GB bandwidth/month
- Unlimited deployments
- Great for production!

### To Keep Backend Awake (Optional):
Use a free cron service like https://cron-job.org to ping your API every 14 minutes:
- URL: `https://zealcatalyst-api.onrender.com/health`
- Interval: Every 14 minutes

---

## Troubleshooting

### Backend not starting?
- Check Render logs for errors
- Verify MONGODB_URL is correct
- Make sure requirements.txt has all dependencies

### Frontend API calls failing?
- Check VITE_API_URL is correct
- Verify CORS origins include your Vercel URL
- Check browser console for errors

### Database connection issues?
- Verify IP whitelist includes 0.0.0.0/0
- Check password doesn't have special characters that need encoding
- Test connection string in MongoDB Compass first
