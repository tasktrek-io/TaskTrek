# 🚀 Quick Setup Checklist for AWS Deployment

## ⏱️ 15-Minute Setup

### **1. Generate SSH Keys (2 minutes)**

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/tasktrek-deploy
```

### **2. Add Public Key to EC2 (3 minutes)**

```bash
ssh-copy-id -i ~/.ssh/tasktrek-deploy.pub ubuntu@3.110.108.184
```

### **3. Setup GitHub Secrets (2 minutes)**

Go to: `https://github.com/tasktrek-io/TaskTrek/settings/secrets/actions`

Add these secrets:

- `EC2_HOST`: `3.110.108.184`
- `EC2_USER`: `ubuntu`
- `EC2_SSH_KEY`: (content of `~/.ssh/tasktrek-deploy`)
- `EC2_DEPLOY_PATH`: `/home/ubuntu/TaskTrek` (matches your existing setup)

### **4. Update Your EC2 Setup (3 minutes)**

Since you already have TaskTrek running, let's update a few things:

SSH into your EC2:

```bash
ssh -i "tasktrek.pem" ubuntu@3.110.108.184
```

Update your nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/default
```

Change the server_name to match your IP:

```nginx
server {
  listen 80;
  server_name 3.110.108.184;  # Changed from the old hostname

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  location /api/ {
    proxy_pass http://localhost:5000;  # Your API port
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }

  location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Restart nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### **5. Create Environment Files on EC2 (2 minutes)**

````bash
# API environment (your API runs on port 5000)
cat > /home/ubuntu/TaskTrek/apps/api/.env << 'EOF'
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/tasktrek_prod
WEB_ORIGIN=http://3.110.108.184
JWT_SECRET=your-jwt-secret-here
EOF

# Web environment
cat > /home/ubuntu/TaskTrek/apps/web/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://3.110.108.184/api
NODE_ENV=production
EOF
```### **6. Deploy! (1 minute)**
```bash
# Commit and push to trigger deployment
git add .
git commit -m "feat: add AWS deployment pipeline"
git push origin staging

# Create PR staging → main
# When merged, auto-deployment will start!
````

---

## 🎯 What Happens Next

1. **GitHub Actions** runs your CI/CD pipeline
2. **Code is tested** (format, lint, type-check, build)
3. **Deployed to EC2** automatically
4. **Health checks** verify everything works
5. **Your app is live** at `http://3.110.108.184`

---

## 📊 Monitor Your Deployment

- **GitHub Actions**: `https://github.com/tasktrek-io/TaskTrek/actions`
- **Live App**: `http://3.110.108.184`
- **API Health**: `http://3.110.108.184/api/health`
- **Direct API**: `http://3.110.108.184:5000/health` (your API port)
- **Direct Web**: `http://3.110.108.184:3000` (your web port)

---

## 🆘 If Something Goes Wrong

```bash
# SSH into EC2 and check
ssh ubuntu@3.110.108.184
pm2 status
pm2 logs
```

That's it! Your automated deployment pipeline is ready! 🎉
