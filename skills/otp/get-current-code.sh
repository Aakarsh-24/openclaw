#!/bin/bash
# Get the current valid OTP code (for testing only!)
#
# Usage: get-current-code.sh

set -e

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-$(pwd)}"
TOTP_CLI="$SKILL_DIR/../../packages/totp-cli/totp.mjs"
CONFIG_FILE="${OPENCLAW_CONFIG:-}"

# Try multiple config locations - check that secret exists too
if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
  for candidate in "$HOME/.openclaw/openclaw.json" "$HOME/.moltbot/openclaw.json" "$HOME/.moltbot/moltbot.json"; do
    if [ -f "$candidate" ]; then
      SECRET_CHECK=$(jq -r '.auth.otpVerification.secret // empty' "$candidate" 2>/dev/null)
      if [ -n "$SECRET_CHECK" ]; then
        CONFIG_FILE="$candidate"
        break
      fi
    fi
  done
fi

if [ -z "$CONFIG_FILE" ] || [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Config file not found or no OTP secret configured" >&2
  exit 2
fi

# Extract secret from config
SECRET=$(jq -r '.auth.otpVerification.secret // empty' "$CONFIG_FILE")

if [ -z "$SECRET" ]; then
  echo "ERROR: No OTP secret configured at auth.otpVerification.secret" >&2
  exit 2
fi

"$TOTP_CLI" current "$SECRET"
