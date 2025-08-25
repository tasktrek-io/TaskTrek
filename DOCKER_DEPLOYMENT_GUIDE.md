# TaskTrek Docker Deployment Guide

This guide will help you deploy TaskTrek to your EC2 instance using Docker containers.

## 📋 Prerequisites

- Ubuntu 20.04+ EC2 instance
- SSH access to your EC2 instance
- Git repository access configured
- Domain/IP: `http://3.110.108.184/`

## 🚀 Initial Setup (One-time)

### 1. SSH into your EC2 instance

```bash
ssh ubuntu@3.110.108.184
```

### 2. Clone the repository

```bash
cd /home/ubuntu
git clone https://github.com/tasktrek-io/TaskTrek.git
cd TaskTrek
```

### 3. Set up Docker environment

```bash
chmod +x scripts/setup-docker.sh
./scripts/setup-docker.sh
```

**Important**: After Docker installation, log out and log back in for group changes to take effect:

```bash
exit
# SSH back in
ssh ubuntu@3.110.108.184
cd TaskTrek
```

### 4. Configure environment variables

```bash
# Copy API environment template
cp apps/api/.env.example apps/api/.env
nano apps/api/.env

# Copy Web environment template
cp apps/web/.env.example apps/web/.env.local
nano apps/web/.env.local
```

Update the API environment file (`apps/api/.env`):

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://mongo:27017/project_mgmt
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
WEB_ORIGIN=http://3.110.108.184

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=TaskTrek

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret
```

Update the Web environment file (`apps/web/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://3.110.108.184/api
NEXT_PUBLIC_WS_URL=http://3.110.108.184
```

## 🔄 Deployment Process

### Deploy the application

```bash
./scripts/deploy.sh
```

This script will:

- Pull latest code from GitHub
- Build Docker images
- Start all services (MongoDB, API, Web, Nginx)
- Run health checks
- Show service status

### Check deployment status

```bash
./scripts/health-check.sh
```

## 🌐 Access Your Application

After successful deployment:

- **Web Application**: http://3.110.108.184/
- **API Endpoints**: http://3.110.108.184/api/
- **Health Check**: http://3.110.108.184/health

## 📊 Monitoring & Management

### View service status

```bash
docker-compose ps
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f web
docker-compose logs -f nginx
docker-compose logs -f mongo
```

### Restart services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart api
docker-compose restart web
```

### Update application

```bash
# Pull latest changes and redeploy
./scripts/deploy.sh
```

## 🔧 Useful Commands

### Docker Management

```bash
# Stop all services
docker-compose down

# Start all services
docker-compose up -d

# Rebuild and start (after code changes)
docker-compose up -d --build

# View resource usage
docker stats

# Clean up unused resources
docker system prune -a
```

### Backup & Restore

```bash
# Backup database
docker-compose exec mongo mongodump --db project_mgmt --out /data/backup

# Copy backup from container
docker cp tasktrek-mongo:/data/backup ./mongo-backup
```

## 🚨 Troubleshooting

### Services not starting

1. Check logs:

   ```bash
   docker-compose logs [service-name]
   ```

2. Check disk space:

   ```bash
   df -h
   ```

3. Check memory:
   ```bash
   free -h
   ```

### API not responding

1. Check API logs:

   ```bash
   docker-compose logs api
   ```

2. Check if API container is running:

   ```bash
   docker-compose ps api
   ```

3. Test API directly:
   ```bash
   curl http://localhost:5000/health
   ```

### Web app not loading

1. Check web logs:

   ```bash
   docker-compose logs web
   ```

2. Check Nginx logs:

   ```bash
   docker-compose logs nginx
   ```

3. Test web service directly:
   ```bash
   curl http://localhost:3000/
   ```

### Database connection issues

1. Check MongoDB logs:

   ```bash
   docker-compose logs mongo
   ```

2. Test MongoDB connection:
   ```bash
   docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"
   ```

### Out of disk space

1. Clean up Docker resources:

   ```bash
   docker system prune -a -f
   ```

2. Remove old backups:
   ```bash
   rm -rf /home/ubuntu/backup/tasktrek-*
   ```

## 🔄 Automatic Updates (Optional)

Set up a cron job for automatic deployments:

```bash
crontab -e
```

Add this line for daily updates at 2 AM:

```bash
0 2 * * * cd /home/ubuntu/TaskTrek && ./scripts/deploy.sh >> /home/ubuntu/deploy.log 2>&1
```

## 📝 Architecture

The Docker deployment consists of:

- **MongoDB**: Database container
- **API**: Node.js/Express backend container
- **Web**: Next.js frontend container
- **Nginx**: Reverse proxy and load balancer

All services communicate through a Docker network and are automatically restarted if they fail.

## 🔒 Security Notes

- Change default JWT secrets in production
- Use environment variables for sensitive data
- Keep Docker and system packages updated
- Monitor logs for security issues
- Consider setting up SSL/HTTPS for production

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run the health check script: `./scripts/health-check.sh`
3. Check logs for specific error messages
4. Ensure all environment variables are properly configured
