#!/bin/bash
# Install HTTPS support for Clawdbot
# Requires: cluster admin access, helm

set -e

echo "🔒 Installing HTTPS support for Clawdbot"
echo "========================================"
echo ""

# Validate prerequisites
if ! command -v helm &> /dev/null; then
    echo "❌ Error: helm not found. Please install helm first."
    exit 1
fi

if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Error: Cannot connect to cluster"
    exit 1
fi

# Get email
read -p "Enter your email for Let's Encrypt certificates: " EMAIL

if [ -z "$EMAIL" ]; then
  echo "❌ Error: Email required for Let's Encrypt"
  exit 1
fi

echo ""
echo "Configuration:"
echo "  Email: $EMAIL"
echo "  Domain: clawdbot.x.vnshop.cloud"
echo "  Cluster IP: 103.165.142.57"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1/4: Installing Nginx Ingress Controller..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx 2>/dev/null || true
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.externalIPs[0]=103.165.142.57 \
  --wait

echo "✅ Nginx Ingress Controller installed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2/4: Installing cert-manager..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

echo "Waiting for cert-manager to be ready..."
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=180s

echo "✅ cert-manager installed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3/4: Creating Let's Encrypt ClusterIssuer..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $EMAIL
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

echo "✅ ClusterIssuer created"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4/4: Applying Ingress with TLS..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
kubectl apply -f k8s/ingress.yaml

echo "✅ Ingress applied"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎉 HTTPS setup complete!"
echo ""
echo "⏳ Waiting for Let's Encrypt certificate (2-5 minutes)..."
echo ""
echo "Monitor certificate status:"
echo "  kubectl get certificate -n clawdbot"
echo "  kubectl describe certificate clawdbot-tls -n clawdbot"
echo ""
echo "Once ready (READY=True), access at:"
echo "  https://clawdbot.x.vnshop.cloud"
echo ""
echo "Token: mK8vL9xN3qR7sT2wY6zB4cF5gH1jM0pA8dE9fG2hI3="
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
