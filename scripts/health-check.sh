#!/bin/bash

echo "🔍 Running health checks..."

# Check PM2 processes first
echo "📊 PM2 Status:"
pm2 status

# Check if API is running (try health endpoint first, fall back to any response)
echo "🔍 Checking API (port 5000)..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health 2>/dev/null || echo "000")
if [ "$API_STATUS" = "000" ]; then
    # Try root endpoint if health endpoint doesn't exist
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 2>/dev/null || echo "000")
fi

if [ "$API_STATUS" = "200" ] || [ "$API_STATUS" = "404" ] || [ "$API_STATUS" = "301" ]; then
    echo "✅ API is responding (port 5000, status: $API_STATUS)"
else
    echo "❌ API health check failed (Status: $API_STATUS)"
    echo "🔍 API logs:"
    pm2 logs tasktrek-api --lines 5 --nostream || echo "No API logs available"
    exit 1
fi

# Check if Web is running (port 3000)
echo "🔍 Checking Web (port 3000)..."
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "000")
if [ "$WEB_STATUS" = "200" ] || [ "$WEB_STATUS" = "404" ] || [ "$WEB_STATUS" = "301" ]; then
    echo "✅ Web is responding (port 3000, status: $WEB_STATUS)"
else
    echo "❌ Web health check failed (Status: $WEB_STATUS)"
    echo "🔍 Web logs:"
    pm2 logs tasktrek-web --lines 5 --nostream || echo "No Web logs available"
    exit 1
fi

echo "🎉 All services are healthy!"
