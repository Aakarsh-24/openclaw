#!/bin/bash
# Check if a user's OTP verification is still valid
#
# Usage: check-status.sh [userId]
#
# Exit codes:
#   0 - Still verified (within time window)
#   1 - Expired or never verified
#   2 - Config/setup error

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-$(pwd)}"
STATE_FILE="$WORKSPACE/memory/otp-state.json"

USER_ID="${1:-default}"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
  echo "EXPIRED (never verified)"
  exit 1
fi

# Get user's verification state
USER_STATE=$(jq -r --arg userId "$USER_ID" '.[$userId] // empty' "$STATE_FILE")

if [ -z "$USER_STATE" ]; then
  echo "EXPIRED (never verified)"
  exit 1
fi

# Extract expiration time
EXPIRES_AT=$(echo "$USER_STATE" | jq -r '.expiresAt')
LAST_VERIFIED=$(echo "$USER_STATE" | jq -r '.lastVerified')

# Convert to epoch seconds for comparison
EXPIRES_EPOCH=$(date -d "$EXPIRES_AT" +%s 2>/dev/null || echo 0)
NOW_EPOCH=$(date +%s)

if [ "$NOW_EPOCH" -lt "$EXPIRES_EPOCH" ]; then
  echo "VALID (last verified: $LAST_VERIFIED, expires: $EXPIRES_AT)"
  exit 0
else
  echo "EXPIRED (last verified: $LAST_VERIFIED)"
  exit 1
fi
