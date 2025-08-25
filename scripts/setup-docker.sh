#!/bin/bash
set -e

echo "🐳 Setting up Docker environment on EC2..."

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

# Update system packages
log "📦 Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y
success "System packages updated"

# Install Docker
log "🐳 Installing Docker..."
if ! command -v docker &> /dev/null; then
    # Remove old versions
    sudo apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Install dependencies
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    success "Docker installed successfully"
else
    success "Docker is already installed"
fi

# Install Docker Compose
log "🔧 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    success "Docker Compose installed successfully"
else
    success "Docker Compose is already installed"
fi

# Add user to docker group
log "👤 Adding user to docker group..."
sudo usermod -aG docker $USER
success "User added to docker group"

# Start and enable Docker
log "🚀 Starting Docker service..."
sudo systemctl start docker
sudo systemctl enable docker
success "Docker service started and enabled"

# Create necessary directories
log "📁 Creating application directories..."
mkdir -p /home/ubuntu/backup
mkdir -p /home/ubuntu/TaskTrek/logs
success "Directories created"

# Set up log rotation for Docker
log "📋 Setting up Docker log rotation..."
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    }
}
EOF

sudo systemctl restart docker
success "Docker log rotation configured"

# Install additional monitoring tools
log "📊 Installing monitoring tools..."
sudo apt-get install -y htop iotop nethogs
success "Monitoring tools installed"

# Configure firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    log "🔒 Configuring firewall..."
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 443/tcp   # HTTPS
    sudo ufw allow 3000/tcp  # Web app
    sudo ufw allow 5000/tcp  # API
    
    # Enable firewall (only if not already enabled)
    if ! sudo ufw status | grep -q "Status: active"; then
        sudo ufw --force enable
    fi
    success "Firewall configured"
fi

# Create environment file template
log "📝 Creating environment file template..."
cat > /home/ubuntu/TaskTrek/.env.example <<EOF
# Database
MONGO_URI=mongodb://mongo:27017/project_mgmt

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com

# Application URLs
WEB_ORIGIN=http://3.110.108.184
API_URL=http://3.110.108.184:5000

# File Upload
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Node Environment
NODE_ENV=production
EOF

success "Environment file template created"

# Display version information
log "📋 Installation summary:"
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"

success "🎉 Docker environment setup completed!"
echo
warn "⚠️  IMPORTANT NEXT STEPS:"
log "1. Log out and log back in for docker group changes to take effect"
log "2. Copy .env.example to .env and configure your environment variables"
log "3. Run the deployment script to start your application"
echo
log "🚀 To deploy your application, run:"
log "   cd /home/ubuntu/TaskTrek && ./scripts/deploy.sh"
