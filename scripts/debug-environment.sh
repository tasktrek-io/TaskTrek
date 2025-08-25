#!/bin/bash

echo "🔍 Environment Debug Information"
echo "================================"

echo "📅 Date: $(date)"
echo "👤 User: $(whoami)"
echo "📂 Current Directory: $(pwd)"
echo "🏠 Home Directory: $HOME"

echo ""
echo "🖥️ System Information:"
echo "- OS: $(uname -a)"
echo "- Memory: $(free -h)"
echo "- Disk: $(df -h /)"

echo ""
echo "🔧 Tool Versions:"
echo "- Node.js: $(node --version 2>/dev/null || echo 'Not installed')"
echo "- NPM: $(npm --version 2>/dev/null || echo 'Not installed')"
echo "- Git: $(git --version 2>/dev/null || echo 'Not installed')"
echo "- PM2: $(pm2 --version 2>/dev/null || echo 'Not installed')"

echo ""
echo "📁 Directory Structure:"
if [ -d "/home/ubuntu/TaskTrek" ]; then
    echo "✅ TaskTrek directory exists"
    cd /home/ubuntu/TaskTrek
    echo "📂 Contents:"
    ls -la
    
    if [ -f "package.json" ]; then
        echo "✅ package.json found"
    else
        echo "❌ package.json not found"
    fi
    
    if [ -d ".git" ]; then
        echo "✅ Git repository found"
        echo "🔗 Current branch: $(git branch --show-current 2>/dev/null || echo 'Unknown')"
        echo "📝 Latest commit: $(git log -1 --oneline 2>/dev/null || echo 'Unable to get commit info')"
    else
        echo "❌ Git repository not found"
    fi
else
    echo "❌ TaskTrek directory not found"
fi

echo ""
echo "🏃 PM2 Processes:"
pm2 list 2>/dev/null || echo "PM2 not responding or not installed"

echo ""
echo "🌐 Network:"
echo "- Listening ports: $(netstat -tlnp 2>/dev/null | grep -E ':(3000|5000)' || echo 'None found on ports 3000/5000')"

echo ""
echo "📝 Recent logs (if available):"
if [ -d "/home/ubuntu/TaskTrek/logs" ]; then
    echo "Log directory exists:"
    ls -la /home/ubuntu/TaskTrek/logs/
else
    echo "No log directory found"
fi

echo ""
echo "🔍 Debug completed"
