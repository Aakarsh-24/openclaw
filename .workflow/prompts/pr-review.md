# PR Review Prompt

Copy, fill in the placeholders, and paste into a new Claude session.

---

## Template

```
Review: <PR_TITLE> (#<NUMBER>)

1. Fetch PR with gh pr view/diff (do NOT checkout)
2. Check security: <specific concern if any, or "general review">
3. Check tests cover the changes
4. Verify CHANGELOG entry exists
5. Report: approve or request changes

Read-only - do not modify code.
```

---

## Example

Based on steipete's `feat: add telegram topic delivery for cron`:

```
Review: Add Telegram topic delivery for cron jobs

1. Fetch PR with gh pr view/diff (do NOT checkout)
2. Check security: topic ID validation, auth handling
3. Check tests cover topic delivery paths
4. Verify CHANGELOG entry exists
5. Report: approve or request changes

Read-only - do not modify code.
```

---

## Review Checklist

When reviewing, check:

- **Security**: input validation, injection, secrets exposure
- **Quality**: error handling, edge cases, types (no `any`)
- **Style**: <700 LOC files, no over-engineering, follows patterns
- **Tests**: new behavior covered, meaningful assertions
- **CHANGELOG**: entry with PR # and contributor thanks
