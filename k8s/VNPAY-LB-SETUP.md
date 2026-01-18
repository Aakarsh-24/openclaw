# VNPay Cloud Load Balancer Setup Guide

## 🎯 Current Status

**Internal LoadBalancer**: `172.16.2.190` (created by Kubernetes)  
**Target External IP**: `103.165.142.159` (public facing)  
**Ingress NodePorts**: 30286 (HTTP), 30777 (HTTPS)

---

## 📋 VNPay Cloud Portal Configuration

### Option 1: Configure Existing External LB

If External LB `103.165.142.159` already exists:

1. **Navigate to**: VNPay Cloud Portal → Load Balancing
2. **Select**: Load Balancer with IP `103.165.142.159`
3. **Configure Listeners**:

#### HTTP Listener (Port 80)
```
Protocol: TCP
Port: 80
Pool: Create new pool
  - Name: k8s-ingress-http
  - Protocol: TCP
  - Method: ROUND_ROBIN
```

**Pool Member**:
```
IP Address: 172.16.2.190
Port: 80
Weight: 1
```

**Health Monitor**:
```
Type: TCP
Delay: 5s
Timeout: 3s
Max Retries: 3
```

#### HTTPS Listener (Port 443)
```
Protocol: TCP
Port: 443
Pool: Create new pool
  - Name: k8s-ingress-https
  - Protocol: TCP
  - Method: ROUND_ROBIN
```

**Pool Member**:
```
IP Address: 172.16.2.190
Port: 443
Weight: 1
```

**Health Monitor**:
```
Type: TCP
Delay: 5s
Timeout: 3s
Max Retries: 3
```

---

### Option 2: Create New External LB with Terraform

Use the `vnpaycloud-load-balancer` skill to create via Terraform.

**Prerequisites**:
```bash
# Need VNPay Cloud credentials
export OS_AUTH_URL=https://authz.cloud.vnpaycloud.vn/v3
export OS_APPLICATION_CREDENTIAL_ID=<your-id>
export OS_APPLICATION_CREDENTIAL_SECRET=<your-secret>
```

**Terraform Configuration** (`load-balancer.tf`):

```hcl
# Load Balancer
resource "vnpaycloud_lb_loadbalancer" "clawdbot_external" {
  name          = "clawdbot-external-lb"
  description   = "External LB for Clawdbot Kubernetes Ingress"
  vip_subnet_id = "<YOUR_SUBNET_ID>"  # Public subnet
}

# HTTP Listener
resource "vnpaycloud_lb_listener" "http" {
  name            = "clawdbot-http"
  loadbalancer_id = vnpaycloud_lb_loadbalancer.clawdbot_external.id
  protocol        = "TCP"
  protocol_port   = 80
  allowed_cidrs   = ["0.0.0.0/0"]
}

# HTTPS Listener
resource "vnpaycloud_lb_listener" "https" {
  name            = "clawdbot-https"
  loadbalancer_id = vnpaycloud_lb_loadbalancer.clawdbot_external.id
  protocol        = "TCP"
  protocol_port   = 443
  allowed_cidrs   = ["0.0.0.0/0"]
}

# HTTP Pool
resource "vnpaycloud_lb_pool" "http" {
  name        = "clawdbot-http-pool"
  listener_id = vnpaycloud_lb_listener.http.id
  protocol    = "TCP"
  lb_method   = "ROUND_ROBIN"
}

# HTTPS Pool
resource "vnpaycloud_lb_pool" "https" {
  name        = "clawdbot-https-pool"
  listener_id = vnpaycloud_lb_listener.https.id
  protocol    = "TCP"
  lb_method   = "ROUND_ROBIN"
}

# HTTP Member - Internal LB
resource "vnpaycloud_lb_member" "http_ingress" {
  name          = "k8s-ingress-lb"
  pool_id       = vnpaycloud_lb_pool.http.id
  address       = "172.16.2.190"
  protocol_port = 80
  weight        = 1
  subnet_id     = "<INTERNAL_SUBNET_ID>"
}

# HTTPS Member - Internal LB
resource "vnpaycloud_lb_member" "https_ingress" {
  name          = "k8s-ingress-lb"
  pool_id       = vnpaycloud_lb_pool.https.id
  address       = "172.16.2.190"
  protocol_port = 443
  weight        = 1
  subnet_id     = "<INTERNAL_SUBNET_ID>"
}

# HTTP Health Monitor
resource "vnpaycloud_lb_monitor" "http" {
  name             = "http-tcp-check"
  pool_id          = vnpaycloud_lb_pool.http.id
  type             = "TCP"
  delay            = 5
  timeout          = 3
  max_retries      = 3
  max_retries_down = 3
}

# HTTPS Health Monitor
resource "vnpaycloud_lb_monitor" "https" {
  name             = "https-tcp-check"
  pool_id          = vnpaycloud_lb_pool.https.id
  type             = "TCP"
  delay            = 5
  timeout          = 3
  max_retries      = 3
  max_retries_down = 3
}

# Outputs
output "external_lb_ip" {
  value       = vnpaycloud_lb_loadbalancer.clawdbot_external.vip_address
  description = "External LoadBalancer VIP"
}
```

**Deploy**:
```bash
terraform init
terraform plan
terraform apply
```

---

## 🧪 Verification

After configuration, test:

```bash
# Test HTTP
curl -I http://clawdbot.x.vnshop.cloud

# Test HTTPS (after certificate issues)
curl -I https://clawdbot.x.vnshop.cloud
```

---

## 📊 Expected Flow

```
User Request
     ↓
DNS: clawdbot.x.vnshop.cloud → 103.165.142.159
     ↓
VNPay External LB: 103.165.142.159
     ↓
Forward to: 172.16.2.190:80/443
     ↓
Kubernetes LoadBalancer Service
     ↓
Nginx Ingress Controller Pod
     ↓
Clawdbot Gateway Service: 18789
     ↓
Clawdbot Gateway Pod
```

---

## ⚠️ Current Issue

**Kubernetes LoadBalancer stuck at `<pending>`**:
- VNPay Cloud quota exceeded for floating IPs
- Cannot auto-create LoadBalancer

**Solution**: Manual configuration via portal or Terraform as described above.

---

## 🔧 Alternative: Use NodePort Directly

If LoadBalancer quota is limited:

```bash
# Change to NodePort
kubectl patch svc ingress-nginx-controller -n ingress-nginx \
  -p '{"spec":{"type":"NodePort"}}'
```

Configure external LB to forward to **worker node IPs** on **NodePorts**:
- Workers: `172.16.2.180`, `172.16.2.132`
- HTTP NodePort: `30286`
- HTTPS NodePort: `30777`

---

## 📞 Support

Need VNPay Cloud access:
- Portal: https://cloud.vnpaycloud.vn
- Subnet IDs from Network section
- IAM credentials for Terraform
