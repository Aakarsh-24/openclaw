# CONTINUITY.md — Exec Events E2E Fix

## Goal
Make exec events (Codex, Claude, etc.) visible in Crabwalk UI as distinct "EXEC" nodes — not "agent" or "chat".

### Success Criteria
1. When Codex runs, Crabwalk shows an "EXEC" labeled node (not "AGENT")
2. Exec events flow: Gateway emits → WebSocket broadcasts → Crabwalk receives → UI renders
3. All changes have test coverage
4. Clean git history with meaningful commits

## Constraints/Assumptions
- Gateway code: `/home/clawdbot/dev/clawdbot-exec-events/`
- Crabwalk code: `/home/clawdbot/apps/crabwalk/`
- Config already has `hooks.exec.emitEvents: true` and whitelist
- Must use test-driven approach

## Key Decisions
1. Rolled back cowboy changes (2026-01-27)
2. Starting fresh with proper beads model

## State

### Done
- [x] Rolled back uncommitted changes
- [x] Created CONTINUITY.md
- [x] **Bead 1: Audit** — Full E2E flow audit complete (see AUDIT_REPORT.md)
- [x] **Bead 2: Add top-level runId** — Commit `e49b41503` (2026-01-27)
  - Added `runId?: string` to ExecEventBase type
  - Updated all 3 emitExecEvent calls to include `runId: execEventsState.context?.runId`
  - Build passes

### Now
- [ ] E2E validation with Crabwalk

### Next
- [ ] Push to GitHub (failed earlier due to token permissions)
- [ ] Add test coverage for top-level runId

## Open Questions (RESOLVED)
- ✅ CONFIRMED: Exec events ARE being emitted (Line 406-408, server.impl.ts)
- ✅ CONFIRMED: Crabwalk HAS distinct ExecNode.tsx component (not reusing AgentNode)
- ✅ CONFIRMED: runId IS required for session linking but optional in Gateway
- ✅ ROOT CAUSE: Gateway sends `context.runId` (nested, optional), Crabwalk expects `exec.runId` (top-level, required)

## Working Set
- Gateway exec emission: `src/agents/bash-tools.exec.ts`
- Gateway broadcast: `src/gateway/server.impl.ts`
- Exec event types: `src/infra/exec-events.ts`
- Crabwalk parser: `/home/clawdbot/apps/crabwalk/src/integrations/clawdbot/parser.ts`
- Crabwalk UI: `/home/clawdbot/apps/crabwalk/src/components/monitor/ExecNode.tsx`
- Crabwalk graph: `/home/clawdbot/apps/crabwalk/src/components/monitor/ActionGraph.tsx`
