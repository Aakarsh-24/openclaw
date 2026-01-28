# Supervisor Skill

**Purpose:** Quality validation and anti-hallucination gate for Liam's outputs.

## Overview

The Supervisor is a read-only agent that validates Liam's outputs before delivery. It supervises **both** communication channels:
- **Telegram** (MiniMax M2.1 primary worker)
- **Discord** (Kimi K2.5 primary worker)

Both channels are reviewed by the same GLM-4.7 supervisor, catching hallucinated file paths, security issues, breaking changes, and APEX violations.

## Three-Tier System

### Tier 1: Pre-flight Checks (PLANNED - Not Yet Implemented)

**Status:** Awaiting upstream moltbot feature (pre-delivery hooks)

**Model:** `flash` (glm-4.7-flash)
**Latency:** ~2-3s
**Trigger:** Every response before delivery

**Checks:**
- Context freshness (files referenced >30 min old?)
- Task classification (is this quality-critical?)
- Tool availability (required tools accessible?)
- Goal drift detection (does response match original request?)

> **Note:** Moltbot currently lacks `response:before-send` hook events. This tier requires upstream feature addition.

### Tier 2: Quality Gate (PLANNED - Not Yet Implemented)

**Status:** Awaiting upstream moltbot feature (pre-delivery hooks)

**Model:** `deep` (zai/glm-4.7)
**Latency:** ~2-3s
**Triggers:**
- Important deliveries (external communications, code changes)
- Subagent output merge
- Overnight build task completion
- User request: "review this before sending"

**Checks:**
- Anti-hallucination: Verify file paths exist, command outputs match claims
- Security scan: No secrets exposed, inputs validated
- Regression guard: Changes don't break existing functionality
- Specification match: Output meets requirements
- Memory poisoning: Shared state validated before write

> **Note:** Moltbot currently lacks `response:before-send` hook events. This tier requires upstream feature addition.

### Tier 3: Periodic Audit (Cron) - ACTIVE

**Status:** Implemented and running

**Model:** Uses supervisor agent's configured model (zai/glm-4.7)
**Schedule:** Every 4 hours
**Trigger:** Cron job

**Reviews:**
- Recent session quality (last 10 interactions)
- Subagent success/failure patterns
- Error clustering and comorbidity detection
- Context rot indicators across sessions
- Token usage efficiency

## Supervisor Agent Configuration

The supervisor agent is configured in `~/.clawdbot/moltbot.json`:

```json
{
  "id": "supervisor",
  "name": "Supervisor",
  "workspace": "/home/liam/clawd",
  "model": {
    "primary": "zai/glm-4.7",
    "fallbacks": ["ollama/minimax-m2.1:cloud"]
  },
  "tools": {
    "allow": ["read", "sessions_list", "sessions_history"],
    "deny": ["exec", "write", "edit", "cron", "gateway", "browser", "memory_write"]
  }
}
```

**Key Restrictions:**
- Cannot write to files
- Cannot write to memory
- Cannot execute commands
- Cannot access messaging channels
- Read-only access to current state

## Escalation Triggers

| Condition | Action |
|-----------|--------|
| 3+ failed attempts | Stop, review approach, suggest alternative |
| Context >60% | Recommend /clear, summarize key points |
| Security-sensitive operation | Block, require explicit confirmation |
| Hallucination detected | Block delivery, report finding |
| Subagent timeout >5 min | Check for deadlock, consider termination |

## Bug Comorbidity Patterns

When supervisor finds an issue, check for related problems:

| If Found | Also Check |
|----------|------------|
| Subagent output wrong | Context overflow, task scoping, model mismatch |
| Hallucinated file path | Other file references, command outputs, link validity |
| Quality degradation | Context rot, token exhaustion, memory poisoning |
| Overnight build failure | PRD ambiguity, test coverage gaps, dependency drift |

## Context Rot Prevention

**Every supervisor evaluation MUST:**
1. Read files fresh - No cached content older than 30 seconds
2. Verify paths exist - Check before referencing any path
3. Timestamp tool outputs - Include execution timestamp
4. Isolate sessions - Start clean each invocation
5. Limit context - Hard cap at 32K tokens

## Model Selection Rationale

| Model | Role | Status |
|-------|------|--------|
| MiniMax M2.1 | Primary Worker (Telegram) | ACTIVE |
| Kimi K2.5 | Primary Worker (Discord) | ACTIVE |
| GLM-4.7 | Supervisor / Periodic Audit | ACTIVE (cron) |
| GLM-4.7-flash | Pre-flight (Tier 1) | PLANNED |
| GLM-4.7 | Quality Gate (Tier 2) | PLANNED |
| GLM-4.7 | Subagents | ACTIVE |

## Dual-Channel Supervision Architecture

**Current Implementation:** Periodic audit (Tier 3) only. Pre-delivery supervision (Tier 1/2) awaiting upstream moltbot hooks.

**Key Insight:** Same model reviewing itself has identical blind spots. Both channels use different primary models, but BOTH are reviewed by GLM-4.7 via periodic audit.

```
TELEGRAM:
[User Message] → MiniMax M2.1 (primary) → [Draft]
                                              ↓
                              GLM-4.7 (supervisor) → [Validated]
                                              ↓
                                         [Deliver]

DISCORD:
[User Message] → Kimi K2.5 (primary) → [Draft]
                                            ↓
                            GLM-4.7 (supervisor) → [Validated]
                                            ↓
                                       [Deliver]
```

**Why this works:**
- MiniMax excels at task completion (best finish-rate on Telegram)
- Kimi excels at extended reasoning (long-form on Discord)
- GLM reviews BOTH - catches blind spots from either model
- Different training data = different blind spots = better coverage

**Supervisor Cron covers BOTH channels:**
- Audits `liam-telegram` sessions (MiniMax M2.1 outputs)
- Audits `liam-discord` sessions (Kimi K2.5 outputs)
- Cross-validates: looks for errors one model caught that the other missed

## Usage

The supervisor currently runs via cron job (every 4 hours). Pre-delivery validation awaits upstream moltbot hooks.

```
# Periodic audit (automatic via cron)
Supervisor reviews last 10 sessions from both channels

# Manual invocation
moltbot cron run supervisor-periodic-audit
```

## Upstream Feature Request

To enable Tier 1/2 supervision, moltbot needs:
- Hook event: `response:before-send` or `message:before-deliver`
- Ability to intercept and optionally block message delivery
- Context passing from agent response to supervisor hook

---

*Supervisor Skill v1.2 | Tier 3 Active, Tier 1/2 Planned | APEX v6.2.0 Compliant | January 28, 2026*
