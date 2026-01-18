# VNPay Cloud Container Registry - Quick Reference

## Registry Information

- **Registry URL**: `vcr.vnpaycloud.vn`
- **Project ID**: `286e18c6183846159c47575db4e3d831-clawdbot`
- **Namespace**: `clawdbot`
- **Full Image Path**: `vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:TAG`

## Bot Account (Automated Access)

A bot account has been created for automated push/pull access:

```
Username: bot$260115-jrfmoq-clawd
Password: d9KHfWfmk7wHEPHgWlsW7vmaDjsVpea0
```

**Permissions:**
- ✅ List, pull, push, delete repositories
- ✅ Read, list, delete artifacts
- ✅ Create, delete, list tags
- ✅ Create, stop scans

**⚠️ SECURITY NOTE:** These credentials are stored in `k8s/.env.registry` which is gitignored.

## Quick Login (Recommended)

### Using Helper Script

```bash
# Easy one-command login
cd /home/duhd/clawdbot/k8s
./registry-login.sh
```

This script:
- ✅ Loads credentials from `.env.registry`
- ✅ Validates all required variables
- ✅ Logs in to Docker registry
- ✅ Shows next steps

### Manual Login

```bash
# Login with bot account
docker login vcr.vnpaycloud.vn

# Hoặc với token
echo "YOUR_TOKEN" | docker login vcr.vnpaycloud.vn -u USERNAME --password-stdin
```

### Build và Push Image

```bash
# Sử dụng build script (recommended)
cd /home/duhd/clawdbot
./k8s/build-push-script.sh

# Hoặc manual:
# 1. Build image
docker build -t vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest .

# 2. Tag với version cụ thể (optional)
docker tag vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest \
           vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:v1.0.0

# 3. Push to registry
docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:v1.0.0
```

### Pull Image

```bash
docker pull vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
```

### List Images trong Registry

```bash
# Sử dụng crane tool (nếu có)
crane ls vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot

# Hoặc check qua web UI của VNPay Cloud
```

## Kubernetes Integration

### Create ImagePullSecret (nếu cần)

Nếu cluster không có sẵn credentials để pull image:

```bash
kubectl create secret docker-registry vcr-secret \
  --docker-server=vcr.vnpaycloud.vn \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD \
  --docker-email=YOUR_EMAIL \
  -n clawdbot
```

Sau đó uncomment trong `deployment.yaml`:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: vcr-secret
```

### Update Image trong Deployment

```bash
# Set new image tag
kubectl set image deployment/clawdbot-gateway \
  gateway=vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:v1.0.1 \
  -n clawdbot

# Hoặc edit trực tiếp
kubectl edit deployment clawdbot-gateway -n clawdbot

# Hoặc rollout restart để pull latest
kubectl rollout restart deployment/clawdbot-gateway -n clawdbot
```

## Helm Integration (Optional)

Nếu muốn package dưới dạng Helm chart:

### Create Helm Chart

```bash
cd k8s
helm create clawdbot-chart

# Copy manifests vào chart
cp *.yaml clawdbot-chart/templates/
```

### Package Helm Chart

```bash
helm package clawdbot-chart --version 1.0.0
```

### Push Helm Chart to Registry

```bash
helm push clawdbot-chart-1.0.0.tgz oci://vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot
```

### Install Helm Chart from Registry

```bash
helm install clawdbot oci://vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot-chart \
  --version 1.0.0 \
  --namespace clawdbot \
  --create-namespace
```

## CI/CD Integration

### GitLab CI Example

```yaml
build-and-push:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  before_script:
    - echo $VCR_PASSWORD | docker login vcr.vnpaycloud.vn -u $VCR_USERNAME --password-stdin
  script:
    - docker build -t vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:$CI_COMMIT_SHA .
    - docker tag vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:$CI_COMMIT_SHA \
                 vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
    - docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:$CI_COMMIT_SHA
    - docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
```

### GitHub Actions Example

```yaml
name: Build and Push

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Login to VCR
        run: echo "${{ secrets.VCR_PASSWORD }}" | docker login vcr.vnpaycloud.vn -u ${{ secrets.VCR_USERNAME }} --password-stdin
      
      - name: Build and Push
        run: |
          docker build -t vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:${{ github.sha }} .
          docker tag vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:${{ github.sha }} \
                     vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
          docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:${{ github.sha }}
          docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
```

## Troubleshooting

### Cannot login to registry

```bash
# Check credentials
docker login vcr.vnpaycloud.vn

# Check saved credentials
cat ~/.docker/config.json

# Clear and re-login
docker logout vcr.vnpaycloud.vn
docker login vcr.vnpaycloud.vn
```

### Image push denied

```bash
# Verify project ID
# Project phải là: 286e18c6183846159c47575db4e3d831-clawdbot

# Check permissions với VNPay Cloud admin
```

### ImagePullBackOff trong Kubernetes

```bash
# Check image pull secret
kubectl get secret -n clawdbot

# Recreate image pull secret
kubectl delete secret vcr-secret -n clawdbot
kubectl create secret docker-registry vcr-secret \
  --docker-server=vcr.vnpaycloud.vn \
  --docker-username=YOUR_USERNAME \
  --docker-password=YOUR_PASSWORD \
  -n clawdbot

# Check pod events
kubectl describe pod -n clawdbot -l app=clawdbot
```

### Verify image exists

```bash
# Pull image manually để test
docker pull vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest

# Check image layers
docker image inspect vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
```

## Best Practices

1. **Tag với version cụ thể** thay vì chỉ dùng `latest`:
   ```bash
   TAG=v1.0.0 ./k8s/build-push-script.sh
   ```

2. **Push cả version tag và latest tag**:
   ```bash
   docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:v1.0.0
   docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
   ```

3. **Sử dụng build arguments** để customize build:
   ```bash
   docker build \
     --build-arg CLAWDBOT_DOCKER_APT_PACKAGES="ffmpeg git" \
     -t vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest .
   ```

4. **Multi-arch builds** (nếu cần):
   ```bash
   docker buildx build \
     --platform linux/amd64,linux/arm64 \
     -t vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest \
     --push .
   ```

5. **Scan image trước khi push**:
   ```bash
   docker scan vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
   ```
