#!/usr/bin/env bash
set -euo pipefail

# Inworld TTS script (ranked #1 in TTS Arena)
# Usage: speak.sh "text to speak" --out /path/to/output.mp3

if [[ $# -lt 1 ]]; then
  echo "Usage: speak.sh \"text\" --out /path/to/output.mp3 [--voice NAME]" >&2
  exit 1
fi

TEXT="$1"
shift

# Default voice: Maitê (female)
# Other voices: Ashley, Dennis, etc.
VOICE="Mait\u00ea"
MODEL="inworld-tts-1-max"
OUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --voice) VOICE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ -z "$OUT" ]]; then
  echo "Error: --out required" >&2
  exit 1
fi

if [[ -z "${INWORLD_API_KEY:-}" ]]; then
  echo "Error: INWORLD_API_KEY environment variable required" >&2
  exit 1
fi

# Escape text for JSON
TEXT_ESCAPED=$(echo "$TEXT" | jq -Rs .)

# Call Inworld TTS API and extract base64 audio
RESPONSE=$(curl -s --request POST \
  --url https://api.inworld.ai/tts/v1/voice \
  --header "Authorization: Basic ${INWORLD_API_KEY}" \
  --header "Content-Type: application/json" \
  -d "{\"text\":${TEXT_ESCAPED},\"voiceId\":\"${VOICE}\",\"modelId\":\"${MODEL}\"}")

# Extract audioContent and decode to file
echo "$RESPONSE" | jq -r '.audioContent' | base64 -d > "$OUT"

echo "$OUT"
