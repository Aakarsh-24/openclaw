#!/bin/bash
set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

# Check if dist/entry.js exists
if [ ! -f "dist/entry.js" ]; then
  echo "Error: dist/entry.js not found. Please run 'pnpm build' first."
  exit 1
fi

echo "Running CLI benchmarks using 'node openclaw.mjs'..."
echo "---------------------------------------------------"

run_benchmark() {
  local cmd_name="$1"
  local cmd_args="$2"

  echo "Benchmarking: openclaw $cmd_args"

  # Use a temp file for time output because -l writes to stderr
  local tmp_time=$(mktemp)

  # Run the command, discarding stdout, keeping stderr for time
  # We use /usr/bin/time -l for macOS detailed stats
  if [[ "$OSTYPE" == "darwin"* ]]; then
    /usr/bin/time -l node openclaw.mjs $cmd_args >/dev/null 2>"$tmp_time"
  else
    # Fallback for Linux (GNU time -v is similar but syntax differs, sticking to simple time)
    /usr/bin/time -p node openclaw.mjs $cmd_args >/dev/null 2>"$tmp_time"
  fi

  # Extract Real time and Max RSS
  if [[ "$OSTYPE" == "darwin"* ]]; then
    local real_time=$(grep "real" "$tmp_time" | awk '{print $1}')
    local max_rss=$(grep "maximum resident set size" "$tmp_time" | awk '{print $1}')
    # macOS /usr/bin/time -l: "maximum resident set size" is in BYTES.
    local max_rss_mb=$(echo "scale=2; $max_rss / 1024 / 1024" | bc)

    echo "  Time: ${real_time}s"
    echo "  RSS:  ${max_rss_mb} MB"
  else
    cat "$tmp_time"
  fi

  rm "$tmp_time"
  echo ""
}

run_benchmark "Version" "--version"
run_benchmark "Help" "help"
run_benchmark "Status" "status"

echo "Done."
