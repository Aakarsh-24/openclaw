#!/bin/bash
set -e

NAMESPACE="clawdbot"
KUBECONFIG_FILE="${KUBECONFIG:-$HOME/.kube/config}"

echo "🚀 Deploying Clawdbot to Kubernetes cluster..."
echo "Using kubeconfig: ${KUBECONFIG_FILE}"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl command not found. Please install kubectl first."
    exit 1
fi

# Check cluster connectivity
echo "Checking cluster connectivity..."
if ! kubectl cluster-info &> /dev/null; then
    echo "❌ Cannot connect to cluster. Please check your kubeconfig."
    exit 1
fi

echo "✅ Connected to cluster: $(kubectl config current-context)"

# Create namespace if not exists
echo "Creating namespace ${NAMESPACE}..."
kubectl apply -f namespace.yaml

# Apply manifests
echo "Applying ConfigMap..."
kubectl apply -f configmap.yaml

echo "Applying Secret..."
if [ -f secret.yaml ]; then
    kubectl apply -f secret.yaml
else
    echo "⚠️  Warning: secret.yaml not found. Please create it from secret.yaml.template"
    echo "   and apply manually with: kubectl apply -f secret.yaml"
fi

echo "Applying PersistentVolumeClaims..."
kubectl apply -f pvc.yaml

echo "Waiting for PVCs to be bound..."
kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/clawdbot-config-pvc -n ${NAMESPACE} --timeout=60s || true
kubectl wait --for=jsonpath='{.status.phase}'=Bound pvc/clawdbot-workspace-pvc -n ${NAMESPACE} --timeout=60s || true

echo "Applying Deployment..."
kubectl apply -f deployment.yaml

echo "Applying Service..."
kubectl apply -f service.yaml

echo "Applying Ingress..."
kubectl apply -f ingress.yaml

echo ""
echo "✅ Deployment completed!"
echo ""
echo "📊 Check deployment status:"
echo "   kubectl get all -n ${NAMESPACE}"
echo ""
echo "📝 View logs:"
echo "   kubectl logs -f deployment/clawdbot-gateway -n ${NAMESPACE}"
echo ""
echo "🌐 Access Control UI:"
echo "   http://clawdbot.yourdomain.com (sau khi cấu hình DNS)"
echo ""
echo "🔑 Get gateway token from secret:"
echo "   kubectl get secret clawdbot-secrets -n ${NAMESPACE} -o jsonpath='{.data.CLAWDBOT_GATEWAY_TOKEN}' | base64 -d"
echo ""
