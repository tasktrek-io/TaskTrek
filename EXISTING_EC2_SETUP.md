# 🎯 Streamlined Setup for Your Existing EC2

Since you already have TaskTrek running on EC2, here's the simplified process:

## ✅ **What You Already Have**

- ✅ EC2 instance with TaskTrek cloned in `/home/ubuntu/TaskTrek`
- ✅ Nginx configured and running
- ✅ PM2 ecosystem.config.js configured
- ✅ API running on port 5000, Web on port 3000

## 🚀 **Quick 5-Minute Setup**

### **1. Generate SSH Keys for GitHub Actions**

```bash
# On your local machine
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/tasktrek-deploy

# Add public key to your EC2
ssh-copy-id -i ~/.ssh/tasktrek-deploy.pub ubuntu@3.110.108.184
```

### **2. Add GitHub Secrets**

Go to: `https://github.com/tasktrek-io/TaskTrek/settings/secrets/actions`

Add these 4 secrets:

- `EC2_HOST`: `3.110.108.184`
- `EC2_USER`: `ubuntu`
- `EC2_SSH_KEY`: (paste content of `~/.ssh/tasktrek-deploy`)
- `EC2_DEPLOY_PATH`: `/home/ubuntu/TaskTrek`

### **3. Update API Port in Your Code**

Your ecosystem.config.js shows API on port 5000, but your index.ts shows port 4000. Let's fix this:

```bash
# Update your API to use port 5000 consistently
# In apps/api/src/index.ts, change:
const PORT = process.env.PORT || 5000;  # Was 4000
```

### **4. Quick EC2 Updates**

```bash
# SSH into your EC2
ssh -i ~/.ssh/tasktrek.pem ubuntu@3.110.108.184

# Update nginx server name
sudo nano /etc/nginx/sites-available/default
# Change server_name to: 3.110.108.184

# Restart nginx
sudo nginx -t && sudo systemctl restart nginx

# Create environment files
cat > /home/ubuntu/TaskTrek/apps/api/.env << 'EOF'
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/tasktrek_prod
WEB_ORIGIN=http://3.110.108.184
JWT_SECRET=your-super-secret-jwt-key-here
EOF

cat > /home/ubuntu/TaskTrek/apps/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://3.110.108.184/api
NODE_ENV=production
EOF
```

### **5. Test Connection**

```bash
# Test your new SSH key
ssh -i ~/.ssh/tasktrek-deploy ubuntu@3.110.108.184

# If this works, you're ready to deploy!
```

### **6. Deploy**

```bash
# Commit and push the deployment pipeline
git add .
git commit -m "feat: add automated deployment to existing EC2"
git push origin staging

# Create PR from staging → main
# When merged, automatic deployment will start!
```

## 🎉 **That's It!**

Your existing setup will now get:

- ✅ **Automatic deployments** when you push to main
- ✅ **Zero-downtime updates** with PM2
- ✅ **Health checks** to verify deployments
- ✅ **Automatic backups** before each deployment

## 📊 **URLs After Deployment**

- **Main App**: `http://3.110.108.184` (via Nginx)
- **API Health**: `http://3.110.108.184/api/health`
- **Direct API**: `http://3.110.108.184:5000/health`
- **Direct Web**: `http://3.110.108.184:3000`

The deployment will work with your existing PM2 and Nginx setup! 🚀
