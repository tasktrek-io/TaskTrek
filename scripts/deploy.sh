#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Configuration - Updated to match your existing setup
DEPLOY_PATH="/home/ubuntu/TaskTrek"
BACKUP_PATH="/home/ubuntu/backup/tasktrek-$(date +%Y%m%d-%H%M%S)"

# Create backup
echo "📦 Creating backup..."
mkdir -p /home/ubuntu/backup
if [ -d "$DEPLOY_PATH" ]; then
    cp -r "$DEPLOY_PATH" "$BACKUP_PATH"
fi

# Stop applications
echo "🛑 Stopping applications..."
pm2 stop tasktrek-api tasktrek-web || true

# Update code
echo "📥 Updating code..."
cd "$DEPLOY_PATH"
git fetch origin
git reset --hard origin/main

# Clean up node_modules to save space and avoid conflicts
echo "🧹 Cleaning up old dependencies..."
rm -rf node_modules
rm -rf apps/*/node_modules

# Install dependencies with memory optimization
echo "📦 Installing dependencies..."
export NODE_OPTIONS="--max-old-space-size=1024"
npm ci --production --prefer-offline --no-audit --no-fund

# Build applications
echo "🏗️ Building applications..."
npm run build

# Install workspace dependencies separately to avoid memory issues
echo "📦 Installing API dependencies..."
cd apps/api 
rm -rf node_modules
npm ci --production --prefer-offline --no-audit --no-fund
cd ../..

echo "📦 Installing Web dependencies..."
cd apps/web 
rm -rf node_modules
npm ci --production --prefer-offline --no-audit --no-fund
cd ../..

# Clean up build artifacts to save space
echo "🧹 Cleaning up build artifacts..."
find . -name "*.tsbuildinfo" -delete
npm cache clean --force

# Start applications
echo "🚀 Starting applications..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed successfully!"
