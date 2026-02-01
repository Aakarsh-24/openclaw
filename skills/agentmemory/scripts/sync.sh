#!/usr/bin/env bash
# Sync local MEMORY.md with AgentMemory cloud (bidirectional)

set -euo pipefail

CREDS="$HOME/.openclaw/credentials/agentmemory.json"
MEMORY_FILE="${MEMORY_FILE:-MEMORY.md}"
BASE_URL="https://agentmemory.cloud/api"

if [[ ! -f "$CREDS" ]]; then
  echo "❌ Error: AgentMemory credentials not found at $CREDS" >&2
  exit 1
fi

if [[ ! -f "$MEMORY_FILE" ]]; then
  echo "❌ Error: MEMORY.md not found at $MEMORY_FILE" >&2
  echo "Tip: Run from your workspace root or set MEMORY_FILE=/path/to/MEMORY.md" >&2
  exit 1
fi

API_KEY=$(jq -r '.api_key' "$CREDS")
MODE="${1:-push}"  # push, pull, or both

echo "🔄 Syncing MEMORY.md with AgentMemory cloud (mode: $MODE)"

# Helper: Extract important facts from MEMORY.md
extract_facts() {
  # Extract lines that look like facts (bullet points, headings, etc.)
  # Skip metadata sections and update timestamps
  grep -E '^\s*[-*]\s+|^##\s+' "$MEMORY_FILE" | \
    grep -v "Last updated:" | \
    grep -v "^\s*$" || true
}

# PUSH: Upload important facts from local MEMORY.md to cloud
if [[ "$MODE" == "push" || "$MODE" == "both" ]]; then
  echo "📤 Pushing facts from local MEMORY.md to cloud..."
  
  FACTS=$(extract_facts)
  
  if [[ -z "$FACTS" ]]; then
    echo "⚠️  No facts found in MEMORY.md to push"
  else
    COUNT=0
    while IFS= read -r line; do
      # Skip empty lines
      [[ -z "$line" ]] && continue
      
      # Clean up the line (remove leading markers)
      CONTENT=$(echo "$line" | sed -E 's/^[[:space:]]*[-*#]+[[:space:]]*//')
      
      # Skip if too short or looks like a heading marker
      [[ ${#CONTENT} -lt 10 ]] && continue
      
      # Check if this fact already exists in cloud (avoid duplicates)
      SEARCH_RESULT=$(curl -s -X POST "$BASE_URL/memories/search" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$(jq -n --arg q "$CONTENT" '{query: $q, limit: 1}')")
      
      SIMILARITY=$(echo "$SEARCH_RESULT" | jq -r '.memories[0].similarity // 0')
      
      # If similarity > 80%, skip (already exists)
      if (( $(echo "$SIMILARITY > 0.8" | bc -l) )); then
        echo "  ⏭️  Skipping (already exists): $CONTENT"
        continue
      fi
      
      # Store in cloud
      PAYLOAD=$(jq -n \
        --arg content "$CONTENT" \
        '{
          content: $content,
          metadata: {
            category: "memory_sync",
            importance: "medium",
            source: "MEMORY.md",
            synced_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
          }
        }')
      
      RESPONSE=$(curl -s -X POST "$BASE_URL/memories" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD")
      
      if echo "$RESPONSE" | jq -e '.memory.id' >/dev/null 2>&1; then
        MEMORY_ID=$(echo "$RESPONSE" | jq -r '.memory.id')
        echo "  ✅ Stored: $MEMORY_ID - $CONTENT"
        ((COUNT++))
      else
        echo "  ❌ Failed: $CONTENT" >&2
      fi
    done <<< "$FACTS"
    
    echo "📤 Pushed $COUNT new facts to cloud"
  fi
fi

# PULL: Download recent memories from cloud and append to MEMORY.md
if [[ "$MODE" == "pull" || "$MODE" == "both" ]]; then
  echo "📥 Pulling recent memories from cloud..."
  
  # Get recent high-importance memories
  RESPONSE=$(curl -s "$BASE_URL/memories?limit=50&offset=0" \
    -H "Authorization: Bearer $API_KEY")
  
  if echo "$RESPONSE" | jq -e '.memories' >/dev/null 2>&1; then
    COUNT=$(echo "$RESPONSE" | jq '.memories | length')
    echo "📥 Found $COUNT memories in cloud"
    
    # Create a sync section in MEMORY.md if it doesn't exist
    if ! grep -q "## Cloud Sync" "$MEMORY_FILE"; then
      echo "" >> "$MEMORY_FILE"
      echo "## Cloud Sync" >> "$MEMORY_FILE"
      echo "*Synced from AgentMemory cloud*" >> "$MEMORY_FILE"
      echo "" >> "$MEMORY_FILE"
    fi
    
    # Append new high-importance memories
    NEW_COUNT=0
    echo "$RESPONSE" | jq -r '.memories[] | select(.metadata.importance == "high") | "- \(.content) (synced: \(.created_at | split("T")[0]))"' | \
    while IFS= read -r line; do
      # Check if this line already exists in MEMORY.md
      if ! grep -Fq "$line" "$MEMORY_FILE"; then
        echo "$line" >> "$MEMORY_FILE"
        echo "  ✅ Added: $line"
        ((NEW_COUNT++)) || true
      fi
    done
    
    echo "📥 Pulled ${NEW_COUNT:-0} new memories to MEMORY.md"
  else
    echo "❌ Failed to pull memories from cloud" >&2
  fi
fi

echo "✅ Sync complete!"
