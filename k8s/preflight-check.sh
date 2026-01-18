#!/bin/bash
# Pre-deployment Checklist Script
# Verifies all prerequisites are met before deploying

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNING=0

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Clawdbot Pre-Deployment Checklist   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

check_pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((CHECKS_WARNING++))
}

# 1. Tools
echo -e "${BLUE}[1/10]${NC} Checking required tools..."
if command -v kubectl &>/dev/null; then
    KUBECTL_VERSION=$(kubectl version --client --short 2>/dev/null | head -n1)
    check_pass "kubectl installed: $KUBECTL_VERSION"
else
    check_fail "kubectl not installed"
fi

if command -v docker &>/dev/null; then
    DOCKER_VERSION=$(docker --version)
    check_pass "docker installed: $DOCKER_VERSION"
else
    check_fail "docker not installed"
fi

if command -v openssl &>/dev/null; then
    check_pass "openssl installed (for token generation)"
else
    check_warn "openssl not installed (optional)"
fi
echo ""

# 2. Kubeconfig
echo -e "${BLUE}[2/10]${NC} Checking Kubernetes configuration..."
if kubectl cluster-info &>/dev/null; then
    CURRENT_CONTEXT=$(kubectl config current-context)
    check_pass "Cluster connection successful"
    check_pass "Current context: $CURRENT_CONTEXT"
    
    if [[ "$CURRENT_CONTEXT" == *"prj-cus-78-cluster01"* ]]; then
        check_pass "Correct cluster context"
    else
        check_warn "Context name doesn't match expected cluster"
    fi
    
    # Check API server
    API_SERVER=$(kubectl config view -o jsonpath='{.clusters[?(@.name=="prj-cus-78-cluster01")].cluster.server}')
    if [[ "$API_SERVER" == "https://103.165.142.57:6443" ]]; then
        check_pass "Correct API server endpoint"
    else
        check_warn "API server: $API_SERVER"
    fi
else
    check_fail "Cannot connect to Kubernetes cluster"
    check_fail "Please configure ~/.kube/config"
fi
echo ""

# 3. Docker registry
echo -e "${BLUE}[3/10]${NC} Checking Docker registry access..."
if docker info &>/dev/null; then
    check_pass "Docker daemon running"
    
    # Check if logged in (this is a rough check)
    if docker pull vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest &>/dev/null; then
        check_pass "Can pull from vcr.vnpaycloud.vn (logged in)"
    else
        check_warn "Cannot pull image - may need to login or image doesn't exist yet"
        check_warn "Run: docker login vcr.vnpaycloud.vn"
    fi
else
    check_fail "Docker daemon not running"
fi
echo ""

# 4. Required files
echo -e "${BLUE}[4/10]${NC} Checking required manifests..."
REQUIRED_FILES=(
    "namespace.yaml"
    "configmap.yaml"
    "pvc.yaml"
    "deployment.yaml"
    "service.yaml"
    "ingress.yaml"
    "kustomization.yaml"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        check_pass "$file exists"
    else
        check_fail "$file missing"
    fi
done
echo ""

# 5. Secret configuration
echo -e "${BLUE}[5/10]${NC} Checking secrets configuration..."
if [ -f "secret.yaml.template" ]; then
    check_pass "secret.yaml.template exists"
else
    check_fail "secret.yaml.template missing"
fi

if [ -f "secret.yaml" ]; then
    check_pass "secret.yaml exists"
    
    # Check for placeholder values
    if grep -q "your-secure-random-token-here" secret.yaml; then
        check_fail "secret.yaml contains placeholder token - needs to be updated"
    else
        check_pass "Gateway token configured"
    fi
    
    if grep -q "sk-ant-..." secret.yaml; then
        check_warn "Anthropic API key still placeholder - update if using Anthropic"
    else
        check_pass "Anthropic API key configured"
    fi
else
    check_fail "secret.yaml not created - copy from secret.yaml.template"
fi
echo ""

# 6. Scripts
echo -e "${BLUE}[6/10]${NC} Checking deployment scripts..."
if [ -f "build-push-script.sh" ]; then
    if [ -x "build-push-script.sh" ]; then
        check_pass "build-push-script.sh exists and is executable"
    else
        check_warn "build-push-script.sh exists but not executable"
        echo "         Run: chmod +x build-push-script.sh"
    fi
else
    check_fail "build-push-script.sh missing"
fi

if [ -f "deploy.sh" ]; then
    if [ -x "deploy.sh" ]; then
        check_pass "deploy.sh exists and is executable"
    else
        check_warn "deploy.sh exists but not executable"
        echo "         Run: chmod +x deploy.sh"
    fi
else
    check_fail "deploy.sh missing"
fi
echo ""

# 7. Deployment configuration
echo -e "${BLUE}[7/10]${NC} Checking deployment configuration..."
if grep -q "vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot" deployment.yaml; then
    check_pass "Correct registry URL in deployment.yaml"
else
    check_fail "Registry URL not configured in deployment.yaml"
fi

if grep -q "clawdbot.yourdomain.com" ingress.yaml; then
    check_warn "Domain still placeholder in ingress.yaml - needs update"
else
    check_pass "Custom domain configured in ingress.yaml"
fi
echo ""

# 8. Storage
echo -e "${BLUE}[8/10]${NC} Checking storage configuration..."
if kubectl get storageclass &>/dev/null; then
    STORAGE_CLASSES=$(kubectl get storageclass -o name | wc -l)
    check_pass "Cluster has $STORAGE_CLASSES StorageClass(es)"
    
    DEFAULT_SC=$(kubectl get storageclass -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
    if [ -n "$DEFAULT_SC" ]; then
        check_pass "Default StorageClass: $DEFAULT_SC"
    else
        check_warn "No default StorageClass - may need to specify in pvc.yaml"
    fi
else
    check_warn "Cannot check StorageClasses"
fi
echo ""

# 9. Ingress
echo -e "${BLUE}[9/10]${NC} Checking ingress controller..."
if kubectl get ingressclass &>/dev/null; then
    INGRESS_CLASSES=$(kubectl get ingressclass -o name | wc -l)
    check_pass "Cluster has $INGRESS_CLASSES IngressClass(es)"
    
    DEFAULT_IC=$(kubectl get ingressclass -o jsonpath='{.items[?(@.metadata.annotations.ingressclass\.kubernetes\.io/is-default-class=="true")].metadata.name}')
    if [ -n "$DEFAULT_IC" ]; then
        check_pass "Default IngressClass: $DEFAULT_IC"
    else
        check_warn "No default IngressClass - verify ingressClassName in ingress.yaml"
    fi
else
    check_warn "Cannot check IngressClasses"
fi
echo ""

# 10. Namespace
echo -e "${BLUE}[10/10]${NC} Checking namespace..."
if kubectl get namespace clawdbot &>/dev/null; then
    check_warn "Namespace 'clawdbot' already exists - deployment will update existing resources"
else
    check_pass "Namespace 'clawdbot' ready to be created"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Summary                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed:  $CHECKS_PASSED${NC}"
echo -e "  ${YELLOW}Warnings: $CHECKS_WARNING${NC}"
echo -e "  ${RED}Failed:  $CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "${RED}❌ Pre-deployment checks FAILED${NC}"
    echo "Please fix the issues above before deploying."
    exit 1
elif [ $CHECKS_WARNING -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Pre-deployment checks passed with WARNINGS${NC}"
    echo "Review warnings above before deploying."
    exit 0
else
    echo -e "${GREEN}✅ All pre-deployment checks PASSED${NC}"
    echo "Ready to deploy!"
    echo ""
    echo "Next step:"
    echo "  ./deploy.sh"
    exit 0
fi
