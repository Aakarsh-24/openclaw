# Fix Issue Prompt

Copy, fill in the placeholders, and paste into a new Claude session.

---

## Template

```
Fix: <ISSUE_TITLE> (#<NUMBER>)

1. <where to look / what to investigate>
2. Write a test that reproduces the bug
3. Implement fix
4. Run /dev:gate
5. Prepare PR-ready commit with CHANGELOG entry

Constraints: fix only the specific bug, don't refactor surrounding code.
```

---

## Example

Based on steipete's `fix: retry telegram poll conflicts`:

```
Fix: Telegram long-polling conflicts cause fatal exits

1. Find polling logic in src/telegram/
2. Write a test that reproduces conflict errors
3. Implement retry with backoff
4. Run /dev:gate
5. Prepare PR-ready commit with CHANGELOG entry

Constraints: fix only the specific bug, don't refactor surrounding code.
```

---

## Tips

- Step 1 should hint at the likely location based on issue description
- Keep constraints explicit to prevent scope creep
- The numbered steps become a natural checklist
