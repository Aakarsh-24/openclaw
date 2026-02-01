# Smart Query Routing v2.0

*Inspired by OpenClaw SMRP + instant ack differentiator*

## Features

| Feature | Description | Latency |
|---------|-------------|---------|
| **Prefix Override** | `!flash`, `sonnet:`, `research:` force model | 0ms |
| **Rules Engine** | Regex patterns for trivial/commands | 0ms |
| **Category Detection** | Keyword matching (frontend, debugging, etc.) | 0ms |
| **Usage Tracking** | Daily limits per model with auto-fallback | 0ms |
| **LLM Router** | Gemini Flash Lite for ambiguous queries | ~200ms |
| **Instant Ack** | Immediate feedback before full response | 0ms |

## Architecture

```
User Message
    ↓
┌─────────────────────────────────────────────┐
│ PHASE 0: PREFIX OVERRIDE                    │
│ !flash, sonnet:, opus:, research: → model   │
│ Strips prefix, returns forced model         │
└─────────────────────────────────────────────┘
    ↓ (no prefix)
┌─────────────────────────────────────────────┐
│ PHASE 1: RULES ENGINE                       │
│ - Trivial patterns → direct answer          │
│ - Slash commands → skip routing             │
│ - Length heuristics                         │
└─────────────────────────────────────────────┘
    ↓ (no rule match)
┌─────────────────────────────────────────────┐
│ PHASE 2: CATEGORY DETECTION                 │
│ Keywords: react, debug, write, latest...    │
│ Categories → Tier → Model                   │
└─────────────────────────────────────────────┘
    ↓ (no category match)
┌─────────────────────────────────────────────┐
│ PHASE 3: LLM ROUTER                         │
│ Gemini Flash Lite classifies ambiguous      │
│ Returns tier + contextual ack               │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ QUOTA CHECK                                 │
│ If model at daily limit → use fallback      │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│ ACK + DISPATCH                              │
│ Telegram/Discord: edit-in-place             │
│ iMessage/WhatsApp: separate message         │
└─────────────────────────────────────────────┘
```

## Prefix Overrides

Force a specific model by prefixing your message:

| Prefix | Model | Use Case |
|--------|-------|----------|
| `!flash` / `flash:` | gemini-2.0-flash-lite | Quick, cheap |
| `!pro` / `pro:` | gemini-2.5-flash | Balanced |
| `!sonnet` / `sonnet:` | claude-sonnet-4-5 | Complex coding |
| `!opus` / `opus:` | claude-opus-4-5 | Creative/critical |
| `!haiku` / `haiku:` | claude-haiku-4-5 | Fast Claude |
| `!research` / `research:` | perplexity/sonar-pro | Web search |

Example: `sonnet: help me refactor this React component`

## Categories

| Category | Keywords | Tier | Default Model |
|----------|----------|------|---------------|
| frontend | react, vue, css, ui, component | TIER2 | Flash |
| backend | api, database, server, python | TIER3 | Sonnet |
| architecture | system design, scale, infra | TIER4 | Opus |
| debugging | debug, fix, bug, error, crash | TIER3 | Sonnet |
| creative | write, story, poem, letter | TIER4 | Opus |
| coding | function, implement, refactor | TIER3 | Sonnet |
| research | latest, news, today, search | RESEARCH | Perplexity |
| simple | translate, weather, time | TIER1 | Flash Lite |

## Tier Definitions

| Tier | Model | Ack | Use Case |
|------|-------|-----|----------|
| TIER0_TRIVIAL | flash-lite | (direct answer) | Greetings, thanks |
| TIER1_ROUTINE | flash-lite | "One sec..." | Simple lookups |
| TIER2_STANDARD | flash | "Looking into that..." | Q&A, summaries |
| TIER3_COMPLEX | sonnet | "Working on it..." | Coding, analysis |
| TIER4_CRITICAL | opus | "Let me think..." | Creative, important |
| TIER_RESEARCH | perplexity | "Searching..." | Web search needed |

## Usage Tracking

Daily limits prevent runaway costs:

```json
{
  "google/gemini-2.5-flash": { "dailyLimit": 500 },
  "anthropic/claude-opus-4-5": { "dailyLimit": 50 },
  "anthropic/claude-sonnet-4-5": { "dailyLimit": 200 },
  "perplexity/sonar-pro": { "dailyLimit": 100 }
}
```

When a model hits its limit, the router automatically falls back:
- Opus → Sonnet → Flash
- Sonnet → Flash → Haiku
- Research → Flash

Usage resets daily. Stats stored in `~/.clawdbot/usage-stats.json`.

## Escalation (Future)

When a task fails twice at a tier, auto-escalate:

```
TIER1 → TIER2 → TIER3 → TIER4
```

## Config File

All routing behavior is driven by `routing-rules.json`:

```json
{
  "prefixOverrides": { "!flash": "model/id", ... },
  "usageLimits": { "model/id": { "dailyLimit": N }, ... },
  "categories": { "name": { "patterns": [...], "tier": "TIER_X" }, ... },
  "rules": [ { "pattern": "...", "tier": "...", "directAnswer": "..." }, ... ],
  "tiers": { "TIER_X": { "model": "...", "ack": "...", "fallback": [...] }, ... },
  "escalation": { "enabled": true, "failuresBeforeEscalate": 2 },
  "ackBehavior": { "editInPlace": ["telegram"], "separateMessages": ["imessage"] }
}
```

## Security

**Keys are NEVER in config or code:**
- Router reads `GEMINI_API_KEY` from environment
- Gateway resolves model → provider → key at runtime
- Config uses model IDs only, not credentials

**Pre-commit checks:**
```bash
# Must pass before any PR - search for common API key patterns
# Example patterns: Google AI keys, OpenAI keys, Bearer tokens
grep -rE "(A]Iza|sk[-]|Bearer [A-Za-z0-9])" . && echo "FAIL" || echo "OK"
```

## Testing

```bash
# Prefix override
./smart-router.sh "!flash hello world"
# → {"model": "gemini-2.0-flash-lite", "source": "prefix:!flash"}

# Trivial (direct answer)
./smart-router.sh "thanks!"
# → {"tier": "TIER0_TRIVIAL", "directAnswer": "You're welcome!"}

# Category detection
./smart-router.sh "debug this error"
# → {"tier": "TIER3_COMPLEX", "model": "sonnet", "category": "debugging"}

# LLM fallback
./smart-router.sh "explain quantum entanglement"
# → {"tier": "TIER2_STANDARD", "model": "flash", "ack": "...", "source": "llm"}
```

## Comparison with OpenClaw

| Feature | OpenClaw SMRP | Our Implementation |
|---------|---------------|-------------------|
| Prefix overrides | ✅ `!kimi`, `flash:` | ✅ `!flash`, `sonnet:` |
| Category detection | ✅ ModelExperience | ✅ Config-driven keywords |
| Usage tracking | ✅ Per model/day | ✅ Per model/day |
| Model learning | ✅ Score adjustment | ❌ Not yet |
| Instant ack | ❌ | ✅ **Our differentiator** |
| Edit-in-place | ❌ | ✅ Telegram/Discord |
| Rules engine | ❌ | ✅ Regex pre-filter |
| Config-driven | Partial | ✅ Fully in JSON |

## Files

- `src/agents/smart-router.ts` — Main router class
- `src/agents/routing-config.ts` — Types and default configuration
- `src/agents/usage-tracker.ts` — Daily usage tracking
- `src/agents/smart-router.test.ts` — Test suite
- `~/.openclaw/usage-stats.json` — Runtime usage data (auto-created)

## Gateway Integration (TODO)

For full integration, the gateway needs:

1. **Pre-routing hook** — Call router before main model
2. **Ack dispatch** — Send ack message, capture ID
3. **Edit support** — Update ack with full response
4. **Prefix stripping** — Remove `!flash` etc from prompt sent to model
5. **Usage increment** — Track after successful response
