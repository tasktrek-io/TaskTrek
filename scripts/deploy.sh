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
rm -rf node_modules apps/*/node_modules

# Install dependencies with memory optimization (include dev dependencies for build)
echo "📦 Installing dependencies with memory limits..."
export NODE_OPTIONS="--max-old-space-size=1024"
export NPM_CONFIG_MAXSOCKETS=1
export NPM_CONFIG_PROGRESS=false

# Install root dependencies first
npm ci --prefer-offline --no-audit --no-fund --loglevel=error

# Build applications (this requires dev dependencies)
echo "🏗️ Building applications..."
npm run build

# After successful build, clean up dev dependencies to save space
echo "🧹 Removing dev dependencies to save space..."
npm prune --production

# Verify critical files exist after build
if [ ! -f "apps/api/dist/index.js" ]; then
    echo "❌ API build failed - dist/index.js not found"
    exit 1
fi

if [ ! -d "apps/web/.next" ]; then
    echo "❌ Web build failed - .next directory not found"
    exit 1
fi

# Clean up build artifacts to save space
echo "🧹 Cleaning up build artifacts..."
find . -name "*.tsbuildinfo" -delete
npm cache clean --force

# Create logs directory for PM2
echo "📁 Creating logs directory..."
mkdir -p logs

# Start applications
echo "🚀 Starting applications..."
pm2 delete tasktrek-api tasktrek-web || true
pm2 start ecosystem.config.js

# Wait a moment for applications to start
sleep 5

# Check if applications started successfully
pm2 list | grep -E "(tasktrek-api|tasktrek-web)"

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed successfully!"
