# Engineering Execution Spec: groupPolicy Hardening

**Date**: 2026-01-05
**Status**: In Progress
**PR**: #216 (feat/whatsapp-group-policy)

---

## Executive Summary

Self-critique of the `groupPolicy` feature implementation revealed 3 issues and 2 test gaps that need addressing before the PR can be considered production-ready.

---

## Findings Analysis

### [MED] F1: Telegram Group Allowlist Ignores Prefixed IDs

**Location**: `src/telegram/bot.ts:105-128`

**Problem**: The DM allowlist (lines 140-153) accepts both raw IDs (`123456789`) and prefixed IDs (`telegram:123456789`), but the group allowlist only checks raw IDs/usernames.

```typescript
// DM check (correct - supports prefix):
const candidateWithPrefix = `telegram:${candidate}`;
normalizedAllowFrom.some((v) => v === candidateWithPrefix);

// Group check (missing prefix support):
const senderIdAllowed = normalizedAllowFrom.includes(String(senderId));
// ^ Only checks raw ID, not telegram:123456789
```

**Impact**: Users who configure `allowFrom: ["telegram:123456789"]` will find:
- DMs work correctly
- Group messages get blocked (even though sender is in allowlist)

**Fix**: Strip `telegram:` prefix when matching sender IDs in group allowlist.

---

### [LOW] F2: Documentation Contradiction

**Location**: `docs/groups.md:41-43`

**Problem**: The docs state:
> `groupPolicy` is separate from `allowFrom` (which only filters DMs)

But `groupPolicy: "allowlist"` explicitly uses `allowFrom` for group filtering. This is misleading.

**Fix**: Reword to clarify that `allowFrom` is used for:
1. DMs (always, when set)
2. Groups (only when `groupPolicy: "allowlist"`)

---

### [LOW] F3: Zod Schema `.default().optional()` Pattern

**Location**: `src/config/zod-schema.ts:549,580`

**Problem**: Using `GroupPolicySchema.default("open").optional()` may seem redundant.

**Analysis**: This is actually correct behavior:
- `.optional()` - Field can be omitted from input
- `.default("open")` - If omitted, parsing returns "open"

The combination ensures:
- TypeScript type is `"open" | "disabled" | "allowlist" | undefined` for input
- Runtime always resolves to `"open"` if not provided

**Decision**: Keep current implementation - it's correct. Add a code comment explaining the pattern.

---

## Test Gaps

### T1: WhatsApp Wildcard Allowlist Test

**Missing**: Test for `groupPolicy: "allowlist"` with `allowFrom: ["*"]`

The Telegram tests include wildcard coverage, but WhatsApp does not.

---

### T2: Telegram Prefixed ID Test

**Missing**: Test for `groupPolicy: "allowlist"` with `allowFrom: ["telegram:123456789"]`

After fixing F1, need a test to verify prefixed IDs work.

---

## Implementation Phases

### Phase 1: Fix [MED] Telegram Prefixed ID Support

**File**: `src/telegram/bot.ts`
**Lines**: 105-128

**Changes**:
1. Strip `telegram:` prefix when building the normalized allowlist (at pre-computation, not per-message)
2. Update `normalizedAllowFrom` to handle both raw and prefixed formats

**Code**:
```typescript
// Pre-compute: strip telegram: prefix for group matching
const normalizedAllowFrom = (allowFrom ?? []).map((v) => {
  const s = String(v);
  return s.startsWith("telegram:") ? s.slice(9) : s;
});
```

---

### Phase 2: Fix [LOW] Documentation

**File**: `docs/groups.md`
**Lines**: 41-43

**Changes**:
Replace:
> `groupPolicy` is separate from `allowFrom` (which only filters DMs)

With:
> `allowFrom` filters DMs by default. With `groupPolicy: "allowlist"`, it also filters group message senders.

---

### Phase 3: Add Code Comment for Zod Pattern

**File**: `src/config/zod-schema.ts`
**Lines**: 549, 580

**Changes**:
Add comment above `groupPolicy` field:
```typescript
// .default("open") ensures runtime always has a value
// .optional() allows omission in input config
groupPolicy: GroupPolicySchema.default("open").optional(),
```

---

### Phase 4: Add Missing Tests

**File**: `src/web/monitor-inbox.test.ts`

**Add Test**: WhatsApp wildcard allowlist
```typescript
it("allows all group senders with wildcard in groupPolicy allowlist", async () => {
  mockLoadConfig.mockReturnValue({
    whatsapp: {
      allowFrom: ["*"],
      groupPolicy: "allowlist",
    },
    messages: { ... },
  });
  // ... emit group message, verify onMessage called
});
```

**File**: `src/telegram/bot.test.ts`

**Add Test**: Telegram prefixed ID
```typescript
it("matches telegram:-prefixed allowFrom entries in group allowlist", async () => {
  loadConfig.mockReturnValue({
    telegram: {
      groupPolicy: "allowlist",
      allowFrom: ["telegram:123456789"],
      groups: { "*": { requireMention: false } },
    },
  });
  // ... emit group message from user 123456789, verify reply called
});
```

---

### Phase 5: Verification

1. Run `pnpm build` - TypeScript compilation
2. Run `pnpm lint` - Biome linting
3. Run `pnpm test` - All tests (886+)
4. Manual verification of changes

---

### Phase 6: Commit and PR Update

1. Stage changes with `scripts/committer`
2. Push to fork
3. Update PR description with hardening changes

---

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/telegram/bot.ts` | Fix | Strip telegram: prefix in group allowlist |
| `src/config/zod-schema.ts` | Comment | Explain default+optional pattern |
| `docs/groups.md` | Fix | Clarify allowFrom usage with groupPolicy |
| `src/web/monitor-inbox.test.ts` | Test | Add wildcard allowlist test |
| `src/telegram/bot.test.ts` | Test | Add prefixed ID test |

---

## Success Criteria

- [ ] F1: Prefixed IDs work in Telegram group allowlist
- [ ] F2: Docs accurately describe allowFrom behavior
- [ ] F3: Zod pattern has explanatory comment
- [ ] T1: WhatsApp wildcard test exists and passes
- [ ] T2: Telegram prefixed ID test exists and passes
- [ ] All 888+ tests pass
- [ ] Build succeeds
- [ ] Lint passes
- [ ] PR updated with hardening notes

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing configs | Low | Prefix stripping is additive, not breaking |
| Test interference | Low | New tests are isolated |
| Doc changes | None | Documentation only |

---

## Estimated Complexity

- **Phase 1**: Low (3 lines of code change)
- **Phase 2**: Low (2 sentences)
- **Phase 3**: Low (2 line comment)
- **Phase 4**: Medium (2 new tests)
- **Phase 5-6**: Low (standard workflow)

**Total**: ~30 minutes estimated execution time
