# Clawdbot Kaas Deployment - Quick Reference Card

## 🚀 Deployment Flow

```
1. Preflight Check  →  2. Build Image  →  3. Create Secrets  →  4. Deploy  →  5. Configure DNS
```

## 📋 One-Line Commands

### Quick Start (Interactive)
```bash
cd /home/duhd/clawdbot/k8s && ./quickstart.sh
```

### Preflight Check
```bash
cd /home/duhd/clawdbot/k8s && ./preflight-check.sh
```

### Manual Deployment
```bash
# 1. Login registry
docker login vcr.vnpaycloud.vn

# 2. Build & push
./k8s/build-push-script.sh

# 3. Create secrets
cd k8s && cp secret.yaml.template secret.yaml && vim secret.yaml

# 4. Deploy
./k8s/deploy.sh
```

## 🔑 Essential Info

**Registry:**
- URL: `vcr.vnpaycloud.vn`
- Project: `286e18c6183846159c47575db4e3d831-clawdbot`
- Image: `vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest`

**Cluster:**
- Name: `prj-cus-78-cluster01`
- API: `https://103.165.142.57:6443`
- Context: `prj-cus-78-cluster01-admin@prj-cus-78-cluster01`

**Namespace:** `clawdbot`

## 🛠️ Common Operations

### Check Status
```bash
kubectl get all -n clawdbot
kubectl get pods -n clawdbot -w
kubectl describe pod -n clawdbot -l app=clawdbot
```

### View Logs
```bash
kubectl logs -f deployment/clawdbot-gateway -n clawdbot
kubectl logs --tail=100 deployment/clawdbot-gateway -n clawdbot
```

### Get Gateway Token
```bash
kubectl get secret clawdbot-secrets -n clawdbot \
  -o jsonpath='{.data.CLAWDBOT_GATEWAY_TOKEN}' | base64 -d && echo
```

### Update Image
```bash
# Build new
TAG=v1.0.1 ./k8s/build-push-script.sh

# Deploy new version
kubectl set image deployment/clawdbot-gateway \
  gateway=vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:v1.0.1 \
  -n clawdbot

# Or restart with latest
kubectl rollout restart deployment/clawdbot-gateway -n clawdbot
```

### Exec into Pod
```bash
kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- /bin/bash
```

### Port Forward (Local Testing)
```bash
kubectl port-forward -n clawdbot service/clawdbot-gateway 18789:18789
# Access: http://localhost:18789
```

## 🔧 Troubleshooting Quick Fixes

### Pod Not Starting
```bash
kubectl describe pod -n clawdbot -l app=clawdbot
kubectl get events -n clawdbot --sort-by='.lastTimestamp'
```

### Image Pull Error
```bash
# Check/recreate imagePullSecret
kubectl create secret docker-registry vcr-secret \
  --docker-server=vcr.vnpaycloud.vn \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD \
  -n clawdbot

# Uncomment imagePullSecrets in deployment.yaml
```

### PVC Not Bound
```bash
kubectl get pvc -n clawdbot
kubectl describe pvc -n clawdbot
kubectl get storageclass
```

### Restart Everything
```bash
kubectl rollout restart deployment/clawdbot-gateway -n clawdbot
```

## 📁 File Locations

```
/home/duhd/clawdbot/k8s/
├── quickstart.sh          # Interactive deployment wizard
├── preflight-check.sh     # Pre-deployment validation
├── build-push-script.sh   # Build & push Docker image
├── deploy.sh              # Deploy to Kubernetes
├── README.md              # Full documentation
├── REGISTRY.md            # Registry guide
├── namespace.yaml         # Kubernetes manifests
├── configmap.yaml
├── secret.yaml.template   # Template for secrets
├── pvc.yaml
├── deployment.yaml
├── service.yaml
├── ingress.yaml
└── kustomization.yaml
```

## 🎯 Post-Deployment

1. **Get Ingress IP:**
   ```bash
   kubectl get ingress -n clawdbot -o wide
   ```

2. **Configure DNS:**
   - Update domain in `ingress.yaml`
   - Create A record: `clawdbot.yourdomain.com → INGRESS_IP`
   - Apply: `kubectl apply -f k8s/ingress.yaml`

3. **Access Control UI:**
   - URL: `https://clawdbot.yourdomain.com`
   - Token: Get from secret (command above)

4. **Configure Channels:**
   - WhatsApp: `kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- node dist/index.js channels login`
   - Telegram: Update `TELEGRAM_BOT_TOKEN` in secret
   - Discord: Update `DISCORD_BOT_TOKEN` in secret

## 📞 Support

- Full Docs: [k8s/README.md](./README.md)
- Registry: [k8s/REGISTRY.md](./REGISTRY.md)
- Official: https://docs.clawd.bot
- GitHub: https://github.com/clawdbot/clawdbot

---
**Generated:** 2026-01-15
