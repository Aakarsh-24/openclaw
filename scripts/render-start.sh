#!/bin/sh
# Render startup script - creates config and starts gateway
set -e

echo "=== Render startup script ==="
echo "HOME=${HOME:-not set}"
echo "CLAWDBOT_STATE_DIR=${CLAWDBOT_STATE_DIR:-not set}"
echo "User: $(whoami 2>/dev/null || echo unknown)"
echo "UID: $(id -u 2>/dev/null || echo unknown)"

# Set HOME if not set (node user's home is /home/node)
if [ -z "${HOME}" ]; then
  export HOME="/home/node"
  if [ ! -d "${HOME}" ]; then
    export HOME="/tmp"
  fi
  echo "Set HOME to: ${HOME}"
fi

# Use CLAWDBOT_STATE_DIR if set and writable, otherwise use HOME/.clawdbot
CONFIG_DIR="${HOME}/.clawdbot"
if [ -n "${CLAWDBOT_STATE_DIR}" ]; then
  # Test if we can write to it
  if mkdir -p "${CLAWDBOT_STATE_DIR}" 2>/dev/null && touch "${CLAWDBOT_STATE_DIR}/.test" 2>/dev/null; then
    rm -f "${CLAWDBOT_STATE_DIR}/.test" 2>/dev/null
    CONFIG_DIR="${CLAWDBOT_STATE_DIR}"
    echo "Using CLAWDBOT_STATE_DIR: ${CONFIG_DIR}"
  else
    echo "Warning: ${CLAWDBOT_STATE_DIR} not writable, using ${CONFIG_DIR}"
  fi
fi

CONFIG_FILE="${CONFIG_DIR}/clawdbot.json"

echo "Config dir: ${CONFIG_DIR}"
echo "Config file: ${CONFIG_FILE}"

# Create config directory
mkdir -p "${CONFIG_DIR}"

# Write config file
cat > "${CONFIG_FILE}" << 'EOF'
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

echo "=== Config written to ${CONFIG_FILE} ==="
cat "${CONFIG_FILE}"

# Set environment variables for gateway
export CLAWDBOT_STATE_DIR="${CONFIG_DIR}"
export CLAWDBOT_CONFIG_PATH="${CONFIG_FILE}"
export CLAWDBOT_CONFIG_CACHE_MS=0

echo "=== Starting gateway ==="
echo "CLAWDBOT_STATE_DIR=${CLAWDBOT_STATE_DIR}"
echo "CLAWDBOT_CONFIG_PATH=${CLAWDBOT_CONFIG_PATH}"

# Verify node is available
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node command not found"
  exit 1
fi

# Verify dist/index.js exists
if [ ! -f "dist/index.js" ]; then
  echo "ERROR: dist/index.js not found"
  exit 1
fi

# Start gateway
exec node dist/index.js gateway \
  --port 8080 \
  --bind lan \
  --auth token \
  --token "${CLAWDBOT_GATEWAY_TOKEN}" \
  --allow-unconfigured
