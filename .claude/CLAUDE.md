# Fork-Specific Agent Instructions

> **Repo structure**: This is `clawdbot-dev` (private). PRs go to the public fork, then upstream.
> Development and testing happen here. Only PR-ready code goes to the public fork.

## Local Workflow

For dev-specific git workflow (three-remote setup), see `.workflow/AGENTS.md`.

## Slash Commands (TDD Workflow)

```bash
/dev:help          # List all dev commands
/dev:gate          # Quality gate (lint, build, test) - run before commits
/dev:test [pattern]    # Run tests (--coverage for coverage report)
/dev:e2e [pattern]     # Run E2E tests
/dev:commit "msg" ...  # Safe commit using scripts/committer
/dev:tdd red|green|refactor [feature]  # TDD workflow phases
/dev:coverage [path]   # Analyze test coverage gaps
/dev:docs-review       # Review workflow docs for quality issues
```

## When to Read What

| Trigger | Read | Purpose |
|---------|------|---------|
| Git workflow (remotes, worktrees) | `.workflow/AGENTS.md` | Three-remote flow, multi-agent |
| Something broken | `.workflow/TROUBLESHOOTING.md` | Test timeouts, E2E, lint issues |
| Writing or reviewing tests | `.workflow/contributing/tdd-workflow.md` | TDD patterns, test helpers |
| Writing E2E tests | `.workflow/contributing/e2e-testing.md` | E2E patterns, process spawning |
| Setting up multi-agent workflows | `.workflow/automation/agent-automation.md` | Subagents, hooks, coordination |
| Configuring infrastructure | `.workflow/automation/infrastructure.md` | Mac mini, k3s, Tailscale |

## Exploration Principle

These workflow docs provide **patterns**, not inventories. This repo is kept in sync with upstream.

**Explore locally first:**
- `CLAUDE.md` (root) - Current project guidelines (from upstream)
- `package.json` - Available commands
- `src/**/*.test.ts` - Test patterns
- `docs/` - Official documentation

## Quick Commands (Manual)

```bash
# Quality gate (or use /dev:gate slash command)
pnpm lint && pnpm build && pnpm test

# Safe commit (or use /dev:commit slash command)
scripts/committer "<message>" <files...>

# E2E tests (or use /dev:e2e slash command)
pnpm test:e2e
```
