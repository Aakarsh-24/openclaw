---
name: terraform-create-volume
description: Hướng dẫn tạo Volume với Terraform Provider VNPayCloud. Sử dụng khi cần tạo ổ đĩa block storage.
---

# Terraform - Tạo Volume VNPayCloud

## Resource: `vnpaycloud_volume` / `vnpaycloud_blockstorage_volume`

### Tạo Volume trống

```hcl
resource "vnpaycloud_blockstorage_volume" "data_volume" {
  name                 = "my-data-volume"
  description          = "Data volume for application"
  size                 = 100
  volume_type          = "c1-standard"
  enable_online_resize = true
}
```

### Tạo Volume từ Image (Bootable)

```hcl
resource "vnpaycloud_volume" "boot_volume" {
  name                 = "ubuntu-boot-volume"
  size                 = 50
  image_id             = "IMAGE_ID"  # Ubuntu, CentOS, Windows image
  volume_type          = "c1-standard"
  enable_online_resize = true
}
```

### Tạo Volume với Tags

```hcl
resource "vnpaycloud_blockstorage_volume" "tagged_volume" {
  name                 = "tagged-volume"
  size                 = 50
  volume_type          = "c1-standard"
  enable_online_resize = true
  
  metadata = {
    environment = "production"
    project     = "web-app"
  }
}
```

## Arguments

| Argument | Type | Mô tả | Required |
|----------|------|-------|----------|
| `name` | string | Tên volume | ✅ |
| `size` | number | Kích thước (GB), max 2047 | ✅ |
| `volume_type` | string | Loại volume | ✅ |
| `description` | string | Mô tả | ❌ |
| `image_id` | string | ID image (tạo bootable) | ❌ |
| `snapshot_id` | string | ID snapshot | ❌ |
| `source_vol_id` | string | ID volume nguồn (clone) | ❌ |
| `enable_online_resize` | bool | Cho phép resize online | ❌ |
| `metadata` | map | Metadata/tags | ❌ |

## Volume Types

| Type | Mô tả | IOPS |
|------|-------|------|
| `c1-standard` | SSD tiêu chuẩn | 2000 IOPS |
| `c1-premium` | SSD cao cấp | 3000 IOPS |
| `c1-ultra` | SSD siêu nhanh | 5000 IOPS |

## Outputs

```hcl
output "volume_id" {
  value = vnpaycloud_blockstorage_volume.data_volume.id
}

output "volume_status" {
  value = vnpaycloud_blockstorage_volume.data_volume.status
}
```

## Gắn Volume vào Server

```hcl
# Boot volume - gắn khi tạo server
resource "vnpaycloud_server" "my_server" {
  name      = "my-server"
  flavor_id = "FLAVOR_ID"
  
  network {
    port = vnpaycloud_networking_port.server_port.id
  }
  
  # Boot volume
  block_device {
    uuid             = vnpaycloud_volume.boot_volume.id
    source_type      = "volume"
    destination_type = "volume"
    boot_index       = 0
  }
  
  # Data volume (attached)
  block_device {
    uuid             = vnpaycloud_blockstorage_volume.data_volume.id
    source_type      = "volume"
    destination_type = "volume"
    boot_index       = -1  # -1 = data volume, not boot
  }
}
```

## Ví dụ: Tạo nhiều Volumes

```hcl
variable "volume_configs" {
  default = {
    "data-1" = { size = 100, type = "c1-standard" }
    "data-2" = { size = 200, type = "c1-premium" }
    "backup" = { size = 500, type = "c1-standard" }
  }
}

resource "vnpaycloud_blockstorage_volume" "volumes" {
  for_each = var.volume_configs
  
  name                 = each.key
  size                 = each.value.size
  volume_type          = each.value.type
  enable_online_resize = true
}
```

## Lifecycle

```hcl
resource "vnpaycloud_blockstorage_volume" "important_data" {
  name        = "important-data"
  size        = 100
  volume_type = "c1-standard"
  
  lifecycle {
    prevent_destroy = true  # Ngăn xóa nhầm
  }
}
```

## File tham khảo

- Example: `plugin/terraform-provider-vnpaycloud/examples/resources/vnpaycloud_blockstorage_volume/resource.tf`
- Resource code: `plugin/terraform-provider-vnpaycloud/vnpaycloud/volume/`
