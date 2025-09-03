#!/bin/bash

# AWS EC2 deployment script for pre-built Docker images
set -e

echo "🚀 Deploying TaskTrek to AWS EC2 using pre-built images..."

# Configuration
EC2_USER=${EC2_USER:-ubuntu}
EC2_HOST=${EC2_HOST:-3.110.108.184}
KEY_PATH=${KEY_PATH:-~/.ssh/tasktrek-deploy-no-pass}
DOCKER_REGISTRY=${DOCKER_REGISTRY:-curiousram}
IMAGE_TAG=${IMAGE_TAG:-latest}

echo "📋 Configuration:"
echo "  EC2 Host: $EC2_HOST"
echo "  EC2 User: $EC2_USER"
echo "  Docker Registry: $DOCKER_REGISTRY"
echo "  Image Tag: $IMAGE_TAG"
echo ""

# Test SSH connection
echo "🔗 Testing SSH connection..."
if ssh -i "$KEY_PATH" -o ConnectTimeout=10 "$EC2_USER@$EC2_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed"
    echo "Please check:"
    echo "  - Your SSH key permissions: chmod 400 $KEY_PATH"
    echo "  - Your EC2 instance is running"
    echo "  - Security group allows SSH (port 22)"
    exit 1
fi

echo "📦 Creating deployment package..."

# Create minimal deployment package (no source code needed!)
mkdir -p ./deployment-package

# Copy only configuration files
cp docker-compose.prebuilt.yml ./deployment-package/
cp nginx.prod.conf ./deployment-package/
cp .env.prod ./deployment-package/

# Create deployment script for EC2
cat > ./deployment-package/deploy-prebuilt.sh << 'EOF'
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
EOF

chmod +x ./deployment-package/deploy-prebuilt.sh

echo "📤 Uploading deployment files to EC2..."

# Upload only configuration files (much faster!)
scp -i "$KEY_PATH" -r ./deployment-package/* "$EC2_USER@$EC2_HOST:~/"

echo "🔧 Running deployment on EC2..."

# Execute deployment on EC2 with environment variables
ssh -i "$KEY_PATH" "$EC2_USER@$EC2_HOST" "
export DOCKER_REGISTRY=$DOCKER_REGISTRY
export IMAGE_TAG=$IMAGE_TAG
bash ~/deploy-prebuilt.sh
"

echo "✅ AWS EC2 deployment completed!"

# Cleanup
rm -rf ./deployment-package

echo ""
echo "🎉 TaskTrek has been deployed to AWS EC2 using pre-built images!"
echo ""
echo "📊 Deployment Summary:"
echo "  🌐 Application URL: http://$EC2_HOST"
echo "  🔸 API Image: $DOCKER_REGISTRY/tasktrek-api:$IMAGE_TAG"
echo "  🔸 Web Image: $DOCKER_REGISTRY/tasktrek-web:$IMAGE_TAG"
echo ""
echo "🔧 Management Commands:"
echo "  📋 Check status: ssh -i $KEY_PATH $EC2_USER@$EC2_HOST 'cd /opt/tasktrek && docker-compose -f docker-compose.prebuilt.yml ps'"
echo "  📋 View logs: ssh -i $KEY_PATH $EC2_USER@$EC2_HOST 'cd /opt/tasktrek && docker-compose -f docker-compose.prebuilt.yml logs -f'"
echo "  🔄 Restart: ssh -i $KEY_PATH $EC2_USER@$EC2_HOST 'cd /opt/tasktrek && docker-compose -f docker-compose.prebuilt.yml restart'"
