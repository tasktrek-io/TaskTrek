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
