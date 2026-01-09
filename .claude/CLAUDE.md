# Fork-Specific Agent Instructions

> **This is `clawdbot-dev`** (private fork). PRs go to the public fork, then upstream.

## Start Here

**Read `.workflow/AGENTS.md`** for complete workflow documentation including:
- Three-remote git model (dev → fork → upstream)
- Upstream contribution workflows
- One-shot prompt templates for issues/PRs
- Slash commands reference
- Quality standards and multi-agent safety

## Quick Reference

```bash
/dev:help              # List all commands
/dev:gate              # Quality gate - run before every commit
/dev:tdd red|green|refactor [feature]  # TDD workflow
```

## Workflow Docs Index

| Trigger | Read |
|---------|------|
| **Start here** | `.workflow/AGENTS.md` |
| Writing tests | `.workflow/contributing/tdd-workflow.md` |
| Writing E2E tests | `.workflow/contributing/e2e-testing.md` |
| Multi-agent setup | `.workflow/automation/agent-automation.md` |
| Something broken | `.workflow/TROUBLESHOOTING.md` |

## Explore Locally

This repo syncs with upstream. Check these for current patterns:
- `CLAUDE.md` (root) - Project coding standards
- `package.json` - Available commands
- `src/**/*.test.ts` - Test patterns
