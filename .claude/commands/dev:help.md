---
description: List available dev workflow commands
---

# Dev Workflow Commands

Available commands in the `dev:` namespace:

## Quality & Testing
| Command | Description |
|---------|-------------|
| `/dev:gate` | Run full quality gate (lint, build, test) before commits |
| `/dev:test [pattern]` | Run tests with optional pattern filter |
| `/dev:test --coverage` | Run tests with coverage report |
| `/dev:e2e [pattern]` | Run end-to-end tests |
| `/dev:coverage [path]` | Analyze test coverage gaps |

## Workflow
| Command | Description |
|---------|-------------|
| `/dev:tdd red\|green\|refactor` | TDD workflow phases |
| `/dev:commit "msg" files...` | Safe commit using scripts/committer |
| `/dev:docs-review` | Review workflow docs for quality issues |

## Getting Started

**New to this codebase?** Start here:
1. Read `CLAUDE.md` (root) for project guidelines
2. Read `.claude/CLAUDE.md` for fork-specific workflow
3. Run `/dev:gate` to verify your setup works
4. Explore with the `clawdbot-guide` agent for questions

**Quick commands:**
```bash
pnpm install        # Install dependencies
pnpm build          # TypeScript compilation
pnpm test           # Run tests
pnpm clawdbot ...   # Run CLI in dev mode
```

**Before committing:** Always run `/dev:gate` first.
