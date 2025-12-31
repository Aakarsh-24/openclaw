#!/bin/bash
set -e

echo "Stopping Clawdis Gateway..."
pm2 stop clawdis-gateway

# Show status
pm2 status clawdis-gateway

echo "Gateway stopped."
