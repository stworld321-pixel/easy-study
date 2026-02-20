# Zeal Catalyst - Hostinger Deployment Guide with CI/CD

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Hostinger Setup](#hostinger-setup)
3. [Server Configuration](#server-configuration)
4. [Database Setup](#database-setup)
5. [Backend Deployment](#backend-deployment)
6. [Frontend Deployment](#frontend-deployment)
7. [CI/CD Pipeline Setup](#cicd-pipeline-setup)
8. [Domain & SSL Configuration](#domain--ssl-configuration)
9. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Prerequisites

### What You Need:
- Hostinger VPS (KVM 2 or higher recommended)
- Domain name (can purchase from Hostinger)
- GitHub account (for CI/CD)
- MongoDB Atlas account (recommended) OR self-hosted MongoDB

### Recommended VPS Specs:
- **RAM**: 4GB minimum
- **CPU**: 2 vCPUs
- **Storage**: 80GB SSD
- **OS**: Ubuntu 22.04 LTS

---

## Hostinger Setup

### Step 1: Purchase VPS Hosting
1. Go to [hostinger.com](https://hostinger.com)
2. Select **VPS Hosting** → **KVM 2** or higher
3. Choose Ubuntu 22.04 as the OS
4. Complete the purchase

### Step 2: Access VPS
1. Go to Hostinger hPanel → **VPS** section
2. Note down:
   - **IP Address**: `xxx.xxx.xxx.xxx`
   - **Root Password** (or set up SSH key)
3. Connect via SSH:
```bash
ssh root@YOUR_VPS_IP
```

---

## Server Configuration

### Step 1: Initial Server Setup
```bash
# Update system
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git nginx certbot python3-certbot-nginx

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Python 3.11
apt install -y python3.11 python3.11-venv python3-pip

# Install PM2 for process management
npm install -g pm2

# Create app user (security best practice)
adduser --disabled-password --gecos "" zealcatalyst
usermod -aG sudo zealcatalyst
```

### Step 2: Configure Firewall
```bash
# Install and configure UFW
apt install -y ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw allow 8000  # Backend API (temporary, will proxy through Nginx)
ufw enable
```

### Step 3: Create Directory Structure
```bash
# Create directories
mkdir -p /var/www/zealcatalyst/frontend
mkdir -p /var/www/zealcatalyst/backend
mkdir -p /var/log/zealcatalyst
chown -R zealcatalyst:zealcatalyst /var/www/zealcatalyst
chown -R zealcatalyst:zealcatalyst /var/log/zealcatalyst
```

---

## Database Setup

### Option A: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster (M0)
3. Create database user
4. Whitelist your VPS IP (or use 0.0.0.0/0 for any IP)
5. Get connection string:
```
mongodb+srv://username:password@cluster.xxxxx.mongodb.net/zealcatalyst?retryWrites=true&w=majority
```

### Option B: Self-hosted MongoDB
```bash
# Import MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add MongoDB repo
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install MongoDB
apt update
apt install -y mongodb-org

# Start MongoDB
systemctl start mongod
systemctl enable mongod

# Secure MongoDB
mongosh
> use admin
> db.createUser({user: "zealadmin", pwd: "YOUR_SECURE_PASSWORD", roles: ["root"]})
> use zealcatalyst
> db.createUser({user: "zealapp", pwd: "YOUR_APP_PASSWORD", roles: [{role: "readWrite", db: "zealcatalyst"}]})
```

---

## Backend Deployment

### Step 1: Clone and Setup Backend
```bash
# Switch to app user
su - zealcatalyst

# Clone repository
cd /var/www/zealcatalyst
git clone https://github.com/YOUR_USERNAME/zealcatalyst.git temp
mv temp/backend/* backend/
rm -rf temp

# Create virtual environment
cd backend
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 2: Create Environment File
```bash
# Create .env file
cat > /var/www/zealcatalyst/backend/.env << 'EOF'
# Database
MONGODB_URL=mongodb+srv://username:password@cluster.xxxxx.mongodb.net/zealcatalyst?retryWrites=true&w=majority
DATABASE_NAME=zealcatalyst

# JWT
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Razorpay
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=your-email@gmail.com

# App
DEBUG=false
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
EOF

chmod 600 /var/www/zealcatalyst/backend/.env
```

### Step 3: Create PM2 Ecosystem File
```bash
cat > /var/www/zealcatalyst/backend/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'zealcatalyst-api',
    script: 'venv/bin/uvicorn',
    args: 'app.main:app --host 0.0.0.0 --port 8000',
    cwd: '/var/www/zealcatalyst/backend',
    instances: 2,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/zealcatalyst/api-error.log',
    out_file: '/var/log/zealcatalyst/api-out.log',
    log_file: '/var/log/zealcatalyst/api-combined.log',
    time: true
  }]
};
EOF
```

### Step 4: Start Backend with PM2
```bash
cd /var/www/zealcatalyst/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable auto-start
```

---

## Frontend Deployment

### Step 1: Build Frontend Locally or on Server
```bash
# On server (as zealcatalyst user)
cd /var/www/zealcatalyst
git clone https://github.com/YOUR_USERNAME/zealcatalyst.git temp
mv temp/frontend/* frontend/
rm -rf temp

cd frontend

# Create production .env
cat > .env.production << 'EOF'
VITE_API_URL=https://api.yourdomain.com/api
EOF

# Install and build
npm install
npm run build

# The build output is in 'dist' folder
```

### Step 2: Configure Nginx

```bash
# As root user
cat > /etc/nginx/sites-available/zealcatalyst << 'EOF'
# Frontend - Main Website
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/zealcatalyst/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1000;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/zealcatalyst /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site

# Test and reload
nginx -t
systemctl reload nginx
```

---

## CI/CD Pipeline Setup

### Option A: GitHub Actions (Recommended)

#### Step 1: Create GitHub Secrets
Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:
- `VPS_HOST`: Your VPS IP address
- `VPS_USER`: zealcatalyst
- `VPS_SSH_KEY`: Your private SSH key
- `MONGODB_URL`: Your MongoDB connection string
- `RAZORPAY_KEY_ID`: Razorpay key
- `RAZORPAY_KEY_SECRET`: Razorpay secret
- `VITE_API_URL`: https://api.yourdomain.com/api

#### Step 2: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Hostinger VPS

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  # Build and Test
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Frontend Dependencies
        run: |
          cd frontend
          npm ci

      - name: Build Frontend
        run: |
          cd frontend
          echo "VITE_API_URL=${{ secrets.VITE_API_URL }}" > .env.production
          npm run build

      - name: Install Backend Dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Upload Frontend Build
        uses: actions/upload-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist

  # Deploy to VPS
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download Frontend Build
        uses: actions/download-artifact@v4
        with:
          name: frontend-build
          path: frontend/dist

      - name: Setup SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.VPS_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts

      - name: Deploy Backend
        run: |
          rsync -avz --delete \
            --exclude 'venv' \
            --exclude '.env' \
            --exclude '__pycache__' \
            --exclude '*.pyc' \
            backend/ ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/var/www/zealcatalyst/backend/

      - name: Deploy Frontend
        run: |
          rsync -avz --delete \
            frontend/dist/ ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/var/www/zealcatalyst/frontend/dist/

      - name: Restart Services
        run: |
          ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} << 'ENDSSH'
            cd /var/www/zealcatalyst/backend
            source venv/bin/activate
            pip install -r requirements.txt --quiet
            pm2 restart zealcatalyst-api
          ENDSSH

      - name: Health Check
        run: |
          sleep 10
          curl -f https://api.yourdomain.com/health || exit 1
```

#### Step 3: Setup SSH Key on VPS
```bash
# On your local machine, generate SSH key
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/github_actions.pub zealcatalyst@YOUR_VPS_IP

# Copy private key content to GitHub Secrets (VPS_SSH_KEY)
cat ~/.ssh/github_actions
```

### Option B: Simple Deploy Script (Alternative)

Create `deploy.sh` in your project root:
```bash
#!/bin/bash
set -e

VPS_HOST="YOUR_VPS_IP"
VPS_USER="zealcatalyst"

echo "🚀 Building Frontend..."
cd frontend
npm run build
cd ..

echo "📦 Deploying to VPS..."
rsync -avz --delete \
  --exclude 'venv' \
  --exclude '.env' \
  --exclude 'node_modules' \
  --exclude '__pycache__' \
  backend/ $VPS_USER@$VPS_HOST:/var/www/zealcatalyst/backend/

rsync -avz --delete \
  frontend/dist/ $VPS_USER@$VPS_HOST:/var/www/zealcatalyst/frontend/dist/

echo "🔄 Restarting services..."
ssh $VPS_USER@$VPS_HOST << 'ENDSSH'
  cd /var/www/zealcatalyst/backend
  source venv/bin/activate
  pip install -r requirements.txt --quiet
  pm2 restart zealcatalyst-api
ENDSSH

echo "✅ Deployment complete!"
```

---

## Domain & SSL Configuration

### Step 1: Point Domain to VPS
1. In Hostinger hPanel or your domain registrar:
   - Add **A Record**: `@` → `YOUR_VPS_IP`
   - Add **A Record**: `www` → `YOUR_VPS_IP`
   - Add **A Record**: `api` → `YOUR_VPS_IP`

2. Wait for DNS propagation (5-30 minutes)

### Step 2: Install SSL Certificates
```bash
# Install Certbot SSL for all domains
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal
certbot renew --dry-run
```

---

## Monitoring & Maintenance

### PM2 Monitoring
```bash
# View logs
pm2 logs zealcatalyst-api

# Monitor resources
pm2 monit

# View status
pm2 status
```

### Nginx Logs
```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

### Useful Commands
```bash
# Restart backend
pm2 restart zealcatalyst-api

# Reload Nginx
sudo systemctl reload nginx

# Check disk space
df -h

# Check memory
free -m

# View running processes
htop
```

### Backup Strategy
```bash
# Create backup script
cat > /home/zealcatalyst/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/zealcatalyst/backups"
mkdir -p $BACKUP_DIR

# Backup MongoDB (if self-hosted)
mongodump --uri="mongodb://zealapp:password@localhost:27017/zealcatalyst" --out=$BACKUP_DIR/mongo_$DATE

# Backup .env files
cp /var/www/zealcatalyst/backend/.env $BACKUP_DIR/backend_env_$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $DATE"
EOF

chmod +x /home/zealcatalyst/backup.sh

# Add to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/zealcatalyst/backup.sh") | crontab -
```

---

## Quick Reference

### File Locations
| Component | Path |
|-----------|------|
| Frontend Build | `/var/www/zealcatalyst/frontend/dist` |
| Backend Code | `/var/www/zealcatalyst/backend` |
| Backend Env | `/var/www/zealcatalyst/backend/.env` |
| Nginx Config | `/etc/nginx/sites-available/zealcatalyst` |
| PM2 Config | `/var/www/zealcatalyst/backend/ecosystem.config.js` |
| Logs | `/var/log/zealcatalyst/` |

### URLs (after setup)
| Service | URL |
|---------|-----|
| Frontend | https://yourdomain.com |
| API | https://api.yourdomain.com/api |
| API Docs | https://api.yourdomain.com/docs |

### Troubleshooting
```bash
# Backend not starting?
pm2 logs zealcatalyst-api --lines 50

# Nginx errors?
nginx -t
tail -f /var/log/nginx/error.log

# MongoDB connection issues?
# Check if MongoDB is running
systemctl status mongod

# Permission issues?
chown -R zealcatalyst:zealcatalyst /var/www/zealcatalyst
```

---

## Next Steps
1. [ ] Purchase Hostinger VPS
2. [ ] Configure server with this guide
3. [ ] Set up MongoDB Atlas
4. [ ] Deploy application
5. [ ] Configure domain and SSL
6. [ ] Set up GitHub Actions for CI/CD
7. [ ] Test all features
8. [ ] Switch Razorpay to live mode
