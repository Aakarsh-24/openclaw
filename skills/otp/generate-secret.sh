#!/bin/bash
# Generate a new TOTP secret
#
# Usage: generate-secret.sh [account] [issuer]

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="${WORKSPACE:-$(pwd)}"
TOTP_CLI="$SKILL_DIR/../../packages/totp-cli/totp.mjs"

ACCOUNT="${1:-user@example.com}"
ISSUER="${2:-OpenClaw}"

"$TOTP_CLI" generate "$ACCOUNT" "$ISSUER"
