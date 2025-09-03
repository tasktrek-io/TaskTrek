#!/bin/bash
set -e

echo "🔧 Setting up Docker on AWS EC2..."

# Update system
sudo apt-get update -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    sudo usermod -aG docker ubuntu
    echo "✅ Docker installed successfully"
    
    # Apply group membership immediately
    newgrp docker << 'NEWGRP_EOF'
echo "Docker group applied"
NEWGRP_EOF
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose if not already installed
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed successfully"
else
    echo "✅ Docker Compose already installed"
fi

echo "📁 Setting up deployment directory..."

# Create app directory
sudo mkdir -p /opt/tasktrek
sudo chown ubuntu:ubuntu /opt/tasktrek
cp -r ./* /opt/tasktrek/
cd /opt/tasktrek

echo "🔧 Updating environment for AWS deployment..."

# Update environment variables for AWS deployment
sed -i 's|http://localhost|http://3.110.108.184|g' .env.prod
sed -i 's|ws://localhost|ws://3.110.108.184|g' .env.prod

echo "🐳 Stopping existing containers..."
docker-compose -f docker-compose.prebuilt.yml down 2>/dev/null || true

echo "🧹 Cleaning up old Docker resources..."
docker system prune -f

echo "📥 Pulling latest images from Docker Hub..."
export DOCKER_REGISTRY=${DOCKER_REGISTRY}
export IMAGE_TAG=${IMAGE_TAG}

# Pull the latest images
docker pull ${DOCKER_REGISTRY}/tasktrek-api:${IMAGE_TAG}
docker pull ${DOCKER_REGISTRY}/tasktrek-web:${IMAGE_TAG}

echo "🚀 Starting services with pre-built images..."
docker-compose -f docker-compose.prebuilt.yml up -d

echo "⏳ Waiting for services to start..."
sleep 60

echo "🔍 Checking service health..."
docker-compose -f docker-compose.prebuilt.yml ps

echo "📋 Recent container logs:"
docker-compose -f docker-compose.prebuilt.yml logs --tail=10

echo "🎉 Deployment completed!"
echo "🌐 Your application should be available at: http://3.110.108.184"

# Test the application
echo "🧪 Testing application health..."
sleep 10
if curl -f http://localhost/health 2>/dev/null; then
    echo "✅ Application is responding correctly"
else
    echo "⚠️ Application health check failed - checking logs..."
    docker-compose -f docker-compose.prebuilt.yml logs --tail=20
fi

echo ""
echo "📊 Deployment Summary:"
echo "  🔸 API Image: ${DOCKER_REGISTRY}/tasktrek-api:${IMAGE_TAG}"
echo "  🔸 Web Image: ${DOCKER_REGISTRY}/tasktrek-web:${IMAGE_TAG}"
echo "  🔸 Application URL: http://3.110.108.184"
echo "  🔸 Deployment Location: /opt/tasktrek"
