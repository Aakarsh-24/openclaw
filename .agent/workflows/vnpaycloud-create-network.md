---
name: terraform-create-network
description: Hướng dẫn tạo VPC, Network, Subnet, Port với Terraform Provider VNPayCloud. Sử dụng khi cần thiết lập hạ tầng mạng.
---

# Terraform - Tạo Network VNPayCloud

## 1. Tạo VPC

### Resource: `vnpaycloud_networking_vpc`

```hcl
resource "vnpaycloud_networking_vpc" "main_vpc" {
  name       = "main-vpc"
  cidr_block = "10.0.0.0/16"
}
```

## 2. Tạo Network

### Resource: `vnpaycloud_networking_network`

```hcl
resource "vnpaycloud_networking_network" "private_network" {
  name           = "private-network"
  description    = "Private network for application"
  admin_state_up = true
  shared         = false
}
```

## 3. Tạo Subnet

### Resource: `vnpaycloud_networking_subnet`

```hcl
resource "vnpaycloud_networking_subnet" "app_subnet" {
  name            = "app-subnet"
  network_id      = vnpaycloud_networking_network.private_network.id
  vpc_id          = vnpaycloud_networking_vpc.main_vpc.id
  cidr            = "10.0.1.0/24"
  description     = "Application subnet"
  dns_nameservers = ["8.8.8.8", "8.8.4.4"]
}
```

## 4. Tạo Port

### Resource: `vnpaycloud_networking_port`

```hcl
resource "vnpaycloud_networking_port" "server_port" {
  name        = "server-port"
  network_id  = vnpaycloud_networking_network.private_network.id
  description = "Port for server"
  virtual_ip  = false
  
  fixed_ip {
    subnet_id  = vnpaycloud_networking_subnet.app_subnet.id
    ip_address = "10.0.1.10"
  }
}
```

### Tạo Port không chỉ định IP (auto assign)

```hcl
resource "vnpaycloud_networking_port" "auto_port" {
  name       = "auto-port"
  network_id = vnpaycloud_networking_network.private_network.id
  
  fixed_ip {
    subnet_id = vnpaycloud_networking_subnet.app_subnet.id
  }
}
```

## 5. Tạo Security Group

### Resource: `vnpaycloud_networking_secgroup`

```hcl
resource "vnpaycloud_networking_secgroup" "web_sg" {
  name        = "web-security-group"
  description = "Security group for web servers"
}
```

### Resource: `vnpaycloud_networking_secgroup_rule`

```hcl
# Allow SSH
resource "vnpaycloud_networking_secgroup_rule" "ssh" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 22
  port_range_max    = 22
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vnpaycloud_networking_secgroup.web_sg.id
}

# Allow HTTP
resource "vnpaycloud_networking_secgroup_rule" "http" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 80
  port_range_max    = 80
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vnpaycloud_networking_secgroup.web_sg.id
}

# Allow HTTPS
resource "vnpaycloud_networking_secgroup_rule" "https" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "tcp"
  port_range_min    = 443
  port_range_max    = 443
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vnpaycloud_networking_secgroup.web_sg.id
}

# Allow ICMP (ping)
resource "vnpaycloud_networking_secgroup_rule" "icmp" {
  direction         = "ingress"
  ethertype         = "IPv4"
  protocol          = "icmp"
  remote_ip_prefix  = "0.0.0.0/0"
  security_group_id = vnpaycloud_networking_secgroup.web_sg.id
}
```

## Ví dụ hoàn chỉnh: Tạo hạ tầng mạng

```hcl
# VPC
resource "vnpaycloud_networking_vpc" "main" {
  name       = "production-vpc"
  cidr_block = "10.0.0.0/16"
}

# Network
resource "vnpaycloud_networking_network" "main" {
  name           = "production-network"
  admin_state_up = true
}

# Subnets
resource "vnpaycloud_networking_subnet" "web" {
  name            = "web-subnet"
  network_id      = vnpaycloud_networking_network.main.id
  vpc_id          = vnpaycloud_networking_vpc.main.id
  cidr            = "10.0.1.0/24"
  dns_nameservers = ["8.8.8.8"]
}

resource "vnpaycloud_networking_subnet" "app" {
  name            = "app-subnet"
  network_id      = vnpaycloud_networking_network.main.id
  vpc_id          = vnpaycloud_networking_vpc.main.id
  cidr            = "10.0.2.0/24"
  dns_nameservers = ["8.8.8.8"]
}

resource "vnpaycloud_networking_subnet" "db" {
  name            = "db-subnet"
  network_id      = vnpaycloud_networking_network.main.id
  vpc_id          = vnpaycloud_networking_vpc.main.id
  cidr            = "10.0.3.0/24"
  dns_nameservers = ["8.8.8.8"]
}

# Security Groups
resource "vnpaycloud_networking_secgroup" "web" {
  name        = "web-sg"
  description = "Web tier security group"
}

resource "vnpaycloud_networking_secgroup" "app" {
  name        = "app-sg"
  description = "App tier security group"
}

resource "vnpaycloud_networking_secgroup" "db" {
  name        = "db-sg"
  description = "Database tier security group"
}
```

## Arguments Reference

### VPC

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `name` | string | Tên VPC | ✅ |
| `cidr_block` | string | CIDR block (VD: 10.0.0.0/16) | ✅ |

### Network

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `name` | string | Tên network | ✅ |
| `admin_state_up` | bool | Enable/disable | ❌ |
| `shared` | bool | Shared network | ❌ |

### Subnet

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `network_id` | string | ID của network | ✅ |
| `cidr` | string | CIDR của subnet | ✅ |
| `vpc_id` | string | ID của VPC | ❌ |
| `dns_nameservers` | list | DNS servers | ❌ |

### Security Group Rule

| Argument | Type | Mô tả |
|----------|------|-------|
| `direction` | string | `ingress` hoặc `egress` |
| `ethertype` | string | `IPv4` hoặc `IPv6` |
| `protocol` | string | `tcp`, `udp`, `icmp` |
| `port_range_min` | number | Port bắt đầu |
| `port_range_max` | number | Port kết thúc |
| `remote_ip_prefix` | string | CIDR source |

## File tham khảo

- VPC: `examples/resources/vnpaycloud_networking_vpc/`
- Network: `examples/resources/vnpaycloud_networking_network/`
- Subnet: `examples/resources/vnpaycloud_networking_subnet/`
- Port: `examples/resources/vnpaycloud_networking_port/`
- Security Group: `examples/resources/vnpaycloud_networking_secgroup/`
