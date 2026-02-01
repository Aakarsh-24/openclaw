#!/usr/bin/env bash
# List all memories from AgentMemory

set -euo pipefail

CREDS="$HOME/.openclaw/credentials/agentmemory.json"
BASE_URL="https://agentmemory.cloud/api"

if [[ ! -f "$CREDS" ]]; then
  echo "❌ Error: AgentMemory credentials not found at $CREDS" >&2
  exit 1
fi

API_KEY=$(jq -r '.api_key' "$CREDS")

LIMIT="${1:-50}"
OFFSET="${2:-0}"

RESPONSE=$(curl -s "$BASE_URL/memories?limit=$LIMIT&offset=$OFFSET" \
  -H "Authorization: Bearer $API_KEY")

if echo "$RESPONSE" | jq -e '.memories' >/dev/null 2>&1; then
  COUNT=$(echo "$RESPONSE" | jq '.memories | length')
  echo "📋 Listing $COUNT memories (limit: $LIMIT, offset: $OFFSET)"
  echo "$RESPONSE" | jq -r '.memories[]? | "\(.id): \(.content)"' 2>/dev/null || true
  echo ""
  echo "Full JSON:"
  echo "$RESPONSE" | jq '.memories'
else
  echo "❌ List failed:" >&2
  echo "$RESPONSE" | jq '.' >&2
  exit 1
fi
