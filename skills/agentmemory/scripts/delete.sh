#!/usr/bin/env bash
# Delete a memory from AgentMemory

set -euo pipefail

CREDS="$HOME/.openclaw/credentials/agentmemory.json"
BASE_URL="https://agentmemory.cloud/api"

if [[ ! -f "$CREDS" ]]; then
  echo "❌ Error: AgentMemory credentials not found at $CREDS" >&2
  exit 1
fi

API_KEY=$(jq -r '.api_key' "$CREDS")

if [[ -z "$1" ]]; then
  echo "Usage: $0 <memory_id>" >&2
  echo "Example: $0 mem_abc123" >&2
  exit 1
fi

MEMORY_ID="$1"

RESPONSE=$(curl -s -X DELETE "$BASE_URL/memories/$MEMORY_ID" \
  -H "Authorization: Bearer $API_KEY")

if [[ -z "$RESPONSE" ]] || echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
  echo "❌ Delete failed:" >&2
  echo "$RESPONSE" | jq '.' >&2
  exit 1
else
  echo "✅ Deleted: $MEMORY_ID"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi
