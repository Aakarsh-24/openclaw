#!/usr/bin/env bash
# Search AgentMemory with semantic vector search

set -euo pipefail

CREDS="$HOME/.openclaw/credentials/agentmemory.json"
BASE_URL="https://agentmemory.cloud/api"

if [[ ! -f "$CREDS" ]]; then
  echo "❌ Error: AgentMemory credentials not found at $CREDS" >&2
  exit 1
fi

API_KEY=$(jq -r '.api_key' "$CREDS")

if [[ -z "$1" ]]; then
  echo "Usage: $0 <query> [limit]" >&2
  echo "Example: $0 'user preferences' 5" >&2
  exit 1
fi

QUERY="$1"
LIMIT="${2:-10}"

PAYLOAD=$(jq -n \
  --arg query "$QUERY" \
  --argjson limit "$LIMIT" \
  '{
    query: $query,
    limit: $limit
  }')

RESPONSE=$(curl -s -X POST "$BASE_URL/memories/search" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | jq -e '.memories' >/dev/null 2>&1; then
  COUNT=$(echo "$RESPONSE" | jq '.memories | length')
  echo "🔍 Found $COUNT memories for: \"$QUERY\""
  echo "$RESPONSE" | jq -r '.memories[]? | "[\(.similarity | tonumber * 100 | round)%] \(.id): \(.content)"' 2>/dev/null || true
  echo ""
  echo "Full JSON:"
  echo "$RESPONSE" | jq '.memories'
else
  echo "❌ Search failed:" >&2
  echo "$RESPONSE" | jq '.' >&2
  exit 1
fi
