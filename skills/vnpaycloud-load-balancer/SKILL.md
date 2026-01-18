---
name: terraform-load-balancer
description: Hướng dẫn tạo Load Balancer với Terraform Provider VNPayCloud. Sử dụng khi cần cân bằng tải cho nhiều server.
---

# Terraform - Load Balancer VNPayCloud

## Kiến trúc Load Balancer

```
Load Balancer (vnpaycloud_lb_loadbalancer)
    └── Listener (vnpaycloud_lb_listener)
        └── Pool (vnpaycloud_lb_pool)
            ├── Members (vnpaycloud_lb_member)
            └── Monitor (vnpaycloud_lb_monitor)
```

## 1. Tạo Load Balancer

### Resource: `vnpaycloud_lb_loadbalancer`

```hcl
resource "vnpaycloud_lb_loadbalancer" "web_lb" {
  name          = "web-loadbalancer"
  description   = "Load balancer for web servers"
  vip_subnet_id = vnpaycloud_networking_subnet.main.id
  flavor_id     = "LB_FLAVOR_ID"  # Optional
}
```

## 2. Tạo Listener

### Resource: `vnpaycloud_lb_listener`

```hcl
# HTTP Listener
resource "vnpaycloud_lb_listener" "http" {
  name            = "http-listener"
  loadbalancer_id = vnpaycloud_lb_loadbalancer.web_lb.id
  protocol        = "HTTP"
  protocol_port   = 80
  allowed_cidrs   = ["0.0.0.0/0"]
}

# TCP Listener
resource "vnpaycloud_lb_listener" "tcp" {
  name            = "tcp-listener"
  loadbalancer_id = vnpaycloud_lb_loadbalancer.web_lb.id
  protocol        = "TCP"
  protocol_port   = 9000
  allowed_cidrs   = ["0.0.0.0/0"]
}
```

## 3. Tạo Pool

### Resource: `vnpaycloud_lb_pool`

```hcl
resource "vnpaycloud_lb_pool" "web_pool" {
  name        = "web-pool"
  listener_id = vnpaycloud_lb_listener.http.id
  protocol    = "HTTP"
  lb_method   = "ROUND_ROBIN"
}
```

### Load Balancing Methods

| Method | Mô tả |
|--------|-------|
| `ROUND_ROBIN` | Phân phối đều |
| `LEAST_CONNECTIONS` | Server ít kết nối nhất |
| `SOURCE_IP` | Dựa trên IP nguồn |

## 4. Tạo Members (Backend Servers)

### Resource: `vnpaycloud_lb_member`

```hcl
resource "vnpaycloud_lb_member" "web_server_1" {
  name          = "web-server-1"
  pool_id       = vnpaycloud_lb_pool.web_pool.id
  address       = "10.0.1.10"
  protocol_port = 80
  weight        = 1
  subnet_id     = vnpaycloud_networking_subnet.main.id
}

resource "vnpaycloud_lb_member" "web_server_2" {
  name          = "web-server-2"
  pool_id       = vnpaycloud_lb_pool.web_pool.id
  address       = "10.0.1.11"
  protocol_port = 80
  weight        = 1
  subnet_id     = vnpaycloud_networking_subnet.main.id
}
```

## 5. Tạo Health Monitor

### Resource: `vnpaycloud_lb_monitor`

```hcl
# TCP Health Check
resource "vnpaycloud_lb_monitor" "tcp_monitor" {
  name             = "tcp-monitor"
  pool_id          = vnpaycloud_lb_pool.web_pool.id
  type             = "TCP"
  delay            = 5
  timeout          = 3
  max_retries      = 3
  max_retries_down = 3
}

# HTTP Health Check
resource "vnpaycloud_lb_monitor" "http_monitor" {
  name             = "http-monitor"
  pool_id          = vnpaycloud_lb_pool.web_pool.id
  type             = "HTTP"
  delay            = 5
  timeout          = 3
  max_retries      = 3
  max_retries_down = 3
  http_method      = "GET"
  url_path         = "/health"
  expected_codes   = "200"
}
```

## Ví dụ hoàn chỉnh

```hcl
# Network
resource "vnpaycloud_networking_subnet" "lb_subnet" {
  name       = "lb-subnet"
  network_id = vnpaycloud_networking_network.main.id
  cidr       = "10.0.1.0/24"
}

# Load Balancer
resource "vnpaycloud_lb_loadbalancer" "main" {
  name          = "main-lb"
  vip_subnet_id = vnpaycloud_networking_subnet.lb_subnet.id
}

# Listener
resource "vnpaycloud_lb_listener" "http" {
  name            = "http-listener"
  loadbalancer_id = vnpaycloud_lb_loadbalancer.main.id
  protocol        = "HTTP"
  protocol_port   = 80
}

# Pool
resource "vnpaycloud_lb_pool" "web" {
  name        = "web-pool"
  listener_id = vnpaycloud_lb_listener.http.id
  protocol    = "HTTP"
  lb_method   = "ROUND_ROBIN"
}

# Members
resource "vnpaycloud_lb_member" "servers" {
  count         = 3
  name          = "web-server-${count.index + 1}"
  pool_id       = vnpaycloud_lb_pool.web.id
  address       = "10.0.1.${10 + count.index}"
  protocol_port = 80
  subnet_id     = vnpaycloud_networking_subnet.lb_subnet.id
}

# Health Monitor
resource "vnpaycloud_lb_monitor" "http" {
  name        = "http-monitor"
  pool_id     = vnpaycloud_lb_pool.web.id
  type        = "HTTP"
  delay       = 5
  timeout     = 3
  max_retries = 3
  url_path    = "/"
}

# Outputs
output "lb_vip_address" {
  value = vnpaycloud_lb_loadbalancer.main.vip_address
}
```

## Arguments Reference

### Load Balancer

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `name` | string | Tên LB | ✅ |
| `vip_subnet_id` | string | Subnet cho VIP | ✅ |
| `flavor_id` | string | LB flavor | ❌ |
| `description` | string | Mô tả | ❌ |

### Listener

| Argument | Type | Mô tả |
|----------|------|-------|
| `loadbalancer_id` | string | ID của LB |
| `protocol` | string | HTTP, HTTPS, TCP, UDP |
| `protocol_port` | number | Port lắng nghe |
| `allowed_cidrs` | list | CIDR được phép |

### Pool

| Argument | Type | Mô tả |
|----------|------|-------|
| `listener_id` | string | ID của listener |
| `protocol` | string | HTTP, HTTPS, TCP |
| `lb_method` | string | ROUND_ROBIN, LEAST_CONNECTIONS, SOURCE_IP |

### Member

| Argument | Type | Mô tả |
|----------|------|-------|
| `pool_id` | string | ID của pool |
| `address` | string | IP backend server |
| `protocol_port` | number | Port backend |
| `weight` | number | Weight (1-256) |
| `subnet_id` | string | Subnet ID |

### Monitor

| Argument | Type | Mô tả |
|----------|------|-------|
| `pool_id` | string | ID của pool |
| `type` | string | TCP, HTTP, HTTPS, PING |
| `delay` | number | Interval (giây) |
| `timeout` | number | Timeout (giây) |
| `max_retries` | number | Số lần retry |

## File tham khảo

- `examples/resources/vnpaycloud_lb_loadbalancer/`
- `examples/resources/vnpaycloud_lb_listener/`
- `examples/resources/vnpaycloud_lb_pool/`
- `examples/resources/vnpaycloud_lb_member/`
- `examples/resources/vnpaycloud_lb_monitor/`
