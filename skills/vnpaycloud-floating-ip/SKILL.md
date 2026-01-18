---
name: terraform-floating-ip
description: Hướng dẫn tạo và gán Floating IP với Terraform Provider VNPayCloud. Sử dụng khi cần gán IP public cho server.
---

# Terraform - Floating IP VNPayCloud

## 1. Tạo Floating IP

### Resource: `vnpaycloud_networking_floatingip`

```hcl
resource "vnpaycloud_networking_floatingip" "public_ip" {
  pool = "Floating_VLAN_634"  # External network pool
}
```

## 2. Gán Floating IP cho Port

### Resource: `vnpaycloud_networking_floatingip_associate`

```hcl
resource "vnpaycloud_networking_floatingip" "public_ip" {
  pool = "Floating_VLAN_634"
}

resource "vnpaycloud_networking_floatingip_associate" "server_fip" {
  floating_ip = vnpaycloud_networking_floatingip.public_ip.address
  port_id     = vnpaycloud_networking_port.server_port.id
}
```

## Ví dụ hoàn chỉnh: Server với IP Public

```hcl
# 1. Network & Subnet
resource "vnpaycloud_networking_network" "main" {
  name           = "main-network"
  admin_state_up = true
}

resource "vnpaycloud_networking_subnet" "main" {
  name            = "main-subnet"
  network_id      = vnpaycloud_networking_network.main.id
  cidr            = "10.0.1.0/24"
  dns_nameservers = ["8.8.8.8"]
}

# 2. Port
resource "vnpaycloud_networking_port" "server_port" {
  name       = "server-port"
  network_id = vnpaycloud_networking_network.main.id
  
  fixed_ip {
    subnet_id = vnpaycloud_networking_subnet.main.id
  }
}

# 3. Volume
resource "vnpaycloud_volume" "boot_volume" {
  name        = "boot-volume"
  size        = 50
  image_id    = "IMAGE_ID"
  volume_type = "c1-standard"
}

# 4. Server
resource "vnpaycloud_server" "web_server" {
  name      = "web-server"
  flavor_id = "FLAVOR_ID"
  
  network {
    port = vnpaycloud_networking_port.server_port.id
  }
  
  block_device {
    uuid             = vnpaycloud_volume.boot_volume.id
    source_type      = "volume"
    destination_type = "volume"
    boot_index       = 0
  }
}

# 5. Floating IP
resource "vnpaycloud_networking_floatingip" "server_fip" {
  pool = "Floating_VLAN_634"
}

# 6. Associate Floating IP
resource "vnpaycloud_networking_floatingip_associate" "server_fip_assoc" {
  floating_ip = vnpaycloud_networking_floatingip.server_fip.address
  port_id     = vnpaycloud_networking_port.server_port.id
}

# Outputs
output "server_private_ip" {
  value = vnpaycloud_networking_port.server_port.fixed_ip[0].ip_address
}

output "server_public_ip" {
  value = vnpaycloud_networking_floatingip.server_fip.address
}
```

## Arguments Reference

### Floating IP

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `pool` | string | Tên external network pool | ✅ |
| `description` | string | Mô tả | ❌ |

### Floating IP Associate

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `floating_ip` | string | Địa chỉ floating IP | ✅ |
| `port_id` | string | ID của port cần gán | ✅ |

## Floating IP Pools

Các pool có sẵn (tùy region):
- `Floating_VLAN_634`
- `external`
- Liên hệ admin để biết thêm

## Tạo nhiều Floating IPs

```hcl
variable "server_count" {
  default = 3
}

resource "vnpaycloud_networking_floatingip" "fips" {
  count = var.server_count
  pool  = "Floating_VLAN_634"
}

resource "vnpaycloud_networking_floatingip_associate" "fip_assocs" {
  count       = var.server_count
  floating_ip = vnpaycloud_networking_floatingip.fips[count.index].address
  port_id     = vnpaycloud_networking_port.server_ports[count.index].id
}
```

## Outputs

```hcl
output "floating_ip_address" {
  description = "Public IP address"
  value       = vnpaycloud_networking_floatingip.server_fip.address
}

output "floating_ip_id" {
  description = "Floating IP ID"
  value       = vnpaycloud_networking_floatingip.server_fip.id
}
```

## Lưu ý

1. **Floating IP có phí** - Mỗi floating IP được tính phí theo giờ
2. **Gỡ trước khi xóa** - Phải disassociate trước khi delete floating IP
3. **Dependency** - Sử dụng `depends_on` nếu cần đảm bảo thứ tự tạo

```hcl
resource "vnpaycloud_networking_floatingip_associate" "server_fip" {
  floating_ip = vnpaycloud_networking_floatingip.public_ip.address
  port_id     = vnpaycloud_networking_port.server_port.id
  
  depends_on = [vnpaycloud_server.web_server]
}
```

## File tham khảo

- `examples/resources/vnpaycloud_networking_floatingip/`
- `examples/resources/vnpaycloud_networking_floatingip_associate/`
