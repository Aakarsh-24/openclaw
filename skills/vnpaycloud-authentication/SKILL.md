---
name: terraform-provider-vnpaycloud
description: Hướng dẫn cấu hình Terraform Provider VNPayCloud. Sử dụng khi cần setup provider, authentication cho Terraform.
---

# Terraform Provider VNPayCloud - Authentication

## Provider Configuration

### Cấu hình cơ bản

```hcl
terraform {
  required_providers {
    vnpaycloud = {
      source  = "registry.terraform.io/vnpaycloud-console/vnpaycloud"
      version = "~> 1.0"
    }
  }
}

provider "vnpaycloud" {
  auth_url                      = "https://auth-hcm.infiniband.vn/v3"
  application_credential_id     = "YOUR_APP_CREDENTIAL_ID"
  application_credential_secret = "YOUR_APP_CREDENTIAL_SECRET"
}
```

### Sử dụng biến môi trường

```hcl
provider "vnpaycloud" {
  auth_url                      = var.auth_url
  application_credential_id     = var.app_credential_id
  application_credential_secret = var.app_credential_secret
}
```

**variables.tf**:

```hcl
variable "auth_url" {
  description = "VNPayCloud Auth URL"
  type        = string
  default     = "https://auth-hcm.infiniband.vn/v3"
}

variable "app_credential_id" {
  description = "Application Credential ID"
  type        = string
  sensitive   = true
}

variable "app_credential_secret" {
  description = "Application Credential Secret"
  type        = string
  sensitive   = true
}
```

### Sử dụng Environment Variables

```bash
export TF_VAR_app_credential_id="your-app-credential-id"
export TF_VAR_app_credential_secret="your-app-credential-secret"
```

## Regions

| Region | Auth URL |
|--------|----------|
| HCM | `https://auth-hcm.infiniband.vn/v3` |
| HNI | `https://auth-hni.infiniband.vn/v3` |

## Tạo Application Credential

1. Đăng nhập **VNPayCloud Portal**
2. Vào **Account Settings** → **Application Credentials**
3. Click **Create Application Credential**
4. Lưu lại `ID` và `Secret` (secret chỉ hiển thị 1 lần)

## Local Development

Để test provider locally, tạo file `~/.terraformrc`:

```hcl
provider_installation {
  dev_overrides {
    "registry.terraform.io/vnpaycloud-console/vnpaycloud" = "/path/to/go/bin"
  }
}
```

## Khởi tạo Terraform

```bash
# Khởi tạo provider
terraform init

# Validate cấu hình
terraform validate

# Xem plan
terraform plan

# Apply
terraform apply
```

## Resources có sẵn

| Resource | Mô tả |
|----------|-------|
| `vnpaycloud_server` | Virtual Machine |
| `vnpaycloud_volume` | Block Storage Volume |
| `vnpaycloud_networking_vpc` | VPC |
| `vnpaycloud_networking_network` | Network |
| `vnpaycloud_networking_subnet` | Subnet |
| `vnpaycloud_networking_port` | Port |
| `vnpaycloud_networking_floatingip` | Floating IP |
| `vnpaycloud_networking_secgroup` | Security Group |
| `vnpaycloud_networking_secgroup_rule` | Security Group Rule |
| `vnpaycloud_lb_loadbalancer` | Load Balancer |
| `vnpaycloud_lb_listener` | LB Listener |
| `vnpaycloud_lb_pool` | LB Pool |
| `vnpaycloud_lb_member` | LB Member |
| `vnpaycloud_lb_monitor` | Health Monitor |
| `vnpaycloud_compute_keypair` | SSH Key Pair |
| `vnpaycloud_compute_server_group` | Server Group |

## Data Sources có sẵn

| Data Source | Mô tả |
|-------------|-------|
| `vnpaycloud_server` | Lấy thông tin server |
| `vnpaycloud_blockstorage_volume` | Lấy thông tin volume |
| `vnpaycloud_vpc` | Lấy thông tin VPC |
