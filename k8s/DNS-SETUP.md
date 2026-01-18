# DNS Setup Guide - Clawdbot on Kaas

## ⚠️ Issue: No Ingress Controller

Cluster `prj-cus-78-cluster01` không có Ingress Controller installed.

**Hiện trạng:**
- ❌ IngressClass: Not found
- ❌ Ingress Controller pods: None  
- ❌ LoadBalancer IP: Not assigned

## 🔧 Solutions

### Option 1: Port Forward (Quick Test)

**Use case**: Testing, development, temporary access

```bash
# Forward port to local machine
kubectl port-forward -n clawdbot service/clawdbot-gateway 18789:18789

# Access at:
http://localhost:18789

# Login with token:
mK8vL9xN3qR7sT2wY6zB4cF5gH1jM0pA8dE9fG2hI3=
```

**Pros:**
- ✅ Nhanh, dễ setup
- ✅ Không cần config gì thêm
- ✅ Hoạt động ngay

**Cons:**
- ❌ Chỉ local access
- ❌ Cần keep terminal running
- ❌ Không có HTTPS
- ❌ Không public

---

### Option 2: NodePort Service (Recommended)

**Use case**: Internal access, stable connection

#### Step 1: Change Service to NodePort

```bash
# Edit service
kubectl edit service clawdbot-gateway -n clawdbot

# Change:
#   type: ClusterIP
# To:
#   type: NodePort
```

Or apply this file:

```yaml
# k8s/service-nodeport.yaml
apiVersion: v1
kind: Service
metadata:
  name: clawdbot-gateway
  namespace: clawdbot
spec:
  type: NodePort  # Changed from ClusterIP
  selector:
    app: clawdbot
    component: gateway
  ports:
  - name: gateway
    port: 18789
    targetPort: 18789
    nodePort: 30789  # Fixed port (optional)
    protocol: TCP
```

```bash
kubectl apply -f k8s/service-nodeport.yaml
```

#### Step 2: Get Node IP

```bash
# Get node external IP
kubectl get nodes -o wide

# Example output:
# NAME         STATUS   ROLES    EXTERNAL-IP      INTERNAL-IP
# node-1       Ready    worker   103.165.142.58   172.16.2.153
```

#### Step 3: Get NodePort

```bash
kubectl get service clawdbot-gateway -n clawdbot

# Example output:
# NAME               TYPE       CLUSTER-IP     PORT(S)
# clawdbot-gateway   NodePort   10.43.94.214   18789:30789/TCP
```

Port `30789` is your NodePort.

#### Step 4: Setup DNS

**A Record:**
```
clawdbot.yourdomain.com  →  103.165.142.58  (Node IP)
```

#### Step 5: Access

```
http://103.165.142.58:30789
# Or after DNS:
http://clawdbot.yourdomain.com:30789
```

**Pros:**
- ✅ Stable connection
- ✅ Can be accessed from anywhere (if node IP is public)
- ✅ No port-forward needed

**Cons:**
- ❌ Need to specify port in URL
- ❌ No automatic HTTPS
- ❌ Exposes on all nodes

---

### Option 3: Install Nginx Ingress Controller

**Use case**: Production, proper HTTPS, clean URLs

#### Step 1: Install Nginx Ingress

```bash
# Add Helm repo (if not added)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install Nginx Ingress
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

#### Step 2: Wait for LoadBalancer IP

```bash
kubectl get service -n ingress-nginx

# Wait until EXTERNAL-IP is assigned
# NAME                    TYPE           EXTERNAL-IP
# ingress-nginx-controller LoadBalancer  103.165.142.100
```

#### Step 3: Update DNS

```
clawdbot.yourdomain.com  →  103.165.142.100
```

#### Step 4: Update Ingress hostname

```bash
# Edit k8s/ingress.yaml
vim k8s/ingress.yaml

# Change:
#   host: clawdbot.yourdomain.com
# To your actual domain

# Apply
kubectl apply -f k8s/ingress.yaml
```

#### Step 5: Access

```
http://clawdbot.yourdomain.com
```

**Pros:**
- ✅ Clean URLs (no port)
- ✅ Can add HTTPS/TLS
- ✅ Professional setup
- ✅ Can host multiple services

**Cons:**
- ❌ Requires admin access
- ❌ More complex setup
- ❌ May need LoadBalancer support from cloud

---

### Option 4: Contact VNPay Cloud Admin

**Request:**
1. Install Nginx Ingress Controller
2. Provide LoadBalancer IP pool
3. Setup DNS wildcard (*.clawdbot.vnpay.vn)
4. SSL certificate for HTTPS

---

## 🎯 Quick Commands

### Check Current Setup

```bash
# Check service type
kubectl get service clawdbot-gateway -n clawdbot

# Check ingress status
kubectl get ingress -n clawdbot

# Check if Ingress Controller exists
kubectl get pods -A | grep ingress

# Get node IPs
kubectl get nodes -o wide
```

### Port Forward (Immediate Access)

```bash
# Start port forward (keep running)
kubectl port-forward -n clawdbot service/clawdbot-gateway 18789:18789

# In another terminal, test:
curl http://localhost:18789

# Or open in browser:
# http://localhost:18789
```

### NodePort Quick Setup

```bash
# Patch service to NodePort
kubectl patch service clawdbot-gateway -n clawdbot \
  -p '{"spec":{"type":"NodePort"}}'

# Get assigned port
kubectl get service clawdbot-gateway -n clawdbot \
  -o jsonpath='{.spec.ports[0].nodePort}'

# Get node IP
kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}'

# Access:
# http://<NODE_IP>:<NODE_PORT>
```

---

## 📋 Recommended Path

For VNPay Kaas cluster:

1. **Now (Testing)**: Use Port Forward
   ```bash
   kubectl port-forward -n clawdbot service/clawdbot-gateway 18789:18789
   ```

2. **Short-term**: Switch to NodePort
   - Apply nodeport service
   - Get node IP
   - Setup internal DNS

3. **Long-term**: Contact VNPay admin
   - Request Ingress Controller
   - Get proper domain
   - Add SSL certificate

---

## 🔒 HTTPS/TLS Setup

Once you have Ingress working:

### With cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@vnpay.vn
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Update ingress annotations
# Add:
#   cert-manager.io/cluster-issuer: "letsencrypt-prod"
# Add tls section in ingress.yaml
```

---

## 💡 Current Token

```
Gateway Token: mK8vL9xN3qR7sT2wY6zB4cF5gH1jM0pA8dE9fG2hI3=
```

Use this to login to Control UI once you have access.

---

## ❓ Which Option Should You Choose?

| Option | Best For | Difficulty | Production Ready |
|--------|----------|------------|------------------|
| Port Forward | Quick test | ⭐ Easy | ❌ No |
| NodePort | Internal access | ⭐⭐ Medium | ⚠️ Partial |
| Ingress + LB | Production | ⭐⭐⭐ Hard | ✅ Yes |
| Contact Admin | Enterprise | ⭐ Easy | ✅ Yes |

**My recommendation for you**: Start with **Port Forward** to test, then contact VNPay admin for proper **Ingress Controller** setup.
