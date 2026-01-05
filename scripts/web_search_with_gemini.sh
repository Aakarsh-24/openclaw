#!/bin/bash

# Default values
MODEL="gemini-3-flash-preview"
OUTPUT_FORMAT="json"

# Parse arguments
QUERY=""
while [[ $# -gt 0 ]]; do
  case $1 in
    -m|--model)
      MODEL="$2"
      shift 2
      ;;
    -o|--output-format)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: web_search_with_gemini [options] \"Your question\""
      echo "Options:"
      echo "  -m, --model <model>          Model to use (default: $MODEL)"
      echo "  -o, --output-format <format> Output format (default: $OUTPUT_FORMAT)"
      exit 0
      ;;
    *)
      if [ -z "$QUERY" ]; then
        QUERY="$1"
      else
        QUERY="$QUERY $1"
      fi
      shift
      ;;
  esac
done

if [ -z "$QUERY" ]; then
  echo "Error: No query provided."
  echo "Usage: web_search_with_gemini [options] \"Your question\""
  exit 1
fi

# Load the specialized "Deep Research" and "Ultrathink" tail from YAML
PROMPT_FILE="prompts/web-search-tail.yaml"
if [ ! -f "$PROMPT_FILE" ]; then
  echo "Error: Prompt file $PROMPT_FILE not found."
  exit 1
fi

# Extract the value of prompt_tail from the YAML file
# Handles the block scalar | and removes leading spaces and newlines
TAIL=$(awk '/prompt_tail: \|/{flag=1; next} /^[a-z_]+:/{flag=0} flag{gsub(/^  /, ""); printf "%s", $0}' "$PROMPT_FILE")

# Fallback for simple one-line format
if [ -z "$TAIL" ]; then
  TAIL=$(grep "prompt_tail:" "$PROMPT_FILE" | sed 's/prompt_tail: //' | sed 's/^"//;s/"$//')
fi

FULL_PROMPT="$QUERY $TAIL"

# Execute gemini CLI
gemini -m "$MODEL" -p "$FULL_PROMPT" --output-format "$OUTPUT_FORMAT"
