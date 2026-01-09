# New Feature Prompt

Copy and paste this when starting a new Claude session to implement a feature.

---

```
Implement feature for clawdbot/clawdbot.

Context: <description or issue link>

Instructions:
1. Read `.workflow/AGENTS.md` for workflow
2. Propose approach before coding
3. Use /dev:tdd red to define behavior with tests
4. Implement with /dev:tdd green
5. Run /dev:gate
6. Keep minimal - MVP only

Constraints:
- No over-engineering
- No unrelated refactoring
- Follow existing patterns
```
