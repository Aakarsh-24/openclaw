# HTTPS/TLS Setup Guide for Clawdbot

## 🔒 Current Status

**TLS Configuration**: Enabled in `ingress.yaml` ✅  
**cert-manager**: ❌ Not installed  
**Ingress Controller**: ❌ Not installed  
**HTTPS Access**: ❌ Not available yet

## ⚠️ Requirements

To enable HTTPS with the current configuration, you need:

1. **Nginx Ingress Controller** (to handle Ingress resources)
2. **cert-manager** (to automatically obtain Let's Encrypt certificates)

---

## 🚀 Option 1: Full HTTPS Setup (Recommended)

### Prerequisites
- Cluster admin access
- Helm installed
- Domain DNS pointing to cluster IP (✅ Already done: clawdbot.x.vnshop.cloud → 103.165.142.57)

### Step 1: Install Nginx Ingress Controller

```bash
# Add Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install Nginx Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.externalIPs[0]=103.165.142.57

# Wait for deployment
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s

# Verify
kubectl get pods -n ingress-nginx
kubectl get service -n ingress-nginx
```

### Step 2: Install cert-manager

```bash
# Install cert-manager CRDs
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Wait for cert-manager to be ready
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=120s

# Verify
kubectl get pods -n cert-manager
```

### Step 3: Create Let's Encrypt ClusterIssuer

```bash
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: duhd@vnpay.vn  # CHANGE THIS
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### Step 4: Apply Ingress (Already done!)

Your ingress.yaml is already configured correctly! ✅

```bash
# Verify ingress
kubectl get ingress -n clawdbot
kubectl describe ingress clawdbot-ingress -n clawdbot
```

### Step 5: Wait for Certificate

```bash
# Check certificate status
kubectl get certificate -n clawdbot
kubectl describe certificate clawdbot-tls -n clawdbot

# Check cert-manager logs if issues
kubectl logs -n cert-manager -l app=cert-manager

# Certificate should be ready in 1-5 minutes
kubectl wait --namespace clawdbot \
  --for=condition=ready certificate/clawdbot-tls \
  --timeout=300s
```

### Step 6: Access via HTTPS

```
https://clawdbot.x.vnshop.cloud
```

Token: `mK8vL9xN3qR7sT2wY6zB4cF5gH1jM0pA8dE9fG2hI3=`

---

## 🔧 Option 2: Reverse Proxy with HTTPS (Alternative)

If you can't install Ingress Controller/cert-manager, use a reverse proxy:

### Setup nginx on edge server

```nginx
# /etc/nginx/sites-available/clawdbot
server {
    listen 80;
    server_name clawdbot.x.vnshop.cloud;
    
    # Redirect to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name clawdbot.x.vnshop.cloud;
    
    # SSL certificate (from Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/clawdbot.x.vnshop.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/clawdbot.x.vnshop.cloud/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://103.165.142.57:30789;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-lived connections
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

### Get certificate with certbot

```bash
# On edge server
sudo certbot --nginx -d clawdbot.x.vnshop.cloud
```

Then access: `https://clawdbot.x.vnshop.cloud` (no port needed!)

---

## 🎯 Option 3: Keep HTTP with NodePort (Current Working)

Continue using what works now:

```
http://clawdbot.x.vnshop.cloud:30789
```

Pros:
- ✅ Works immediately
- ✅ No additional setup needed
- ✅ Simple and reliable

Cons:
- ❌ No encryption (HTTP)
- ❌ Port in URL
- ❌ Browser warnings for "not secure"

---

## 📋 Quick Install Script

Save this as `k8s/install-https.sh`:

```bash
#!/bin/bash
set -e

echo "🔒 Installing HTTPS support for Clawdbot"
echo "========================================"
echo ""

# Check if running as script or manual
read -p "Enter your email for Let's Encrypt: " EMAIL

if [ -z "$EMAIL" ]; then
  echo "Error: Email required"
  exit 1
fi

echo ""
echo "Step 1: Installing Nginx Ingress Controller..."
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer \
  --set controller.service.externalIPs[0]=103.165.142.57

echo ""
echo "Step 2: Installing cert-manager..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

echo ""
echo "Waiting for cert-manager pods..."
sleep 30
kubectl wait --namespace cert-manager \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/instance=cert-manager \
  --timeout=120s

echo ""
echo "Step 3: Creating Let's Encrypt ClusterIssuer..."
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

echo ""
echo "Step 4: Applying Ingress..."
kubectl apply -f k8s/ingress.yaml

echo ""
echo "✅ HTTPS setup initiated!"
echo ""
echo "Wait 2-5 minutes for certificate to be issued."
echo "Check status:"
echo "  kubectl get certificate -n clawdbot"
echo "  kubectl describe certificate clawdbot-tls -n clawdbot"
echo ""
echo "Once ready, access at:"
echo "  https://clawdbot.x.vnshop.cloud"
echo ""
```

---

## 🔍 Troubleshooting

### Certificate not issuing

```bash
# Check certificate status
kubectl describe certificate clawdbot-tls -n clawdbot

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager

# Check challenges
kubectl get challenges -n clawdbot

# Common issues:
# 1. DNS not pointing to correct IP
# 2. Port 80 not accessible (needed for HTTP-01 challenge)
# 3. Rate limit from Let's Encrypt (wait 1 hour)
```

### Ingress not getting IP

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/component=controller

# Check service
kubectl get service -n ingress-nginx
```

### SSL certificate invalid

```bash
# Force renewal
kubectl delete certificate clawdbot-tls -n clawdbot
kubectl apply -f k8s/ingress.yaml

# Or use staging first
# Change server to: https://acme-staging-v02.api.letsencrypt.org/directory
```

---

## 📊 Current vs Future State

### Current (Working)
```
http://clawdbot.x.vnshop.cloud:30789
- Type: HTTP (no encryption)
- Port: Required (30789)
- Access: NodePort
- Status: ✅ Working
```

### After HTTPS Setup
```
https://clawdbot.x.vnshop.cloud
- Type: HTTPS (encrypted)
- Port: Not needed
- Access: Ingress
- Certificate: Let's Encrypt (auto-renewed)
- Status: Production ready
```

---

## 🎯 Recommended Action

**For Testing/Development**: Keep using NodePort
```
http://clawdbot.x.vnshop.cloud:30789
```

**For Production**: Contact VNPay admin to install:
1. Nginx Ingress Controller
2. cert-manager

Or use reverse proxy option if you have an edge server.

---

## 💡 Summary

Your ingress.yaml is **already configured correctly** for HTTPS! ✅

What's needed:
1. Install Ingress Controller (cluster-wide, needs admin)
2. Install cert-manager (cluster-wide, needs admin)
3. Wait for certificate (automatic, 2-5 minutes)

Then HTTPS will work automatically!

Current working URL: `http://clawdbot.x.vnshop.cloud:30789`  
Future HTTPS URL: `https://clawdbot.x.vnshop.cloud`
