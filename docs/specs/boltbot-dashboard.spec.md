# Specification: Boltbot Dashboard

> Use `/duy-workflow:execute docs/specs/boltbot-dashboard.spec.md` to implement.

## Goal

Rebuild the Boltbot audit dashboard as a Vite + React static SPA served from the gateway at `/boltbot/dashboard`, wired to the real Boltbot API, with Boltbot branding.

## Requirements

1. **[REQ-1] Vite + React SPA scaffold**
   - Replace the existing Next.js frontend with a Vite + React + TypeScript project at `extensions/boltbot/dashboard/`
   - Configure `base: '/boltbot/dashboard/'` so all assets resolve correctly when served from the gateway
   - Use Tailwind CSS for styling (dark theme, matching current design)
   - Build output: `extensions/boltbot/dashboard/dist/`
   - Acceptance: `pnpm --filter boltbot-dashboard build` produces a working static bundle

2. **[REQ-2] Gateway static file serving**
   - Register HTTP routes in the Boltbot plugin to serve the dashboard's `dist/` directory at `/boltbot/dashboard/*`
   - Catch-all returns `index.html` for client-side navigation
   - Acceptance: Navigating to `http://localhost:18789/boltbot/dashboard` loads the SPA

3. **[REQ-3] Real API integration**
   - Remove all mock data. Fetch from the real Boltbot API endpoints:
     - `GET /boltbot/stats` → `{ total, byTier: { low, medium, high }, anomalyCount }`
     - `GET /boltbot/receipts?limit=50&offset=0` → `{ receipts: ActionReceipt[] }`
     - `GET /boltbot/receipt?id=<uuid>` → `{ receipt: ActionReceipt }`
   - TypeScript types must match the real `ActionReceipt` interface from `extensions/boltbot/src/receipt-store.ts`:
     - `id, timestamp, sessionKey, tier, toolName, argumentsHash, resultHash, success, durationMs, anomalies: string[], daCommitment?: string`
   - Use SWR with 10-second polling for stats and receipts
   - Acceptance: Dashboard displays real receipts from the running gateway

4. **[REQ-4] Boltbot branding**
   - Replace Finbro logo and branding with "Boltbot" text/logo
   - Keep the layout shell (header + sidebar) but rebrand all instances
   - Header: "Boltbot" logo/text, remove user dropdown (no auth yet)
   - Sidebar: Dashboard (active), Audit Log, Sessions (links can be non-functional placeholders)
   - Acceptance: No Finbro references remain. "Boltbot" appears in header and page title

5. **[REQ-5] Stats summary**
   - Display cards showing: total action count, count per tier (low/medium/high), anomaly count
   - Color-coded: low=green, medium=yellow, high=red
   - Skeleton loading state while fetching
   - Acceptance: Stats cards render with real data from `/boltbot/stats`

6. **[REQ-6] Receipt list with filtering**
   - Table rows: toolName, tier (color badge), relative timestamp, success (icon), anomaly indicator
   - Offset-based pagination: "Load more" fetches next 50 (offset += 50), appends to list
   - Client-side filters:
     - Tier: multi-select (low/medium/high)
     - Anomaly toggle: show only receipts where `anomalies.length > 0`
   - Filters compose (e.g. "high tier with anomalies")
   - Preserve scroll position and filters across 10-second polls
   - Acceptance: Filtering, pagination, and polling all work without losing state

7. **[REQ-7] Receipt detail panel**
   - Click a row to open a slide-out detail panel (right side)
   - Default view (always visible):
     - toolName, tier badge, success/failure badge
     - Relative timestamp + full ISO 8601
     - Duration (human-readable, e.g. "142ms")
     - sessionKey
     - Anomaly labels (each as a distinct colored label; empty = "Clean")
   - Collapsible accordion sections (default collapsed):
     - **Hashes**: argumentsHash, resultHash (full 64-char hex, copy button)
     - **EigenDA Verification**: daCommitment hex (copyable), link to verify on-chain if present, "Unverified" if absent
     - **TEE Attestation**: placeholder section — text "TEE attestation verification coming soon"
   - Dismiss via close button, Escape key, or backdrop click. Preserves list scroll/filters.
   - Acceptance: Detail panel opens with all fields, accordions expand/collapse, copy works

8. **[REQ-8] Session grouping view**
   - Group receipts by `sessionKey` to show per-conversation audit trails
   - UI: a toggle or tab to switch between "All Receipts" (flat list) and "By Session" (grouped)
   - Each session group shows: sessionKey, receipt count, latest timestamp, tier breakdown
   - Clicking a session group expands to show its receipts (same row format as flat list)
   - Acceptance: Receipts are correctly grouped by sessionKey

9. **[REQ-9] Error handling**
   - If a fetch fails, show an inline error on the affected section (stats or receipts). Don't break the rest.
   - API returns `{"error": "not_found"}` (404) or `{"error": "missing_id"}` (400) for bad receipt lookups — display a user-friendly message.
   - Acceptance: Intentionally failed requests show error state without crashing

10. **[REQ-10] Auth stub**
    - No authentication implemented
    - All sessions visible (operator view for now)
    - Add a `// TODO: Telegram OAuth — filter receipts by authenticated user's sessionKey` comment in the data-fetching layer
    - Acceptance: Comment exists, no auth code

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | Vite + React + TypeScript | Static SPA, no SSR needed. Fast builds, small bundle. |
| Serving | Gateway registerHttpRoute | Same origin, single container, no CORS. |
| Data fetching | SWR | Already used in current frontend. Polling + caching built in. |
| Pagination | Offset-based | Matches real API (`?limit=50&offset=0`). |
| Styling | Tailwind CSS (dark theme) | Matches existing design. |
| Auth | Deferred | Stub only. Telegram OAuth planned for future. |
| Advanced detail | Accordion sections | Hashes, EigenDA, TEE info collapsed by default. |

## Progress

| ID | Status | Notes |
|----|--------|-------|
| REQ-1 | COMPLETED | Vite + React + TS scaffold at dashboard/ |
| REQ-2 | COMPLETED | dashboard-serve.ts registered in index.ts |
| REQ-3 | COMPLETED | SWR hooks fetch real API, response shapes matched |
| REQ-4 | COMPLETED | Boltbot branding, no Finbro references |
| REQ-5 | COMPLETED | StatsCards with skeleton/error states |
| REQ-6 | COMPLETED | ReceiptList with tier/anomaly filters, pagination |
| REQ-7 | COMPLETED | ReceiptDetail with accordions (hashes, EigenDA, TEE) |
| REQ-8 | COMPLETED | SessionView groups by sessionKey |
| REQ-9 | COMPLETED | Inline errors per section |
| REQ-10 | COMPLETED | Auth TODO comment in hooks.ts |

## Completion Criteria

- [x] All REQs implemented
- [x] `pnpm --filter boltbot-dashboard build` succeeds (228KB JS, 19KB CSS)
- [ ] Dashboard loads at `/boltbot/dashboard` when gateway is running
- [ ] Real API data renders (stats, receipts, detail)
- [x] No Finbro references remain
- [x] No mock data remains

## Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| No receipts yet | Empty state message: "No actions recorded yet" |
| All receipts are low tier (not logged) | Stats show 0, empty receipt list with explanation |
| daCommitment absent | Detail shows "Unverified — no DA commitment" |
| API unreachable | Inline error per section, previous data preserved |
| Very long anomaly list | Scroll within anomaly label area |
| Receipt deleted between list and detail fetch | Use list data (already loaded), no re-fetch needed |

## Technical Context

### Key Files

- `extensions/boltbot/index.ts`: Plugin entry — add dashboard route registration here
- `extensions/boltbot/src/api.ts`: Existing HTTP API routes (`/boltbot/stats`, `/boltbot/receipts`, `/boltbot/receipt`)
- `extensions/boltbot/src/receipt-store.ts`: `ActionReceipt` interface — source of truth for types
- `extensions/boltbot/src/action-tiers.ts`: Tier classification (HIGH/MEDIUM/LOW)
- `extensions/boltbot/src/anomaly.ts`: Anomaly detection logic
- `extensions/boltbot/src/stores/local.ts`: SQLite receipt store
- `extensions/boltbot/src/stores/eigenda.ts`: EigenDA commitment store
- `extensions/boltbot/dashboard/` *(to be created)*: Vite + React SPA

### Patterns to Follow

- Moltbot uses ESM (`"type": "module"`) throughout
- Plugin HTTP routes use `api.registerHttpRoute(method, path, handler)`
- Existing API responses use `{ receipts: [...] }`, `{ receipt: {...} }`, `{ total, byTier, anomalyCount }`
- Dark theme with Tailwind: bg-neutral-950, border-neutral-800, text-neutral-100
- Use `Space Grotesk` font (already loaded in current frontend)

### Files to Modify

- `extensions/boltbot/index.ts` — register dashboard static serving routes
- `extensions/boltbot/package.json` — add dashboard build script + devDependencies (vite, react, tailwind)

### Files to Create

- `extensions/boltbot/dashboard/` — entire Vite + React SPA (vite.config.ts, index.html, src/*, etc.)

### Files to Delete

- `extensions/boltbot/frontend/` — remove the existing Next.js app entirely
