# Supervisor Skill

**Purpose:** Quality validation and anti-hallucination gate for Liam's outputs.

## Overview

The Supervisor is a read-only agent that validates Liam's outputs before delivery. It catches hallucinated file paths, security issues, breaking changes, and APEX violations.

## Three-Tier System

### Tier 1: Pre-flight Checks (Always-on)

**Model:** `flash` (glm-4.7-flash)
**Latency:** ~2-3s
**Trigger:** Every response before delivery

**Checks:**
- Context freshness (files referenced >30 min old?)
- Task classification (is this quality-critical?)
- Tool availability (required tools accessible?)
- Goal drift detection (does response match original request?)

### Tier 2: Quality Gate (On-demand)

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

### Tier 3: Periodic Audit (Cron)

**Model:** `audit` (minimax-m2.1:cloud)
**Schedule:** Hourly during active hours
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

| Model | Role | Why |
|-------|------|-----|
| MiniMax M2.1 (audit) | Primary Worker (Telegram) | Best finish-rate, 200K context |
| GLM-4.7 (deep) | Quality Gate / Reviewer | Different architecture catches MiniMax blind spots |
| GLM-4.7-flash | Pre-flight | Fast enough, more reliable than lfm2.5 |
| GLM-4.7 (deep) | Subagents | High capability for complex tasks |
| Kimi k2.5 (beta) | Testing Only | Cutting-edge but unstable |

## Cross-Validation Architecture

**Key Insight:** Same model reviewing itself has identical blind spots. Cross-model validation catches more errors.

```
[User Message] → MiniMax M2.1 (primary) → [Draft Response]
                                              ↓
                              GLM-4.7 (reviewer) → [Validated Response]
                                              ↓
                                         [Deliver to User]
```

**Why this works:**
- MiniMax excels at task completion (best finish-rate)
- GLM excels at reasoning and catching errors (preserved thinking)
- Different training data = different blind spots = better coverage

## Usage

The supervisor runs automatically via the Proactive Review system. Manual invocation:

```
# Quality gate check
Use supervisor agent to validate [output] before sending

# Periodic audit
Run supervisor audit on recent session quality
```

---

*Supervisor Skill v1.0 | APEX v6.2.0 Compliant | January 28, 2026*
