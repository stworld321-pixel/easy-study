#!/bin/bash
# ==============================================
# Zeal Catalyst - Manual Deployment Script
# ==============================================

set -e

# Configuration - UPDATE THESE VALUES
VPS_HOST="${VPS_HOST:-YOUR_VPS_IP}"
VPS_USER="${VPS_USER:-zealcatalyst}"
DOMAIN="${DOMAIN:-yourdomain.com}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if we can connect to VPS
check_connection() {
    log_info "Checking VPS connection..."
    if ssh -o ConnectTimeout=5 "$VPS_USER@$VPS_HOST" "echo 'Connected'" &> /dev/null; then
        log_success "VPS connection OK"
    else
        log_error "Cannot connect to VPS. Check your SSH configuration."
        exit 1
    fi
}

# Build frontend
build_frontend() {
    log_info "Building frontend..."
    cd frontend

    # Create production env if not exists
    if [ ! -f .env.production ]; then
        log_warning ".env.production not found. Creating with default values..."
        echo "VITE_API_URL=https://api.$DOMAIN/api" > .env.production
    fi

    npm install
    npm run build
    cd ..
    log_success "Frontend built successfully"
}

# Deploy backend
deploy_backend() {
    log_info "Deploying backend..."
    rsync -avz --delete \
        --exclude 'venv' \
        --exclude '.env' \
        --exclude '__pycache__' \
        --exclude '*.pyc' \
        --exclude '.pytest_cache' \
        --exclude '.git' \
        backend/ "$VPS_USER@$VPS_HOST:/var/www/zealcatalyst/backend/"
    log_success "Backend deployed"
}

# Deploy frontend
deploy_frontend() {
    log_info "Deploying frontend..."
    rsync -avz --delete \
        frontend/dist/ "$VPS_USER@$VPS_HOST:/var/www/zealcatalyst/frontend/dist/"
    log_success "Frontend deployed"
}

# Restart services
restart_services() {
    log_info "Restarting services on VPS..."
    ssh "$VPS_USER@$VPS_HOST" << 'ENDSSH'
        cd /var/www/zealcatalyst/backend
        source venv/bin/activate
        pip install -r requirements.txt --quiet
        pm2 restart zealcatalyst-api --update-env
        echo "Services restarted"
ENDSSH
    log_success "Services restarted"
}

# Health check
health_check() {
    log_info "Running health check..."
    sleep 5
    if curl -sf "https://api.$DOMAIN/health" > /dev/null; then
        log_success "Health check passed!"
    else
        log_warning "Health check failed. Check the logs on the server."
    fi
}

# Main menu
show_menu() {
    echo ""
    echo "========================================"
    echo "  Zeal Catalyst Deployment Script"
    echo "========================================"
    echo ""
    echo "1) Full deployment (build + deploy all)"
    echo "2) Deploy backend only"
    echo "3) Deploy frontend only"
    echo "4) Build frontend only"
    echo "5) Restart services only"
    echo "6) Run health check"
    echo "7) View server logs"
    echo "8) SSH to server"
    echo "0) Exit"
    echo ""
    read -p "Select option: " choice
}

# View logs
view_logs() {
    log_info "Fetching recent logs..."
    ssh "$VPS_USER@$VPS_HOST" "pm2 logs zealcatalyst-api --lines 50"
}

# SSH to server
ssh_to_server() {
    log_info "Connecting to server..."
    ssh "$VPS_USER@$VPS_HOST"
}

# Main
main() {
    case "${1:-menu}" in
        --full)
            check_connection
            build_frontend
            deploy_backend
            deploy_frontend
            restart_services
            health_check
            ;;
        --backend)
            check_connection
            deploy_backend
            restart_services
            ;;
        --frontend)
            check_connection
            build_frontend
            deploy_frontend
            ;;
        --restart)
            check_connection
            restart_services
            ;;
        menu|*)
            while true; do
                show_menu
                case $choice in
                    1)
                        check_connection
                        build_frontend
                        deploy_backend
                        deploy_frontend
                        restart_services
                        health_check
                        ;;
                    2)
                        check_connection
                        deploy_backend
                        restart_services
                        ;;
                    3)
                        check_connection
                        build_frontend
                        deploy_frontend
                        ;;
                    4)
                        build_frontend
                        ;;
                    5)
                        check_connection
                        restart_services
                        ;;
                    6)
                        health_check
                        ;;
                    7)
                        view_logs
                        ;;
                    8)
                        ssh_to_server
                        ;;
                    0)
                        log_info "Goodbye!"
                        exit 0
                        ;;
                    *)
                        log_error "Invalid option"
                        ;;
                esac
            done
            ;;
    esac
}

# Run
main "$@"
