#!/bin/bash
set -e

echo "🚀 Starting Docker-based deployment to EC2..."

# Configuration
DEPLOY_PATH="/home/ubuntu/TaskTrek"
BACKUP_PATH="/home/ubuntu/backup/tasktrek-$(date +%Y%m%d-%H%M%S)"
COMPOSE_FILE="docker-compose.yml"

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

# Function to handle errors
handle_error() {
    error "Error occurred in deployment at line $1"
    log "🔄 Attempting to restore services if backup exists..."
    
    if [ -d "$BACKUP_PATH" ]; then
        cd "$BACKUP_PATH"
        if [ -f "$COMPOSE_FILE" ]; then
            docker-compose down --remove-orphans || true
            docker-compose up -d
            success "Restored services from backup"
        fi
    fi
    
    exit 1
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Check if Docker is installed and running
log "� Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker info &> /dev/null; then
    error "Docker is not running. Please start Docker service."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

success "Docker and Docker Compose are ready"

# Create backup directory
log "📦 Creating backup directory..."
mkdir -p /home/ubuntu/backup
success "Backup directory created"

# Update code from Git
log "📥 Updating code from Git..."
cd "$DEPLOY_PATH" || {
    error "Deploy path $DEPLOY_PATH does not exist"
    log "🔄 Cloning repository..."
    cd /home/ubuntu
    git clone https://github.com/tasktrek-io/TaskTrek.git
    cd TaskTrek
}

# Verify we're in a git repository
if [ ! -d ".git" ]; then
    error "Not a git repository. Please ensure the code is properly cloned."
    exit 1
fi

log "✅ Git repository found, updating..."
git fetch origin
git reset --hard origin/main
success "Code updated from Git"

# Create backup of current deployment
if [ -f "$COMPOSE_FILE" ]; then
    log "📦 Creating backup of current deployment..."
    cp -r . "$BACKUP_PATH"
    success "Backup created at $BACKUP_PATH"
fi

# Stop existing containers
log "� Stopping existing containers..."
docker-compose down --remove-orphans || warn "No existing containers to stop"

# Clean up old images and containers to free space
log "🧹 Cleaning up old Docker images and containers..."
docker container prune -f || true
docker image prune -f || true
docker volume prune -f || true
success "Docker cleanup completed"

# Build and start new containers
log "🏗️ Building and starting new containers..."
docker-compose build --no-cache

log "🚀 Starting services..."
docker-compose up -d

# Wait for services to start
log "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
log "🔍 Checking service health..."

# Check MongoDB
if docker-compose ps mongo | grep -q "Up"; then
    success "MongoDB is running"
else
    error "MongoDB failed to start"
    docker-compose logs mongo
    exit 1
fi

# Check API
if docker-compose ps api | grep -q "Up"; then
    success "API service is running"
    
    # Test API health endpoint
    log "🔍 Testing API health endpoint..."
    for i in {1..10}; do
        if curl -f http://localhost:5000/health &> /dev/null; then
            success "API health check passed"
            break
        elif [ $i -eq 10 ]; then
            error "API health check failed after 10 attempts"
            docker-compose logs api
            exit 1
        else
            log "API health check attempt $i/10..."
            sleep 5
        fi
    done
else
    error "API service failed to start"
    docker-compose logs api
    exit 1
fi

# Check Web
if docker-compose ps web | grep -q "Up"; then
    success "Web service is running"
    
    # Test Web service
    log "� Testing Web service..."
    for i in {1..10}; do
        if curl -f http://localhost:3000/ &> /dev/null; then
            success "Web service health check passed"
            break
        elif [ $i -eq 10 ]; then
            error "Web service health check failed after 10 attempts"
            docker-compose logs web
            exit 1
        else
            log "Web service health check attempt $i/10..."
            sleep 5
        fi
    done
else
    error "Web service failed to start"
    docker-compose logs web
    exit 1
fi

# Check Nginx
if docker-compose ps nginx | grep -q "Up"; then
    success "Nginx service is running"
    
    # Test Nginx
    log "🔍 Testing Nginx proxy..."
    for i in {1..5}; do
        if curl -f http://localhost/ &> /dev/null; then
            success "Nginx proxy health check passed"
            break
        elif [ $i -eq 5 ]; then
            warn "Nginx proxy health check failed, but continuing..."
            docker-compose logs nginx
        else
            log "Nginx proxy health check attempt $i/5..."
            sleep 3
        fi
    done
else
    error "Nginx service failed to start"
    docker-compose logs nginx
    exit 1
fi

# Show running containers
log "📊 Current container status:"
docker-compose ps

# Show resource usage
log "💾 System resource usage:"
docker stats --no-stream

success "🎉 Deployment completed successfully!"
echo
log "🌐 Your application is now available at:"
log "   • Web: http://3.110.108.184/"
log "   • API: http://3.110.108.184/api/"
log "   • Health: http://3.110.108.184/health"
echo
log "📋 To monitor your application:"
log "   • View logs: docker-compose logs -f [service]"
log "   • Check status: docker-compose ps"
log "   • Stop services: docker-compose down"
log "   • Restart services: docker-compose restart"
