#!/usr/bin/env bash
# AgentMemory heartbeat check - Search for relevant context

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CREDS="$HOME/.openclaw/credentials/agentmemory.json"

if [[ ! -f "$CREDS" ]]; then
  echo "⚠️  AgentMemory credentials not found, skipping heartbeat check"
  exit 0
fi

echo "🧠 AgentMemory Heartbeat Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Search for current projects
echo ""
echo "📋 Current Projects:"
bash "$SCRIPT_DIR/search.sh" "current projects" 3 2>/dev/null | grep -E "^\[|^🔍" || echo "No projects found"

# Search for recent preferences
echo ""
echo "⚙️  User Preferences:"
bash "$SCRIPT_DIR/search.sh" "user preferences" 3 2>/dev/null | grep -E "^\[|^🔍" || echo "No preferences found"

# Search for recent important facts
echo ""
echo "💡 Important Facts:"
bash "$SCRIPT_DIR/search.sh" "important facts" 3 2>/dev/null | grep -E "^\[|^🔍" || echo "No important facts found"

# Count total memories
echo ""
TOTAL=$(bash "$SCRIPT_DIR/list.sh" 100 0 2>/dev/null | grep "Full JSON:" -A 999 | jq 'length' 2>/dev/null || echo "unknown")
echo "📊 Total Memories: $TOTAL"

echo ""
echo "✅ Heartbeat check complete"
