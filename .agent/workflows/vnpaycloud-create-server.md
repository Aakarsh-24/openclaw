---
name: terraform-create-server
description: Hướng dẫn tạo Server (VM) với Terraform Provider VNPayCloud. Sử dụng khi cần tạo máy chủ ảo.
---

# Terraform - Tạo Server VNPayCloud

## Resource: `vnpaycloud_server`

### Tạo Server cơ bản

```hcl
# Tạo Volume từ Image
resource "vnpaycloud_volume" "boot_volume" {
  name                 = "my-boot-volume"
  size                 = 50
  image_id             = "IMAGE_ID"  # Ubuntu, CentOS, Windows...
  volume_type          = "c1-standard"
  enable_online_resize = true
}

# Tạo Port
resource "vnpaycloud_networking_port" "server_port" {
  name       = "my-server-port"
  network_id = "NETWORK_ID"
  
  fixed_ip {
    subnet_id  = "SUBNET_ID"
    ip_address = "10.0.1.10"
  }
}

# Tạo Server
resource "vnpaycloud_server" "my_server" {
  name       = "my-server"
  flavor_id  = "FLAVOR_ID"
  admin_pass = "YourSecurePassword123!"
  
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
```

### Tạo Server với Keypair

```hcl
# Tạo SSH Keypair
resource "vnpaycloud_compute_keypair" "my_keypair" {
  name = "my-keypair"
}

# Tạo Server với Keypair
resource "vnpaycloud_server" "my_server" {
  name       = "my-server"
  flavor_id  = "FLAVOR_ID"
  key_pair   = vnpaycloud_compute_keypair.my_keypair.name
  admin_pass = "YourSecurePassword123!"
  
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

# Output private key
output "private_key" {
  value     = vnpaycloud_compute_keypair.my_keypair.private_key
  sensitive = true
}
```

### Tạo Server với User Data (Cloud-Init)

```hcl
resource "vnpaycloud_server" "web_server" {
  name       = "web-server"
  flavor_id  = "FLAVOR_ID"
  admin_pass = "YourPassword123!"
  user_data  = file("${path.module}/cloud-init.sh")
  
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
```

**cloud-init.sh**:

```bash
#!/bin/bash
apt-get update
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
```

### Tạo Server trong Server Group (Anti-Affinity)

```hcl
# Tạo Server Group
resource "vnpaycloud_compute_server_group" "web_group" {
  name     = "web-server-group"
  policies = ["soft-anti-affinity"]
}

# Tạo Server trong group
resource "vnpaycloud_server" "web_server" {
  name            = "web-server-1"
  flavor_id       = "FLAVOR_ID"
  security_groups = ["default"]
  
  scheduler_hints {
    group = vnpaycloud_compute_server_group.web_group.id
  }
  
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
```

## Arguments

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `name` | string | Tên server (unique) | ✅ |
| `flavor_id` | string | ID của flavor | ✅ |
| `network` | block | Cấu hình network | ✅ |
| `block_device` | block | Cấu hình volume | ✅ |
| `key_pair` | string | Tên keypair | ❌ |
| `admin_pass` | string | Password root/admin | ❌ |
| `user_data` | string | Cloud-init script | ❌ |
| `security_groups` | list | Danh sách security groups | ❌ |
| `scheduler_hints` | block | Scheduler hints (server group) | ❌ |

## Block Device Arguments

| Argument | Type | Mô tả |
|----------|------|-------|
| `uuid` | string | ID của volume hoặc image |
| `source_type` | string | `volume` hoặc `image` |
| `destination_type` | string | `volume` |
| `boot_index` | number | `0` = boot volume |

## Server Group Policies

| Policy | Mô tả |
|--------|-------|
| `affinity` | Đặt servers trên cùng host |
| `anti-affinity` | Đặt servers trên khác host (strict) |
| `soft-anti-affinity` | Ưu tiên khác host, không bắt buộc |
| `soft-affinity` | Ưu tiên cùng host, không bắt buộc |

## Outputs

```hcl
output "server_id" {
  value = vnpaycloud_server.my_server.id
}

output "server_ip" {
  value = vnpaycloud_networking_port.server_port.fixed_ip[0].ip_address
}
```

## Ví dụ hoàn chỉnh

Xem thêm tại: `plugin/terraform-provider-vnpaycloud/examples/resources/vnpaycloud_compute_server/resource.tf`
