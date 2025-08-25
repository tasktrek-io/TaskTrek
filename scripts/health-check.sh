#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

echo "🏥 TaskTrek Health Check - Docker Deployment"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    error "docker-compose.yml not found. Please run this script from the project root."
    exit 1
fi

# Check Docker daemon
log "🐳 Checking Docker daemon..."
if docker info >/dev/null 2>&1; then
    success "Docker daemon is running"
else
    error "Docker daemon is not running"
    exit 1
fi

# Check Docker Compose
log "🔧 Checking Docker Compose..."
if command -v docker-compose >/dev/null 2>&1; then
    success "Docker Compose is available"
else
    error "Docker Compose is not installed"
    exit 1
fi

# Check container status
log "📦 Checking container status..."
docker-compose ps

# Check individual services
services=("mongo" "api" "web" "nginx")
for service in "${services[@]}"; do
    log "🔍 Checking $service service..."
    if docker-compose ps $service | grep -q "Up"; then
        success "$service container is running"
        
        # Service-specific health checks
        case $service in
            "mongo")
                log "🔍 Testing MongoDB connection..."
                if docker-compose exec -T mongo mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
                    success "MongoDB is responding"
                else
                    warn "MongoDB connection test failed"
                fi
                ;;
            "api")
                log "🔍 Testing API health endpoint..."
                if curl -f -s http://localhost:5000/health >/dev/null 2>&1; then
                    success "API health endpoint is responding"
                else
                    warn "API health endpoint is not responding"
                    log "API logs (last 10 lines):"
                    docker-compose logs --tail=10 api
                fi
                ;;
            "web")
                log "🔍 Testing Web service..."
                if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
                    success "Web service is responding"
                else
                    warn "Web service is not responding"
                    log "Web logs (last 10 lines):"
                    docker-compose logs --tail=10 web
                fi
                ;;
            "nginx")
                log "🔍 Testing Nginx proxy..."
                if curl -f -s http://localhost/ >/dev/null 2>&1; then
                    success "Nginx proxy is responding"
                else
                    warn "Nginx proxy is not responding"
                    log "Nginx logs (last 10 lines):"
                    docker-compose logs --tail=10 nginx
                fi
                ;;
        esac
    else
        error "$service container is not running"
        log "$service logs (last 20 lines):"
        docker-compose logs --tail=20 $service
    fi
    echo
done

# Check external connectivity
log "🌐 Testing external connectivity..."
if curl -f -s http://3.110.108.184/ >/dev/null 2>&1; then
    success "External access is working"
else
    warn "External access might not be working"
fi

# Check disk usage
log "💾 Checking disk usage..."
df -h | grep -E "Filesystem|/dev/"

# Check memory usage
log "🧠 Checking memory usage..."
free -h

# Check Docker resource usage
log "📊 Docker resource usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Check Docker volumes
log "📁 Docker volumes:"
docker volume ls

# Summary
echo
log "📋 Health Check Summary:"
if docker-compose ps | grep -q "Up"; then
    success "Some services are running"
    
    # Count running services
    running_count=$(docker-compose ps | grep "Up" | wc -l)
    total_count=${#services[@]}
    
    if [ $running_count -eq $total_count ]; then
        success "All $total_count services are running"
    else
        warn "$running_count out of $total_count services are running"
    fi
else
    error "No services are running"
fi

log "� Useful commands:"
log "  • View logs: docker-compose logs -f [service]"
log "  • Restart service: docker-compose restart [service]"
log "  • Rebuild service: docker-compose up -d --build [service]"
log "  • Stop all: docker-compose down"
log "  • Clean up: docker system prune -a"

echo "=============================================="
