#!/bin/bash
set -e

# VNPay Cloud Container Registry Configuration
REGISTRY="vcr.vnpaycloud.vn"
PROJECT="286e18c6183846159c47575db4e3d831-clawdbot"
IMAGE_NAME="clawdbot"
TAG="${TAG:-$(date +%Y%m%d-%H%M%S)}"
FULL_IMAGE="${REGISTRY}/${PROJECT}/${IMAGE_NAME}:${TAG}"
LATEST_IMAGE="${REGISTRY}/${PROJECT}/${IMAGE_NAME}:latest"

# Change to project root directory (parent of k8s/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "🐳 Building Clawdbot Docker image..."
echo "Working directory: $(pwd)"
docker build -t "${FULL_IMAGE}" -f Dockerfile .

echo "🏷️  Tagging as latest..."
docker tag "${FULL_IMAGE}" "${LATEST_IMAGE}"

echo "📤 Pushing to registry..."
docker push "${FULL_IMAGE}"
docker push "${LATEST_IMAGE}"

echo ""
echo "✅ Image pushed successfully:"
echo "   ${FULL_IMAGE}"
echo "   ${LATEST_IMAGE}"
echo ""
echo "💡 Next steps:"
echo "   1. Update image in k8s/deployment.yaml"
echo "   2. Run: cd k8s && ./deploy.sh"
