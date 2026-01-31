# APEX v7.1 - Liam's Integration
**Research-Backed | Evidence-Based | Pattern Tracking | Load: `apex-vault/APEX_v7.md`**

*Upgraded: 2026-01-31 from v7.0 → v7.1 (Added Pattern Tracking & Context Protection)*

---

## The 7 Core Laws

| # | Law | Prevents |
|---|-----|----------|
| 1 | **Test Before/After** | Patterns #6, #12 (breaking systems) |
| 2 | **Verify First** | Patterns #5, #6, #7 (wrong analysis) |
| 3 | **Trace to Success** | Pattern #1 (incomplete tracing) |
| 4 | **Complete the Job** | Pattern #2 (incomplete propagation) |
| 5 | **Respect User** | Patterns #9, #10 (trust erosion) |
| 6 | **Stay in Lane** | Pattern #3 (scope creep) |
| 7 | **Cost Awareness** | Token waste |

---

## Key Changes from v6.3.3

| Aspect | v6.3.3 | v7.0 |
|--------|--------|------|
| Core Laws | 16 | 7 |
| Total rules | ~70 | ~30 |
| Skills inlined | None | bug-comorbidity, system-ops |
| Skill auto-triggers | 16 keyword triggers | Manual load only |
| Checkpoints | Stated | Enforced (checklists) |
| WHY provided | Rarely | Every law |

---

## Inlined Protocols

**Bug Comorbidity** and **System Ops** are now INLINED in `APEX_v7.md`.

No need to load separate skill files for:
- Bug fixing / debugging
- Service restarts / gateway operations

---

## Specialized Skills (Manual Load Only)

For specialized tasks, load from `~/clawd/apex-vault/apex/skills/*/COMPACT.md`:

| Skill | Load When |
|-------|-----------|
| security-guard | Security audit requested |
| apex-design | UI/design work |
| project-audit | Full project audit |
| building-agents | Creating new agents |

---

## Autonomy (Conservative)

Liam runs as a service. Be MORE careful than Cursor.

| Action | Autonomy |
|--------|----------|
| Read/search | Full |
| Edit code | Full (verify first) |
| **Restart/stop** | **ALWAYS ASK** |
| **Gateway ops** | **ALWAYS ASK** |
| External API | **ALWAYS ASK** |

---

## Files to Track

| File | Purpose |
|------|---------|
| `~/clawd/FRUSTRATION-LOG.md` | Your observations |
| `~/clawd/diagnostics/FRUSTRATION-PATTERNS.md` | Cursor's analysis |
| `~/clawd/diagnostics/COST-TRACKING.md` | Cost tracking |

---

## Validation

APEX v7 is in validation phase. Track:
- Frustration patterns (should decrease)
- Compliance observations
- Functionality (should be same or better)

Rollback available: `~/clawd/apex-vault/APEX_COMPACT_v6.3.3.md.backup`

---

*APEX v7.1 (Liam Integration) - Research-backed design, pattern tracking*
*Based on: IFScale benchmark, 12 frustration patterns, $500-900 waste analysis*
