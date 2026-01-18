# Registry Credentials Setup - Quick Guide

## 🔑 Credentials Available

Registry bot account credentials đã được tạo sẵn trong file `.env.registry`:

```
vcr.vnpaycloud.vn
Username: bot$260115-jrfmoq-clawd
Password: d9KHfWfmk7wHEPHgWlsW7vmaDjsVpea0
```

## 🚀 Quick Start

### Option 1: Use Helper Script (Easiest)

```bash
cd /home/duhd/clawdbot/k8s
./registry-login.sh
```

### Option 2: Manual Docker Login

```bash
docker login vcr.vnpaycloud.vn
# Username: bot$260115-jrfmoq-clawd
# Password: d9KHfWfmk7wHEPHgWlsW7vmaDjsVpea0
```

### Option 3: Automated Login (for scripts)

```bash
echo "d9KHfWfmk7wHEPHgWlsW7vmaDjsVpea0" | \
  docker login vcr.vnpaycloud.vn \
  -u "bot\$260115-jrfmoq-clawd" \
  --password-stdin
```

## 🐳 After Login - Build & Push

```bash
# Build and push with helper script
./build-push-script.sh

# Or manually
docker build -t vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest .
docker push vcr.vnpaycloud.vn/286e18c6183846159c47575db4e3d831-clawdbot/clawdbot:latest
```

## ☸️ For Kubernetes - Create ImagePullSecret

If Kubernetes needs credentials to pull images:

```bash
cd /home/duhd/clawdbot/k8s
./create-image-pull-secret.sh
```

This creates a secret named `vcr-secret` in the `clawdbot` namespace.

Then uncomment in `deployment.yaml`:

```yaml
spec:
  template:
    spec:
      imagePullSecrets:
      - name: vcr-secret
```

## 📁 Files Created

- ✅ `.env.registry` - Credentials file (gitignored)
- ✅ `registry-login.sh` - Helper script to login
- ✅ `create-image-pull-secret.sh` - Create K8s secret
- ✅ Added to `.gitignore` to prevent commit

## ⚠️ Security Notes

1. **Never commit** `.env.registry` to git (already in .gitignore)
2. **Rotate credentials** periodically for security
3. **Use bot account** for automation, personal account for manual operations
4. **Limit access** - bot account only has access to `clawdbot` namespace

## 🔄 Credential Rotation

If you need to rotate credentials:

1. Create new bot account in VNPay Cloud Harbor
2. Update `.env.registry` with new credentials
3. Re-run `./registry-login.sh`
4. Re-run `./create-image-pull-secret.sh` if using K8s secret
5. Delete old bot account

## 📞 Troubleshooting

### Can't login

```bash
# Check credentials
cat k8s/.env.registry

# Try manual login to test
docker login vcr.vnpaycloud.vn

# Check if already logged in
cat ~/.docker/config.json | grep vcr.vnpaycloud.vn
```

### ImagePullBackOff in Kubernetes

```bash
# Check if secret exists
kubectl get secret vcr-secret -n clawdbot

# Recreate secret
./create-image-pull-secret.sh

# Verify secret in deployment
kubectl get deployment clawdbot-gateway -n clawdbot -o yaml | grep imagePullSecrets -A 2
```

### Wrong credentials

```bash
# Logout and re-login
docker logout vcr.vnpaycloud.vn
./registry-login.sh
```

---

**Ready to use! 🎉**

Login command: `./registry-login.sh`
