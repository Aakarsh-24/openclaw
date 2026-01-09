---
description: Review workflow docs for quality issues
allowed-tools: Task(subagent_type=claude-code-guide), Read, Glob, Grep
argument-hint: [path]
success-criteria: |
  - Independent review completed (fresh context, no implementation bias)
  - Issues listed with file:line references
  - Each issue has suggested fix
  - "DOCUMENTATION IS READY" if no issues found
---

# Documentation Review

Review `.workflow/` and `.claude/` docs for quality issues using an independent agent.

**Path:** $1 (or all workflow docs if not specified)

**Process:**
1. Spawn claude-code-guide agent with fresh context
2. Review docs for common issues (see checklist below)
3. Output findings in actionable format

**Review Checklist:**
- **Cross-references**: Do links point to existing files?
- **Path accuracy**: Are file paths valid? (test/ vs src/)
- **Discoverability**: Are docs referenced in navigation tables?
- **Clarity**: Are success criteria actionable?
- **DRY compliance**: Does content duplicate upstream CLAUDE.md or code?

**Output format:**
```
## Issues Found

### [severity] file.md:line
Description of issue
**Fix:** Suggested correction

---

DOCUMENTATION IS READY FOR PRODUCTION USE (if no issues)
```

**Why this works:**
The spawned agent has no knowledge of recent changes, ensuring unbiased review. As Claude improves, reviews improve automatically—zero maintenance.

## Explore
- Workflow docs: `.workflow/**/*.md`
- Command docs: `.claude/commands/*.md`
- Reference: `.claude/CLAUDE.md`
