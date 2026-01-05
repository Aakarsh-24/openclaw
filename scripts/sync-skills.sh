#!/bin/bash
# Sync clawd workspace: pull upstream + push changes

cd /Users/dbhurley/clawd

# 1. Pull latest from upstream clawdbot
echo "Fetching upstream..."
git fetch upstream 2>/dev/null

if git log HEAD..upstream/main --oneline | grep -q .; then
    echo "Merging upstream changes..."
    git merge upstream/main -m "Auto-merge upstream clawdbot" --no-edit || {
        # If merge conflicts, keep ours for workspace files
        git checkout --ours .gitignore AGENTS.md SOUL.md USER.md IDENTITY.md TOOLS.md memory.md 2>/dev/null
        git checkout --ours skills/ memory/ 2>/dev/null
        git add -A
        git commit -m "Auto-merge upstream (kept workspace versions for conflicts)" --no-edit
    }
fi

# 2. Commit any local changes
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Committing local changes..."
    git add -A
    git commit -m "Auto-sync: $(date '+%Y-%m-%d %H:%M')"
fi

# 3. Push everything
echo "Pushing to origin..."
git push origin main

echo "Sync complete!"
