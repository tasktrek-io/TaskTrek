#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Configuration - Updated to match your existing setup
DEPLOY_PATH="/home/ubuntu/TaskTrek"
BACKUP_PATH="/home/ubuntu/backup/tasktrek-$(date +%Y%m%d-%H%M%S)"

# Function to handle errors
handle_error() {
    echo "❌ Error occurred in deployment at line $1"
    echo "🔄 Attempting to restore from backup if available..."
    if [ -d "$BACKUP_PATH" ]; then
        rm -rf "$DEPLOY_PATH"
        cp -r "$BACKUP_PATH" "$DEPLOY_PATH"
        echo "✅ Restored from backup"
    fi
    exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Create backup
echo "📦 Creating backup..."
mkdir -p /home/ubuntu/backup
if [ -d "$DEPLOY_PATH" ]; then
    cp -r "$DEPLOY_PATH" "$BACKUP_PATH"
    echo "✅ Backup created at $BACKUP_PATH"
fi

# Stop applications
echo "🛑 Stopping applications..."
pm2 stop tasktrek-api tasktrek-web || echo "⚠️ PM2 processes were not running"

# Update code
echo "📥 Updating code..."
cd "$DEPLOY_PATH"

# Check if git repository exists
if [ ! -d ".git" ]; then
    echo "❌ Git repository not found in $DEPLOY_PATH"
    echo "🔄 Cloning repository..."
    cd /home/ubuntu
    rm -rf TaskTrek
    git clone https://github.com/tasktrek-io/TaskTrek.git
    cd TaskTrek
else
    echo "✅ Git repository found, updating..."
    git fetch origin
    git reset --hard origin/main
fi

# Verify we're in the right directory
pwd
ls -la

# Clean up node_modules to save space and avoid conflicts
echo "🧹 Cleaning up old dependencies..."
rm -rf node_modules apps/*/node_modules

# Install dependencies with memory optimization (include dev dependencies for build)
echo "📦 Installing dependencies with memory limits..."
export NODE_OPTIONS="--max-old-space-size=1024"
export NPM_CONFIG_MAXSOCKETS=1
export NPM_CONFIG_PROGRESS=false

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in $(pwd)"
    exit 1
fi

echo "✅ Found package.json, installing dependencies..."
# Install root dependencies first
npm ci --prefer-offline --no-audit --no-fund --loglevel=error

# Build applications (this requires dev dependencies)
echo "🏗️ Building applications..."
npm run build

# After successful build, clean up dev dependencies to save space
echo "🧹 Removing dev dependencies to save space..."
npm prune --production

# Verify critical files exist after build
echo "🔍 Verifying build outputs..."
if [ ! -f "apps/api/dist/index.js" ]; then
    echo "❌ API build failed - dist/index.js not found"
    echo "📁 Contents of apps/api/:"
    ls -la apps/api/
    exit 1
fi

if [ ! -d "apps/web/.next" ]; then
    echo "❌ Web build failed - .next directory not found"
    echo "📁 Contents of apps/web/:"
    ls -la apps/web/
    exit 1
fi

echo "✅ Build verification passed"

# Clean up build artifacts to save space
echo "🧹 Cleaning up build artifacts..."
find . -name "*.tsbuildinfo" -delete
npm cache clean --force

# Create logs directory for PM2
echo "📁 Creating logs directory..."
mkdir -p logs

# Start applications
echo "🚀 Starting applications..."
pm2 delete tasktrek-api tasktrek-web || echo "⚠️ No existing PM2 processes to delete"

# Check if ecosystem.config.js exists
if [ ! -f "ecosystem.config.js" ]; then
    echo "❌ ecosystem.config.js not found"
    exit 1
fi

echo "✅ Starting PM2 applications..."
pm2 start ecosystem.config.js

# Wait a moment for applications to start
echo "⏳ Waiting for applications to start..."
sleep 10

# Check if applications started successfully
echo "🔍 Checking PM2 process status..."
pm2 list

# Check specific processes
if pm2 list | grep -q "tasktrek-api.*online"; then
    echo "✅ API started successfully"
else
    echo "❌ API failed to start"
    pm2 logs tasktrek-api --lines 20
    exit 1
fi

if pm2 list | grep -q "tasktrek-web.*online"; then
    echo "✅ Web started successfully"
else
    echo "❌ Web failed to start"
    pm2 logs tasktrek-web --lines 20
    exit 1
fi

# Save PM2 configuration
pm2 save

echo "✅ Deployment completed successfully!"
echo "🌐 API should be available at: http://localhost:5000"
echo "🌐 Web should be available at: http://localhost:3000"
