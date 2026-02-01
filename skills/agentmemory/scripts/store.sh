#!/usr/bin/env bash
# Store a memory in AgentMemory cloud

set -euo pipefail

CREDS="$HOME/.openclaw/credentials/agentmemory.json"
BASE_URL="https://agentmemory.cloud/api"

if [[ ! -f "$CREDS" ]]; then
  echo "❌ Error: AgentMemory credentials not found at $CREDS" >&2
  exit 1
fi

API_KEY=$(jq -r '.api_key' "$CREDS")

if [[ -z "$1" ]]; then
  echo "Usage: $0 <content> [category] [importance]" >&2
  echo "Example: $0 'User prefers dark mode' preferences high" >&2
  exit 1
fi

CONTENT="$1"
CATEGORY="${2:-general}"
IMPORTANCE="${3:-medium}"

PAYLOAD=$(jq -n \
  --arg content "$CONTENT" \
  --arg category "$CATEGORY" \
  --arg importance "$IMPORTANCE" \
  '{
    content: $content,
    metadata: {
      category: $category,
      importance: $importance,
      stored_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
    }
  }')

RESPONSE=$(curl -s -X POST "$BASE_URL/memories" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | jq -e '.memory.id' >/dev/null 2>&1; then
  MEMORY_ID=$(echo "$RESPONSE" | jq -r '.memory.id')
  echo "✅ Stored: $MEMORY_ID"
  echo "$RESPONSE" | jq '.memory'
else
  echo "❌ Failed to store memory:" >&2
  echo "$RESPONSE" | jq '.' >&2
  exit 1
fi
