#!/bin/bash

echo "🔍 Running health checks..."

# Check if API is running (your API runs on port 5000)
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "000")
if [ "$API_STATUS" = "200" ]; then
    echo "✅ API is healthy (port 5000)"
else
    echo "❌ API health check failed (Status: $API_STATUS)"
    exit 1
fi

# Check if Web is running (port 3000)
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
if [ "$WEB_STATUS" = "200" ]; then
    echo "✅ Web is healthy (port 3000)"
else
    echo "❌ Web health check failed (Status: $WEB_STATUS)"
    exit 1
fi

echo "🎉 All services are healthy!"
