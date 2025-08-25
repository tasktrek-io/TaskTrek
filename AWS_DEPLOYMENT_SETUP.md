# 🚀 AWS EC2 Deployment Setup Guide

## 📋 Prerequisites Checklist

### **1. EC2 Instance Requirements**

- [x] EC2 instance running (IP: 3.110.108.184)
- [ ] Node.js installed (version 18.x or 20.x)
- [ ] PM2 installed globally for process management
- [ ] Git installed
- [ ] Required ports open (80, 443, 3000, etc.)

### **2. Security Setup**

- [ ] SSH key pair for GitHub Actions
- [ ] Security group configured
- [ ] IAM user with deployment permissions (optional)

---

## 🔧 Step 1: Configure Your EC2 Instance

### **SSH into your EC2:**

```bash
ssh -i your-key.pem ubuntu@3.110.108.184
```

### **Install Required Software:**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install Git (if not already installed)
sudo apt install git -y

# Create deployment directory
sudo mkdir -p /var/www/tasktrek
sudo chown ubuntu:ubuntu /var/www/tasktrek
```

### **Setup PM2 Configuration:**

```bash
# Create PM2 ecosystem file
cat > /var/www/tasktrek/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'tasktrek-api',
      script: './apps/api/dist/index.js',
      cwd: '/var/www/tasktrek',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true
    },
    {
      name: 'tasktrek-web',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/tasktrek/apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true
    }
  ]
};
EOF

# Create logs directory
mkdir -p /var/www/tasktrek/logs

# Setup PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## 🔐 Step 2: Setup SSH Keys for GitHub Actions

### **Generate SSH Key Pair:**

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/tasktrek-deploy

# This creates:
# ~/.ssh/tasktrek-deploy (private key - for GitHub secrets)
# ~/.ssh/tasktrek-deploy.pub (public key - for EC2)
```

### **Add Public Key to EC2:**

```bash
# Copy public key content
cat ~/.ssh/tasktrek-deploy.pub

# SSH into EC2 and add to authorized_keys
ssh -i your-existing-key.pem ubuntu@3.110.108.184
echo "your-public-key-content-here" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Test the connection
ssh -i ~/.ssh/tasktrek-deploy ubuntu@3.110.108.184
```

---

## 🔒 Step 3: Configure GitHub Secrets

Go to your repository: `https://github.com/tasktrek-io/TaskTrek/settings/secrets/actions`

Add these secrets:

| Secret Name       | Value                   | Description                       |
| ----------------- | ----------------------- | --------------------------------- |
| `EC2_HOST`        | `3.110.108.184`         | Your EC2 IP address               |
| `EC2_USER`        | `ubuntu`                | SSH username                      |
| `EC2_SSH_KEY`     | `[private key content]` | Content of ~/.ssh/tasktrek-deploy |
| `EC2_DEPLOY_PATH` | `/var/www/tasktrek`     | Deployment directory              |

### **To get private key content:**

```bash
cat ~/.ssh/tasktrek-deploy
# Copy the entire output including -----BEGIN OPENSSH PRIVATE KEY-----
```

---

## 🚀 Step 4: Create Deployment Scripts

Create these files in your repository:

### **scripts/deploy.sh:**

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Configuration
DEPLOY_PATH="/var/www/tasktrek"
BACKUP_PATH="/var/www/backup/tasktrek-$(date +%Y%m%d-%H%M%S)"

# Create backup
echo "📦 Creating backup..."
sudo mkdir -p /var/www/backup
if [ -d "$DEPLOY_PATH" ]; then
    sudo cp -r "$DEPLOY_PATH" "$BACKUP_PATH"
fi

# Stop applications
echo "🛑 Stopping applications..."
pm2 stop tasktrek-api tasktrek-web || true

# Update code
echo "📥 Updating code..."
cd "$DEPLOY_PATH"
git fetch origin
git reset --hard origin/main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Build applications
echo "🏗️ Building applications..."
npm run build

# Install workspace dependencies
echo "📦 Installing workspace dependencies..."
cd apps/api && npm ci --production && cd ../..
cd apps/web && npm ci --production && cd ../..

# Start applications
echo "🚀 Starting applications..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed successfully!"
```

### **scripts/health-check.sh:**

```bash
#!/bin/bash

echo "🔍 Running health checks..."

# Check if API is running
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "000")
if [ "$API_STATUS" = "200" ]; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed (Status: $API_STATUS)"
    exit 1
fi

# Check if Web is running
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$WEB_STATUS" = "200" ]; then
    echo "✅ Web is healthy"
else
    echo "❌ Web health check failed (Status: $WEB_STATUS)"
    exit 1
fi

echo "🎉 All services are healthy!"
```

---

## 🏗️ Step 5: Create Deployment Workflow

The deployment workflow has been created at `.github/workflows/deploy.yml`

## 📋 Step 6: Setup Checklist

### **Required GitHub Secrets:**

Go to `https://github.com/tasktrek-io/TaskTrek/settings/secrets/actions` and add:

| Secret Name       | Value                   | Description                                  |
| ----------------- | ----------------------- | -------------------------------------------- |
| `EC2_HOST`        | `3.110.108.184`         | Your EC2 IP address                          |
| `EC2_USER`        | `ubuntu`                | SSH username (usually ubuntu for Ubuntu AMI) |
| `EC2_SSH_KEY`     | `[private key content]` | Content of your SSH private key              |
| `EC2_DEPLOY_PATH` | `/var/www/tasktrek`     | Deployment directory on EC2                  |

### **Generate SSH Keys:**

```bash
# Generate SSH key pair for deployment
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/tasktrek-deploy

# Copy public key to EC2
ssh-copy-id -i ~/.ssh/tasktrek-deploy.pub ubuntu@3.110.108.184

# Copy private key content for GitHub secret
cat ~/.ssh/tasktrek-deploy
```

---

## 🖥️ Step 7: EC2 Server Setup Commands

SSH into your EC2 and run these commands:

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2 globally
sudo npm install -g pm2

# 4. Install additional tools
sudo apt install git nginx -y

# 5. Create deployment directory
sudo mkdir -p /var/www/tasktrek
sudo chown ubuntu:ubuntu /var/www/tasktrek

# 6. Create logs directory
mkdir -p /var/www/tasktrek/logs

# 7. Setup PM2 to start on boot
pm2 startup
# Follow the command PM2 shows you

# 8. Configure Nginx (optional reverse proxy)
sudo nano /etc/nginx/sites-available/tasktrek
```

### **Nginx Configuration (Optional):**

```nginx
server {
    listen 80;
    server_name 3.110.108.184;

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Web app proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable Nginx site
sudo ln -s /etc/nginx/sites-available/tasktrek /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 🚀 Step 8: Environment Variables on EC2

Create environment files on your EC2:

```bash
# API environment variables
cat > /var/www/tasktrek/apps/api/.env << 'EOF'
NODE_ENV=production
PORT=3001
MONGO_URI=mongodb://localhost:27017/tasktrek_prod
WEB_ORIGIN=http://3.110.108.184
JWT_SECRET=your-super-secret-jwt-key
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=noreply@tasktrek.com
EOF

# Web environment variables
cat > /var/www/tasktrek/apps/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://3.110.108.184/api
NODE_ENV=production
EOF
```

---

## 🔧 Step 9: Test Deployment Locally

Before pushing to main, test everything locally:

```bash
# 1. Check if all scripts are executable
chmod +x scripts/deploy.sh scripts/health-check.sh

# 2. Test build process
npm run build

# 3. Test your SSH connection
ssh ubuntu@3.110.108.184

# 4. Test PM2 configuration
pm2 start ecosystem.config.js --dry-run
```

---

## 🚀 Step 10: Deploy!

### **Automatic Deployment:**

```bash
# Commit all changes
git add .
git commit -m "feat: add AWS deployment pipeline"

# Push to staging first (test)
git push origin staging

# Create PR from staging to main
# Once PR is merged to main, deployment will trigger automatically!
```

### **Manual Deployment:**

- Go to GitHub Actions tab
- Click "Deploy to AWS EC2" workflow
- Click "Run workflow" button
- Select main branch and run

---

## 📊 Step 11: Monitor Deployment

### **GitHub Actions:**

- Monitor the deployment in GitHub Actions tab
- Check logs for any errors
- Verify health checks pass

### **On EC2:**

```bash
# Check PM2 status
pm2 status
pm2 logs

# Check application logs
tail -f /var/www/tasktrek/logs/*.log

# Check if services are running
curl http://localhost:3001/health
curl http://localhost:3000

# Check from outside
curl http://3.110.108.184/api/health
curl http://3.110.108.184
```

---

## 🔧 Troubleshooting

### **Common Issues:**

1. **SSH Permission Denied:**

   ```bash
   # Check SSH key permissions
   chmod 600 ~/.ssh/tasktrek-deploy
   ssh-add ~/.ssh/tasktrek-deploy
   ```

2. **PM2 Not Starting:**

   ```bash
   # Check PM2 logs
   pm2 logs
   pm2 restart ecosystem.config.js
   ```

3. **Build Fails:**

   ```bash
   # Check Node.js version
   node --version
   npm --version

   # Clear cache and reinstall
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Port Issues:**

   ```bash
   # Check what's running on ports
   sudo netstat -tlnp | grep :3000
   sudo netstat -tlnp | grep :3001

   # Kill processes if needed
   sudo lsof -ti:3000 | xargs kill -9
   ```

---

## 🎯 Final Verification

After successful deployment, verify:

- [ ] ✅ API responds: `http://3.110.108.184/api/health`
- [ ] ✅ Web app loads: `http://3.110.108.184`
- [ ] ✅ PM2 shows running processes: `pm2 status`
- [ ] ✅ GitHub Actions workflow completes successfully
- [ ] ✅ No errors in application logs

---

## 🔄 Rollback Plan

If something goes wrong:

```bash
# On EC2, rollback to previous version
cd /var/www/tasktrek
git log --oneline -10  # See recent commits
git reset --hard <previous-commit-hash>
pm2 restart ecosystem.config.js
```

Your backup is automatically created at `/var/www/backup/tasktrek-<timestamp>`

---

## 📈 Next Steps

1. **SSL Certificate:** Add Let's Encrypt for HTTPS
2. **Domain Name:** Point a domain to your EC2
3. **Database:** Set up MongoDB on EC2 or use MongoDB Atlas
4. **Monitoring:** Add health monitoring and alerts
5. **Load Balancer:** Add AWS ELB for high availability

---

**🎉 Congratulations! Your automated deployment pipeline is ready!**
