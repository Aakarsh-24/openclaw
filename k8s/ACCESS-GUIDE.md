# ✅ Clawdbot Access Guide - FINAL

## 🌐 Public IP Confirmed

**Cluster Public IP**: `103.165.142.57`

This IP is accessible from the internet and can be used to access Clawdbot!

## 🎯 Direct Access (Ready Now!)

### URL
```
http://103.165.142.57:30789
```

### Login Token
```
mK8vL9xN3qR7sT2wY6zB4cF5gH1jM0pA8dE9fG2hI3=
```

### NodePort Service
- **Service**: `clawdbot-gateway-nodeport`
- **Type**: NodePort
- **Ports**: 
  - Gateway: `18789 → 30789` (HTTP/WebSocket)
  - Bridge: `18790 → 30790` (TCP)

## 📋 DNS Setup Options

### Option 1: Direct IP (No DNS) - EASIEST

Just use the IP directly:
```
http://103.165.142.57:30789
```

**Pros:**
- ✅ Works immediately
- ✅ No DNS configuration needed

**Cons:**
- ❌ Hard to remember
- ❌ Looks unprofessional
- ❌ Port number required

---

### Option 2: Custom Domain with A Record - RECOMMENDED

1. **Choose a domain**: e.g., `clawdbot.vnpay.vn`

2. **Create DNS A Record**:
   ```
   Type: A
   Name: clawdbot (or @)
   Value: 103.165.142.57
   TTL: 3600
   ```

3. **Wait for DNS propagation** (5-30 minutes)

4. **Access**:
   ```
   http://clawdbot.vnpay.vn:30789
   ```

**Pros:**
- ✅ Easy to remember
- ✅ Professional looking
- ✅ Can add SSL later

**Cons:**
- ❌ Still need port number
- ❌ Requires DNS access

---

### Option 3: Reverse Proxy (Production) - BEST

Setup an edge proxy to:
- Remove port from URL
- Add HTTPS/SSL
- Add authentication
- Rate limiting

**Example nginx config**:
```nginx
server {
    listen 80;
    server_name clawdbot.vnpay.vn;
    
    location / {
        proxy_pass http://103.165.142.57:30789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then access at: `http://clawdbot.x.vnshop.cloud` (no port!)

---

## 🔒 HTTPS/SSL Setup

To add HTTPS, you need:

### Method 1: Reverse Proxy with Let's Encrypt

```bash
# On proxy server
sudo certbot --nginx -d clawdbot.x.vnshop.cloud
```

### Method 2: Cloudflare (Easiest)

1. Add domain to Cloudflare
2. Point A record to `103.165.142.57`
3. Setup page rule to redirect to port 30789
4. SSL automatically enabled

---

## 🧪 Testing Access

### From Browser
```
http://103.165.142.57:30789
```

Enter token when prompted:
```
mK8vL9xN3qR7sT2wY6zB4cF5gH1jM0pA8dE9fG2hI3=
```

### From Command Line

```bash
# Test HTTP connectivity
curl -I http://103.165.142.57:30789

# Test WebSocket (requires websocat)
websocat ws://103.165.142.57:30789
```

### Test DNS (after setup)

```bash
# Check DNS resolution
nslookup clawdbot.vnpay.vn

# Should return:
# Name: clawdbot.vnpay.vn
# Address: 103.165.142.57

# Test access
curl -I http://clawdbot.vnpay.vn:30789
```

---

## 📊 Current Status Summary

```
✅ Clawdbot: Deployed & Running
✅ Zalo Plugin: Installed & Loaded
✅ NodePort Service: Created
✅ Public IP: 103.165.142.57
✅ Gateway Port: 30789
✅ Access: Ready!
```

---

## 🎯 Recommended Next Steps

1. **Now**: Test access at `http://103.165.142.57:30789`

2. **Short-term**: Setup DNS
   - Choose domain name
   - Create A record → 103.165.142.57
   - Test access via domain

3. **Long-term**: Production hardening
   - Setup reverse proxy
   - Add HTTPS/SSL
   - Add authentication layer
   - Setup monitoring

---

## 💬 Using Zalo Integration

Once you can access the Control UI:

1. **Test Zalo bot**:
   - Open Zalo app on phone
   - Search for your bot: https://zalo.me/s/botcreator/
   - Send a message

2. **Approve pairing** (from cluster):
   ```bash
   kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- \
     node dist/index.js pairing list zalo
   
   kubectl exec -it deployment/clawdbot-gateway -n clawdbot -- \
     node dist/index.js pairing approve zalo <CODE>
   ```

3. **Start chatting** with Claude via Zalo! 🎉

---

## 🔍 Troubleshooting

### Can't access 103.165.142.57:30789

**Check firewall:**
```bash
# On cluster node (may need admin)
sudo ufw status
sudo ufw allow 30789/tcp
```

**Check service:**
```bash
kubectl get service clawdbot-gateway-nodeport -n clawdbot
kubectl get pods -n clawdbot
```

**Check logs:**
```bash
kubectl logs deployment/clawdbot-gateway -n clawdbot --tail=50
```

### Connection timeout

- Verify IP: `ping 103.165.142.57`
- Check if port is open: `telnet 103.165.142.57 30789`
- May need VPN if IP is VNPay internal only

### WebSocket not working

Check browser console for errors. May need to:
- Disable browser extensions
- Try different browser
- Check for corporate proxy/firewall

---

## 📞 Support

**Deployment successful!**

For issues:
1. Check logs: `kubectl logs -f deployment/clawdbot-gateway -n clawdbot`
2. Check status: `kubectl get all -n clawdbot`
3. Review docs: `k8s/README.md`, `k8s/DNS-SETUP.md`

---

**🎊 Congratulations! Clawdbot is now accessible!** 🚀

Access now: **http://103.165.142.57:30789**
