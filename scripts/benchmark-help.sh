#!/bin/bash

# Benchmark script for OpenClaw CLI help load times
# Compares current branch vs main branch

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORT_FILE="$PROJECT_DIR/benchmark-help-report.md"
TEMP_DIR=$(mktemp -d)
MAIN_RESULTS="$TEMP_DIR/main_results.txt"
CURRENT_RESULTS="$TEMP_DIR/current_results.txt"
SYSTEM_INFO="$TEMP_DIR/system_info.txt"

# Commands to benchmark
COMMANDS=(
  "--help"
  "acp --help"
  "gateway --help"
  "daemon --help"
  "logs --help"
  "system --help"
  "models --help"
  "approvals --help"
  "nodes --help"
  "devices --help"
  "node --help"
  "sandbox --help"
  "tui --help"
  "cron --help"
  "dns --help"
  "docs --help"
  "hooks --help"
  "webhooks --help"
  "pairing --help"
  "plugins --help"
  "channels --help"
  "directory --help"
  "security --help"
  "skills --help"
  "update --help"
  "completion --help"
  "setup --help"
  "onboard --help"
  "configure --help"
  "config --help"
  "git --help"
  "maintenance --help"
  "message --help"
  "memory --help"
  "agent --help"
  "status --help"
  "health --help"
  "sessions --help"
  "browser --help"
)

log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
  echo -e "${RED}[ERROR] $1${NC}" >&2
}

warn() {
  echo -e "${YELLOW}[WARN] $1${NC}"
}

collect_system_info() {
  log "Collecting system information..."
  {
    echo "# System Information"
    echo "Date: $(date)"
    echo "Host: $(hostname)"
    echo "OS: $(uname -a)"
    echo "Node: $(node --version)"
    echo "PNPM: $(pnpm --version)"
    echo "Git: $(git --version)"
    echo "Current branch: $(git branch --show-current)"
    echo "Commit: $(git rev-parse HEAD)"
  } >"$SYSTEM_INFO"
}

clean_build() {
  log "Cleaning and building..."
  cd "$PROJECT_DIR"
  rm -rf dist/
  pnpm install --frozen-lockfile
  pnpm build
}

benchmark_commands() {
  local output_file="$1"
  local branch="$2"
  log "Benchmarking commands on branch: $branch"

  {
    echo "# Benchmark Results - $branch"
    echo "| Command | Time (seconds) |"
    echo "|---------|----------------|"
  } >"$output_file"

  for cmd in "${COMMANDS[@]}"; do
    log "Benchmarking: openclaw $cmd"
    # Use Node.js to measure elapsed time cross-platform
    if time_output=$(node -e "
      const { execSync } = require('child_process');
      const start = process.hrtime.bigint();
      try {
        execSync('./openclaw.mjs $cmd', { stdio: 'pipe' });
      } catch (e) {}
      const end = process.hrtime.bigint();
      const elapsed = Number(end - start) / 1e9;
      console.log(elapsed.toFixed(3));
    " 2>/dev/null); then
      echo "| \`$cmd\` | $time_output |" >>"$output_file"
    else
      warn "Command failed: openclaw $cmd"
      echo "| \`$cmd\` | FAILED |" >>"$output_file"
    fi
  done
}

switch_branch() {
  local branch="$1"
  log "Switching to branch: $branch"
  git checkout "$branch"
  git pull --rebase origin "$branch"
}

main() {
  cd "$PROJECT_DIR"

  # Get current branch
  CURRENT_BRANCH=$(git branch --show-current)
  log "Current branch: $CURRENT_BRANCH"

  collect_system_info

  # Benchmark main branch
  switch_branch "main"
  clean_build
  benchmark_commands "$MAIN_RESULTS" "main"

  # Benchmark current branch
  switch_branch "$CURRENT_BRANCH"
  clean_build
  benchmark_commands "$CURRENT_RESULTS" "current ($CURRENT_BRANCH)"

  # Generate report
  log "Generating final report..."
  {
    cat "$SYSTEM_INFO"
    echo ""
    echo "# Benchmark Comparison Report"
    echo ""
    echo "## Main Branch Results"
    cat "$MAIN_RESULTS"
    echo ""
    echo "## Current Branch ($CURRENT_BRANCH) Results"
    cat "$CURRENT_RESULTS"
    echo ""
    echo "## Analysis"
    echo ""
    # Here we could add some analysis, but for now just placeholder
    echo "Manual analysis required. Compare the times above."
  } >"$REPORT_FILE"

  log "Report generated: $REPORT_FILE"

  # Cleanup
  rm -rf "$TEMP_DIR"

  log "Benchmark complete!"
}

# Run main function
main "$@"
