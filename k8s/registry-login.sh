#!/bin/bash
# Registry Login Helper Script
# Automatically logs in to VNPay Cloud Container Registry using credentials from .env.registry

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.registry"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔑 VNPay Cloud Container Registry Login"
echo "========================================"
echo ""

# Check if .env.registry exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ Error: .env.registry not found${NC}"
    echo ""
    echo "Please create $ENV_FILE with:"
    echo "  REGISTRY_URL=vcr.vnpaycloud.vn"
    echo "  REGISTRY_USERNAME=your-username"
    echo "  REGISTRY_PASSWORD=your-password"
    echo ""
    exit 1
fi

# Load credentials from .env.registry
source "$ENV_FILE"

# Validate required variables
if [ -z "$REGISTRY_URL" ] || [ -z "$REGISTRY_USERNAME" ] || [ -z "$REGISTRY_PASSWORD" ]; then
    echo -e "${RED}✗ Error: Missing required credentials in .env.registry${NC}"
    echo ""
    echo "Required variables:"
    echo "  REGISTRY_URL"
    echo "  REGISTRY_USERNAME"
    echo "  REGISTRY_PASSWORD"
    echo ""
    exit 1
fi

echo "Registry: $REGISTRY_URL"
echo "Username: $REGISTRY_USERNAME"
echo ""

# Login to registry
echo "Logging in..."
if echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY_URL" -u "$REGISTRY_USERNAME" --password-stdin; then
    echo ""
    echo -e "${GREEN}✓ Successfully logged in to $REGISTRY_URL${NC}"
    echo ""
    echo "You can now:"
    echo "  • Build and push images: ./build-push-script.sh"
    echo "  • Pull images: docker pull ${REGISTRY_URL}/${REGISTRY_PROJECT}/clawdbot:latest"
    echo ""
else
    echo ""
    echo -e "${RED}✗ Login failed${NC}"
    echo "Please check your credentials in .env.registry"
    exit 1
fi
