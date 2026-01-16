# Multi-Agent Automation

## Configuration

| Component | Location |
|-----------|----------|
| Settings | `.claude/settings.json` |
| Safety hook | `.claude/hooks/pre-bash.sh` |
| Commands | `.claude/commands/dev/`, `.claude/commands/build/` |
| Skills | `writing-tests`, `e2e-testing`, `reviewing-code` |

Multi-agent safety: see root `AGENTS.md`.

## Adding Commands

<<<<<<< Updated upstream
Create `.claude/commands/dev/<name>.md` with YAML frontmatter (`description`, `allowed-tools`) and instructions using `$ARGUMENTS`.
=======
### Slash Commands

See `/dev:help` or `.workflow/AGENTS.md` for command reference.

### Skills

| Skill | Purpose |
|-------|---------|
| `writing-tests` | TDD patterns |
| `e2e-testing` | E2E test patterns |
| `reviewing-code` | Code review checklists |

---

## Multi-Agent Safety

See root `AGENTS.md` (source of truth).

---

## Adding Commands/Hooks

**New slash command**:
```bash
# .claude/commands/dev/<name>.md
---
description: Brief description
allowed-tools: Bash, Read
---
Instructions here. Args: $ARGUMENTS
```

**Hook events**: `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `Stop`
>>>>>>> Stashed changes
