#!/bin/sh
# Render startup script - creates config and starts gateway
set -e

# Create config directory
mkdir -p "${CLAWDBOT_STATE_DIR:-/data/.clawdbot}"

# Write config file with Render-specific settings
# trustedProxies allows Render's internal proxy IPs to be trusted
cat > "${CLAWDBOT_STATE_DIR:-/data/.clawdbot}/clawdbot.json" << 'EOF'
{
  "gateway": {
    "mode": "local",
    "trustedProxies": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
    "controlUi": {
      "allowInsecureAuth": true
    }
  }
}
EOF

echo "Config written to ${CLAWDBOT_STATE_DIR:-/data/.clawdbot}/clawdbot.json"
cat "${CLAWDBOT_STATE_DIR:-/data/.clawdbot}/clawdbot.json"

# Start the gateway with token from env var
exec node dist/index.js gateway \
  --port 8080 \
  --bind lan \
  --auth token \
  --token "$CLAWDBOT_GATEWAY_TOKEN" \
  --allow-unconfigured
