# PR Thunderdome Pitch

## The Pitch (Copy-Paste Ready)

---

**PR**: https://github.com/openclaw/openclaw/pull/[NUMBER]
**Branch**: `web4-governance-complete`

**What it fixes**: Zero accountability for agent actions. Currently no audit trail, no policy gates, no way to answer "what did the agent do and why?"

**Who it helps**:
- Enterprise users who can't deploy without audit trails (healthcare, finance, gov)
- Teams debugging "what changed and why?"
- Anyone wanting to block destructive commands before execution
- Moltbook — 30k agents creating religions and memecoins with zero governance

**Why ship now**: Moltbook just went viral. Agents are acting autonomously at scale. The governance gap is no longer theoretical — it's happening live. This is the missing infrastructure.

**What it is**:
- Hook-based plugin (uses existing `pre_tool_use`/`post_tool_use`)
- R6 audit trail with hash-linked provenance
- Policy engine: allow/deny/warn with presets (permissive, safety, strict)
- Zero core changes, opt-in, observational by default

**Tests**: 75+ passing
**Docs**: Full README, ARCHITECTURE.md
**Prior art**: Same framework running in production elsewhere

**Not claiming**: This doesn't make agents "safe" — just inspectable, accountable, governable. Honest scope.

---

## Notes

- Adjust PR number once we open/reopen upstream PR
- Keep it under 200 words for thunderdome scanning
- Lead with the Moltbook angle — that's the hook right now
- "Honest scope" line preempts skepticism
