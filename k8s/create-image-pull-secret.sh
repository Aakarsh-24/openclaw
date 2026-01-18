#!/bin/bash
# Create Kubernetes ImagePullSecret from registry credentials
# This secret allows Kubernetes to pull images from the private registry

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.registry"
NAMESPACE="clawdbot"
SECRET_NAME="vcr-secret"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔐 Creating Kubernetes ImagePullSecret"
echo "======================================"
echo ""

# Check if .env.registry exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ Error: .env.registry not found${NC}"
    echo "Please create it first or run: cp .env.registry.example .env.registry"
    exit 1
fi

# Load credentials
source "$ENV_FILE"

# Validate
if [ -z "$REGISTRY_URL" ] || [ -z "$REGISTRY_USERNAME" ] || [ -z "$REGISTRY_PASSWORD" ]; then
    echo -e "${RED}✗ Error: Missing credentials in .env.registry${NC}"
    exit 1
fi

# Check kubectl connection
if ! kubectl cluster-info &>/dev/null; then
    echo -e "${RED}✗ Error: Cannot connect to Kubernetes cluster${NC}"
    exit 1
fi

echo "Registry: $REGISTRY_URL"
echo "Username: $REGISTRY_USERNAME"
echo "Namespace: $NAMESPACE"
echo "Secret Name: $SECRET_NAME"
echo ""

# Create namespace if doesn't exist
if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    echo "Creating namespace $NAMESPACE..."
    kubectl create namespace "$NAMESPACE"
fi

# Delete existing secret if present
if kubectl get secret "$SECRET_NAME" -n "$NAMESPACE" &>/dev/null; then
    echo -e "${YELLOW}⚠ Secret $SECRET_NAME already exists. Recreating...${NC}"
    kubectl delete secret "$SECRET_NAME" -n "$NAMESPACE"
fi

# Create secret
echo "Creating ImagePullSecret..."
if kubectl create secret docker-registry "$SECRET_NAME" \
    --docker-server="$REGISTRY_URL" \
    --docker-username="$REGISTRY_USERNAME" \
    --docker-password="$REGISTRY_PASSWORD" \
    --docker-email="clawdbot@vnpay.vn" \
    -n "$NAMESPACE"; then
    
    echo ""
    echo -e "${GREEN}✓ ImagePullSecret created successfully${NC}"
    echo ""
    echo "To use this secret, uncomment the following in deployment.yaml:"
    echo ""
    echo "  spec:"
    echo "    template:"
    echo "      spec:"
    echo "        imagePullSecrets:"
    echo "        - name: $SECRET_NAME"
    echo ""
    echo "Verify secret:"
    echo "  kubectl get secret $SECRET_NAME -n $NAMESPACE"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Failed to create secret${NC}"
    exit 1
fi
