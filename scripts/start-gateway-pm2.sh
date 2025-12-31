#!/bin/bash
set -e

echo "Starting Clawdis Gateway with PM2..."

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "PM2 not found. Installing..."
    npm install -g pm2
fi

# Start the gateway
cd "$(dirname "$0")/.."
pm2 start ecosystem.config.cjs --env production

# Save PM2 configuration so it starts on boot
pm2 save

# Show status
echo ""
echo "Gateway status:"
pm2 status clawdis-gateway

echo ""
echo "To view logs: pm2 logs clawdis-gateway"
echo "To stop: pm2 stop clawdis-gateway"
echo "To restart: pm2 restart clawdis-gateway"
