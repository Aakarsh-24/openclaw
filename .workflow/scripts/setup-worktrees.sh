#!/bin/bash
# Setup git worktrees for parallel agent development
# Usage: ./.workflow/scripts/setup-worktrees.sh [sandbox-root]

set -e

SANDBOX_ROOT="${1:-$HOME/clawdbot-sandboxes}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Setting up agent worktrees..."
echo "  Repository: $REPO_ROOT"
echo "  Sandbox root: $SANDBOX_ROOT"
echo ""

# Create sandbox root directory
mkdir -p "$SANDBOX_ROOT"

# Define worktrees to create
WORKTREES=(
  "agent-dev"
  "agent-test"
  "agent-review"
)

for name in "${WORKTREES[@]}"; do
  worktree_path="$SANDBOX_ROOT/$name"
  branch_name="sandbox/$name"

  if [ -d "$worktree_path" ]; then
    echo "  [exists] $name -> $worktree_path"
  else
    echo "  [create] $name -> $worktree_path"
    git -C "$REPO_ROOT" worktree add "$worktree_path" -b "$branch_name" 2>/dev/null || \
    git -C "$REPO_ROOT" worktree add "$worktree_path" "$branch_name"
  fi
done

echo ""
echo "Installing dependencies in each worktree..."

for name in "${WORKTREES[@]}"; do
  worktree_path="$SANDBOX_ROOT/$name"
  if [ -d "$worktree_path" ]; then
    echo "  [install] $name"
    (cd "$worktree_path" && pnpm install --silent 2>/dev/null) || echo "    (skipped - may need manual install)"
  fi
done

echo ""
echo "Done! Worktrees are ready at:"
git -C "$REPO_ROOT" worktree list

echo ""
echo "To use a worktree, cd into it and run Claude Code:"
echo "  cd $SANDBOX_ROOT/agent-dev && claude"
echo ""
echo "To remove worktrees later:"
echo "  git worktree remove $SANDBOX_ROOT/agent-dev"
echo "  git worktree prune"
