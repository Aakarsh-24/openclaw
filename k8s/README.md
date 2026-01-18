# Clawdbot Kubernetes Deployment

Hướng dẫn deploy Clawdbot lên Kaas private cluster của VNPay Cloud.

## Prerequisites

- `kubectl` đã cài đặt và cấu hình
- Kubeconfig file để kết nối cluster (`prj-cus-78-cluster01`)
- Docker để build image
- Access vào container registry
- API keys cho Anthropic/OpenAI

## Quick Start

### 1. Build & Push Docker Image

```bash
cd /home/duhd/clawdbot

# Update registry info trong build-push-script.sh
vim k8s/build-push-script.sh

# Build và push image
chmod +x k8s/build-push-script.sh
./k8s/build-push-script.sh
```

### 2. Cấu hình Kubeconfig

Bạn đã có kubeconfig với OIDC authentication. Lưu vào vị trí chuẩn:

```bash
# Backup kubeconfig cũ (nếu có)
[ -f ~/.kube/config ] && cp ~/.kube/config ~/.kube/config.backup

# Tạo kubeconfig mới
mkdir -p ~/.kube
cat > ~/.kube/config << 'EOF'
# Paste OIDC kubeconfig content here
EOF

# Hoặc với admin kubeconfig (có certificate-data)
cat > ~/.kube/config << 'EOF'
# Paste admin kubeconfig content here
EOF

# Set permissions
chmod 600 ~/.kube/config

# Test connection
kubectl cluster-info
kubectl get nodes
```

### 3. Tạo Secrets

```bash
cd k8s

# Tạo từ template
cp secret.yaml.template secret.yaml

# Edit và điền thông tin thực
vim secret.yaml
# Hoặc dùng editor khác: nano, code, etc.

# Apply secret
kubectl apply -f secret.yaml

# Verify
kubectl get secret clawdbot-secrets -n clawdbot
```

**Hoặc tạo bằng command**:

```bash
# Generate secure token
TOKEN=$(openssl rand -base64 32)

# Create secret
kubectl create secret generic clawdbot-secrets \
  --from-literal=CLAWDBOT_GATEWAY_TOKEN="${TOKEN}" \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-your-key-here" \
  --from-literal=OPENAI_API_KEY="" \
  --from-literal=TELEGRAM_BOT_TOKEN="" \
  --from-literal=DISCORD_BOT_TOKEN="" \
  --from-literal=SLACK_BOT_TOKEN="" \
  --from-literal=SLACK_APP_TOKEN="" \
  --from-literal=CLAUDE_AI_SESSION_KEY="" \
  --from-literal=CLAUDE_WEB_SESSION_KEY="" \
  --from-literal=CLAUDE_WEB_COOKIE="" \
  -n clawdbot --dry-run=client -o yaml | kubectl apply -f -

# Save token for later use
echo "Gateway Token: ${TOKEN}"
```

### 4. Cập nhật Configurations

```bash
# Update image URL trong deployment.yaml
vim deployment.yaml
# Thay: image: your-registry.com/clawdbot/clawdbot:latest

# Update domain trong ingress.yaml
vim ingress.yaml
# Thay: host: clawdbot.yourdomain.com

# Kiểm tra StorageClass (nếu cần)
kubectl get storageclass
# Nếu cần, uncomment và set storageClassName trong pvc.yaml

# Kiểm tra IngressClass
kubectl get ingressclass
# Update ingressClassName trong ingress.yaml nếu cần
```

### 5. Deploy

```bash
cd k8s

# Make deploy script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

**Hoặc apply từng file thủ công**:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml
kubectl apply -f pvc.yaml
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f ingress.yaml
```

**Hoặc dùng Kustomize**:

```bash
# Uncomment secret.yaml trong kustomization.yaml trước
kubectl apply -k .
```

### 6. Verify Deployment

```bash
# Check all resources
kubectl get all -n clawdbot

# Check pods (đợi Running)
kubectl get pods -n clawdbot -w

# View logs
kubectl logs -f deployment/clawdbot-gateway -n clawdbot

# Check PVCs
kubectl get pvc -n clawdbot

# Check ingress
kubectl get ingress -n clawdbot -o wide
```

### 7. Cấu hình DNS & Access

```bash
# 1. Lấy Ingress LoadBalancer IP/Hostname
kubectl get ingress clawdbot-ingress -n clawdbot -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
# Hoặc
kubectl get ingress clawdbot-ingress -n clawdbot -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# 2. Cấu hình DNS A record
# clawdbot.yourdomain.com -> <INGRESS_IP>

# 3. Lấy gateway token
kubectl get secret clawdbot-secrets -n clawdbot \
  -o jsonpath='{.data.CLAWDBOT_GATEWAY_TOKEN}' | base64 -d
echo  # Newline

# 4. Truy cập Control UI
# https://clawdbot.x.vnshop.cloud
# Login với token từ bước 3
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Ingress (HTTPS/WSS)                │
│        clawdbot.x.vnshop.cloud                  │
└─────────────────┬───────────────────────────────┘
                  │
          ┌───────▼────────┐
          │    Service     │
          │  ClusterIP     │
          │  :18789, :18790│
          └───────┬────────┘
                  │
      ┌───────────▼──────────────┐
      │      Deployment          │
      │  clawdbot-gateway        │
      │      (1 replica)         │
      └──────────────────────────┘
              │         │
         ┌────▼───┐  ┌─▼────┐
         │ Config │  │ Work │
         │  PVC   │  │ PVC  │
         │  5Gi   │  │ 20Gi │
         └────────┘  └──────┘
```

## Cluster Information

- **Cluster**: `prj-cus-78-cluster01`
- **API Server**: `https://103.165.142.57:6443`
- **Context**: `prj-cus-78-cluster01-admin@prj-cus-78-cluster01` (admin) hoặc `oidc@prj-cus-78-cluster01` (OIDC)
- **Namespace**: `clawdbot`

## Maintenance

### Update Image

```bash
# Build và push new image
./k8s/build-push-script.sh

# Update deployment
kubectl set image deployment/clawdbot-gateway gateway=your-registry.com/clawdbot/clawdbot:new-tag -n clawdbot

# Hoặc rollout restart
kubectl rollout restart deployment/clawdbot-gateway -n clawdbot

# Check rollout status
kubectl rollout status deployment/clawdbot-gateway -n clawdbot

# View rollout history
kubectl rollout history deployment/clawdbot-gateway -n clawdbot
```

### View Logs

```bash
# Follow logs
kubectl logs -f deployment/clawdbot-gateway -n clawdbot

# Last 100 lines
kubectl logs --tail=100 deployment/clawdbot-gateway -n clawdbot

# Previous pod logs (if crashed)
kubectl logs deployment/clawdbot-gateway -n clawdbot --previous

# Logs from specific pod
POD=$(kubectl get pod -n clawdbot -l app=clawdbot -o jsonpath='{.items[0].metadata.name}')
kubectl logs -f ${POD} -n clawdbot
```

### Exec into Pod

```bash
# Interactive shell
kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- /bin/bash

# Run clawdbot CLI commands
kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- \
  node dist/index.js --help

# Check config
kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- \
  cat /home/node/.clawdbot/clawdbot.json

# List workspace
kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- \
  ls -la /home/node/clawd
```

### Update Configuration

```bash
# Edit ConfigMap
kubectl edit configmap clawdbot-config -n clawdbot

# Hoặc update file và apply
vim configmap.yaml
kubectl apply -f configmap.yaml

# Restart để load config mới
kubectl rollout restart deployment/clawdbot-gateway -n clawdbot
```

### Update Secrets

```bash
# Edit Secret
kubectl edit secret clawdbot-secrets -n clawdbot

# Hoặc patch
kubectl patch secret clawdbot-secrets -n clawdbot \
  --type='json' -p='[{"op":"replace","path":"/data/ANTHROPIC_API_KEY","value":"'$(echo -n "sk-ant-new-key" | base64)'"}]'

# Restart để load secret mới
kubectl rollout restart deployment/clawdbot-gateway -n clawdbot
```

### Backup Config & Workspace

```bash
# Get pod name
POD=$(kubectl get pod -n clawdbot -l app=clawdbot -o jsonpath='{.items[0].metadata.name}')

# Backup config
mkdir -p ./backups
kubectl cp clawdbot/${POD}:/home/node/.clawdbot ./backups/config-$(date +%Y%m%d)

# Backup workspace
kubectl cp clawdbot/${POD}:/home/node/clawd ./backups/workspace-$(date +%Y%m%d)

# Verify backup
ls -lh ./backups/
```

### Restore from Backup

```bash
# Get pod name
POD=$(kubectl get pod -n clawdbot -l app=clawdbot -o jsonpath='{.items[0].metadata.name}')

# Restore config
kubectl cp ./backups/config-20260115 clawdbot/${POD}:/home/node/.clawdbot

# Restore workspace
kubectl cp ./backups/workspace-20260115 clawdbot/${POD}:/home/node/clawd

# Restart pod
kubectl delete pod ${POD} -n clawdbot
```

### Scale Down/Up

```bash
# Scale down (maintenance)
kubectl scale deployment/clawdbot-gateway -n clawdbot --replicas=0

# Verify
kubectl get pods -n clawdbot

# Scale up
kubectl scale deployment/clawdbot-gateway -n clawdbot --replicas=1

# Verify
kubectl get pods -n clawdbot -w
```

### Delete Deployment

```bash
# Delete all resources in namespace
kubectl delete namespace clawdbot

# Or delete individual resources
kubectl delete -f ingress.yaml
kubectl delete -f service.yaml
kubectl delete -f deployment.yaml
kubectl delete -f pvc.yaml  # Warning: This deletes data!
kubectl delete -f configmap.yaml
kubectl delete -f secret.yaml
kubectl delete -f namespace.yaml
```

## Troubleshooting

### Pod không start

```bash
# Describe pod để xem events
kubectl describe pod -n clawdbot -l app=clawdbot

# Check pod events
kubectl get events -n clawdbot --sort-by='.lastTimestamp'

# Check pod status
kubectl get pods -n clawdbot -o wide

# View init container logs
POD=$(kubectl get pod -n clawdbot -l app=clawdbot -o jsonpath='{.items[0].metadata.name}')
kubectl logs ${POD} -n clawdbot -c config-init
```

### Image pull errors

```bash
# Check image pull secrets
kubectl get secret -n clawdbot

# Create registry secret
kubectl create secret docker-registry registry-secret \
  --docker-server=your-registry.com \
  --docker-username=your-username \
  --docker-password=your-password \
  --docker-email=your-email@example.com \
  -n clawdbot

# Update deployment để sử dụng imagePullSecret
# Uncomment imagePullSecrets section trong deployment.yaml
```

### PVC không bound

```bash
# Check PVC status
kubectl get pvc -n clawdbot

# Check available StorageClasses
kubectl get storageclass

# Describe PVC để xem lỗi
kubectl describe pvc clawdbot-config-pvc -n clawdbot
kubectl describe pvc clawdbot-workspace-pvc -n clawdbot

# Check PersistentVolumes
kubectl get pv
```

### Ingress không hoạt động

```bash
# Check ingress controller
kubectl get deployments -A | grep ingress

# Check ingress status
kubectl describe ingress clawdbot-ingress -n clawdbot

# Check service endpoints
kubectl get endpoints clawdbot-gateway -n clawdbot

# Check ingress class
kubectl get ingressclass

# Test service directly (port-forward)
kubectl port-forward -n clawdbot service/clawdbot-gateway 18789:18789
# Then access http://localhost:18789
```

### Pod crashes hoặc CrashLoopBackOff

```bash
# View logs từ previous container
POD=$(kubectl get pod -n clawdbot -l app=clawdbot -o jsonpath='{.items[0].metadata.name}')
kubectl logs ${POD} -n clawdbot --previous

# Check resource limits
kubectl describe pod ${POD} -n clawdbot | grep -A 5 "Limits"

# Check liveness/readiness probes
kubectl describe pod ${POD} -n clawdbot | grep -A 10 "Liveness"
```

### WebSocket connection issues

```bash
# Check ingress annotations
kubectl get ingress clawdbot-ingress -n clawdbot -o yaml | grep -A 20 annotations

# Test WebSocket (cần wscat)
wscat -c ws://clawdbot.yourdomain.com/ws

# Check nginx ingress logs (nếu dùng nginx)
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller --tail=100
```

### Permission errors

```bash
# Check pod security context
POD=$(kubectl get pod -n clawdbot -l app=clawdbot -o jsonpath='{.items[0].metadata.name}')
kubectl get pod ${POD} -n clawdbot -o yaml | grep -A 10 securityContext

# Check volume permissions
kubectl exec ${POD} -n clawdbot -- ls -la /home/node/.clawdbot
kubectl exec ${POD} -n clawdbot -- ls -la /home/node/clawd

# Fix permissions (if needed)
kubectl exec ${POD} -n clawdbot -- chown -R 1000:1000 /home/node/.clawdbot
kubectl exec ${POD} -n clawdbot -- chown -R 1000:1000 /home/node/clawd
```

## Security

### Network Policies (Optional)

Tạo NetworkPolicy để hạn chế traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: clawdbot-netpol
  namespace: clawdbot
spec:
  podSelector:
    matchLabels:
      app: clawdbot
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx  # Adjust based on your ingress namespace
    ports:
    - protocol: TCP
      port: 18789
    - protocol: TCP
      port: 18790
  egress:
  - {}  # Allow all egress (Clawdbot cần access external APIs)
```

### Pod Security Standards

Namespace đã được configured với minimal security context. Để tăng cường:

```bash
# Add security labels to namespace
kubectl label namespace clawdbot pod-security.kubernetes.io/enforce=baseline
kubectl label namespace clawdbot pod-security.kubernetes.io/audit=restricted
kubectl label namespace clawdbot pod-security.kubernetes.io/warn=restricted
```

## Advanced

### Horizontal Pod Autoscaler (Not Recommended)

Clawdbot là single-user assistant, không nên scale horizontally. Nhưng nếu cần:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: clawdbot-hpa
  namespace: clawdbot
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: clawdbot-gateway
  minReplicas: 1
  maxReplicas: 1  # Keep at 1 for single-user
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 80
```

### Resource Quotas

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: clawdbot-quota
  namespace: clawdbot
spec:
  hard:
    requests.cpu: "2"
    requests.memory: "4Gi"
    limits.cpu: "4"
    limits.memory: "8Gi"
    persistentvolumeclaims: "5"
```

### Monitoring với Prometheus (Optional)

Nếu cluster có Prometheus:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: clawdbot-metrics
  namespace: clawdbot
  labels:
    app: clawdbot
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "18789"
    prometheus.io/path: "/metrics"
spec:
  selector:
    app: clawdbot
  ports:
  - name: metrics
    port: 18789
```

## Support

Nếu gặp vấn đề:

1. Check logs: `kubectl logs -f deployment/clawdbot-gateway -n clawdbot`
2. Check events: `kubectl get events -n clawdbot --sort-by='.lastTimestamp'`
3. Describe resources: `kubectl describe pod/deployment/service -n clawdbot`
4. Reference official docs: https://docs.clawd.bot
5. GitHub issues: https://github.com/clawdbot/clawdbot/issues
