#!/bin/bash
# Quick Start Script for Clawdbot Deployment
# Run this script to go through all deployment steps interactively

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🦞 Clawdbot Kaas Deployment - Quick Start"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to ask yes/no question
ask_yes_no() {
    while true; do
        read -p "$1 (y/n): " yn
        case $yn in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes or no.";;
        esac
    done
}

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
MISSING_TOOLS=()

if ! command_exists kubectl; then
    MISSING_TOOLS+=("kubectl")
fi

if ! command_exists docker; then
    MISSING_TOOLS+=("docker")
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo -e "${RED}Missing required tools: ${MISSING_TOOLS[*]}${NC}"
    echo "Please install them before continuing."
    exit 1
fi

echo -e "${GREEN}✓ All required tools are installed${NC}"
echo ""

# Step 2: Check kubectl connection
echo -e "${YELLOW}Step 2: Checking Kubernetes cluster connection...${NC}"
if kubectl cluster-info &>/dev/null; then
    CURRENT_CONTEXT=$(kubectl config current-context)
    echo -e "${GREEN}✓ Connected to cluster: ${CURRENT_CONTEXT}${NC}"
    
    # Verify it's the right cluster
    if [[ "$CURRENT_CONTEXT" == *"prj-cus-78-cluster01"* ]]; then
        echo -e "${GREEN}✓ Correct cluster detected${NC}"
    else
        echo -e "${YELLOW}⚠ Warning: Current context is not prj-cus-78-cluster01${NC}"
        if ! ask_yes_no "Continue anyway?"; then
            exit 1
        fi
    fi
else
    echo -e "${RED}✗ Cannot connect to cluster${NC}"
    echo "Please configure your kubeconfig first:"
    echo "  mkdir -p ~/.kube"
    echo "  # Copy your kubeconfig to ~/.kube/config"
    exit 1
fi
echo ""

# Step 3: Docker registry login
echo -e "${YELLOW}Step 3: Docker registry login${NC}"
if ask_yes_no "Have you already logged in to vcr.vnpaycloud.vn?"; then
    echo -e "${GREEN}✓ Registry login confirmed${NC}"
else
    echo "Attempting to login to vcr.vnpaycloud.vn..."
    if docker login vcr.vnpaycloud.vn; then
        echo -e "${GREEN}✓ Successfully logged in to registry${NC}"
    else
        echo -e "${RED}✗ Registry login failed${NC}"
        exit 1
    fi
fi
echo ""

# Step 4: Build and push Docker image
echo -e "${YELLOW}Step 4: Build and push Docker image${NC}"
if ask_yes_no "Do you want to build and push the Docker image now?"; then
    echo "Building and pushing Docker image..."
    if [ -f ./build-push-script.sh ]; then
        if ./build-push-script.sh; then
            echo -e "${GREEN}✓ Image built and pushed successfully${NC}"
        else
            echo -e "${RED}✗ Image build/push failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ build-push-script.sh not found${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Skipping image build. Make sure image exists in registry!${NC}"
fi
echo ""

# Step 5: Create secrets
echo -e "${YELLOW}Step 5: Configure Kubernetes secrets${NC}"
if [ ! -f secret.yaml ]; then
    echo "secret.yaml not found. Creating from template..."
    if [ -f secret.yaml.template ]; then
        cp secret.yaml.template secret.yaml
        echo -e "${YELLOW}⚠ Please edit secret.yaml and add your API keys${NC}"
        echo "  vim secret.yaml"
        echo ""
        if ask_yes_no "Open secret.yaml in editor now?"; then
            ${EDITOR:-vim} secret.yaml
        else
            echo "Please edit secret.yaml manually before continuing."
            exit 1
        fi
    else
        echo -e "${RED}✗ secret.yaml.template not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ secret.yaml exists${NC}"
fi

# Validate secret.yaml
if grep -q "your-secure-random-token-here" secret.yaml; then
    echo -e "${RED}✗ secret.yaml still contains placeholder values${NC}"
    echo "Please update the secrets before deploying."
    if ask_yes_no "Open secret.yaml in editor now?"; then
        ${EDITOR:-vim} secret.yaml
    else
        exit 1
    fi
fi
echo ""

# Step 6: Review configuration
echo -e "${YELLOW}Step 6: Review configuration${NC}"
echo "Current configuration:"
echo "  Registry: vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest"
echo "  Cluster: $(kubectl config current-context)"
echo "  Namespace: clawdbot"
echo ""

# Step 7: Deploy
echo -e "${YELLOW}Step 7: Deploy to Kubernetes${NC}"
if ask_yes_no "Ready to deploy to Kubernetes?"; then
    echo "Deploying Clawdbot to Kubernetes..."
    if [ -f ./deploy.sh ]; then
        if ./deploy.sh; then
            echo ""
            echo -e "${GREEN}✓✓✓ Deployment completed successfully! ✓✓✓${NC}"
        else
            echo -e "${RED}✗ Deployment failed${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ deploy.sh not found${NC}"
        exit 1
    fi
else
    echo "Deployment cancelled."
    exit 0
fi
echo ""

# Step 8: Post-deployment
echo -e "${GREEN}=========================================="
echo "🎉 Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Check deployment status:"
echo "   kubectl get all -n clawdbot"
echo ""
echo "2. View logs:"
echo "   kubectl logs -f deployment/clawdbot-gateway -n clawdbot"
echo ""
echo "3. Get gateway token:"
echo "   kubectl get secret clawdbot-secrets -n clawdbot -o jsonpath='{.data.CLAWDBOT_GATEWAY_TOKEN}' | base64 -d"
echo ""
echo "4. Get Ingress IP (for DNS configuration):"
echo "   kubectl get ingress -n clawdbot -o wide"
echo ""
echo "5. Update Ingress domain in ingress.yaml, then:"
echo "   kubectl apply -f ingress.yaml"
echo ""
echo "6. Configure DNS A record pointing to Ingress IP"
echo ""
echo "7. Access Control UI:"
echo "   https://clawdbot.yourdomain.com"
echo ""
echo "For more information, see k8s/README.md"
echo ""
