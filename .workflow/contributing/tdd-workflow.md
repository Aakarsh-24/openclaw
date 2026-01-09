# Test-Driven Development Workflow

> **Purpose**: Guide for contributing to clawdbot using TDD practices.
> This repo is synced with upstream - explore locally, this doc provides patterns.

## Explore First

Before starting, check current state locally (synced from upstream):

| Concern | Where to look |
|---------|---------------|
| Test config & thresholds | `vitest.config.ts` |
| Test commands | `package.json` scripts section |
| Test helpers | `src/**/test-helpers.ts`, `test/mocks/` |
| Existing test patterns | `src/**/*.test.ts` (colocated with source) |
| E2E examples | `test/**/*.e2e.test.ts` |
| Coding standards | `CLAUDE.md` (root) |

---

## Testing Framework

- **Framework**: Vitest with V8 coverage (`vitest.config.ts`)
- **Coverage thresholds**: 70% lines/functions/statements, 55% branches
- **Test location**: Colocated as `*.test.ts` next to source files
- **Global setup**: `test/setup.ts` provides isolated temp HOME

### Test Commands (from `package.json`)

```bash
pnpm test              # Vitest in watch mode (default)
pnpm test:coverage     # Single run with coverage report
pnpm test:e2e          # E2E tests only
pnpm test:live         # Live API tests (requires env vars)
```

### Test Helpers Available

| Helper | Import | Purpose |
|--------|--------|---------|
| Gateway hooks | `src/gateway/test-helpers.ts` | `installGatewayTestHooks()`, mocks for bridge/cron/tailnet |
| Server + client | `src/gateway/test-helpers.ts` | `startServerWithClient()`, `rpcReq()` |
| Port utilities | `src/gateway/test-helpers.ts` | `getFreePort()`, `occupyPort()` |
| Baileys mock | `test/mocks/baileys.ts` | `createMockBaileys()` for WhatsApp |
| Typing mock | `src/auto-reply/reply/test-helpers.ts` | `createMockTypingController()` |

---

## TDD Cycle: Red-Green-Refactor

### Step 1: RED - Write Failing Test

Create test file colocated with future source:

```typescript
// src/my-feature.test.ts
import { describe, expect, it } from "vitest";

describe("myFeature", () => {
  it("should transform input correctly", async () => {
    // This import will fail - that's RED
    const { myFeature } = await import("./my-feature.js");

    const result = myFeature("input");

    expect(result).toBe("expected output");
  });
});
```

Run: `pnpm test src/my-feature.test.ts`

### Step 2: GREEN - Minimal Implementation

```typescript
// src/my-feature.ts
export function myFeature(input: string): string {
  return "expected output"; // Minimal to pass
}
```

### Step 3: REFACTOR - Improve with Confidence

With tests passing, improve implementation:

```typescript
// src/my-feature.ts
export function myFeature(input: string): string {
  // Real implementation
  return input.toUpperCase().trim();
}
```

Update test to match real behavior:

```typescript
expect(myFeature("  hello  ")).toBe("HELLO");
```

---

## Patterns from Codebase

### Unit Test Pattern (from `src/polls.test.ts`)

```typescript
import { describe, expect, it } from "vitest";
import { normalizePollInput } from "./polls.js";

describe("polls", () => {
  it("normalizes question/options and validates maxSelections", () => {
    expect(normalizePollInput({
      question: "Test?",
      options: ["A", "B"],
    })).toEqual({
      question: "Test?",
      options: ["A", "B"],
      maxSelections: 1,
    });
  });
});
```

### Integration Test with Mocks (from `src/telegram/send.test.ts`)

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks survive module mocking
const hoisted = vi.hoisted(() => ({
  sendMessageMock: vi.fn(),
}));

vi.mock("grammy", () => ({
  Bot: class {
    api = { sendMessage: hoisted.sendMessageMock };
  },
}));

describe("telegram send", () => {
  beforeEach(() => {
    hoisted.sendMessageMock.mockClear();
  });

  it("sends message via bot API", async () => {
    hoisted.sendMessageMock.mockResolvedValueOnce({ message_id: 42 });

    // Test implementation...

    expect(hoisted.sendMessageMock).toHaveBeenCalledWith(
      "chat-id",
      "Hello",
      expect.any(Object)
    );
  });
});
```

### Gateway Integration Test (from `src/gateway/server.sessions.test.ts`)

```typescript
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  installGatewayTestHooks,
  startServerWithClient,
  rpcReq,
  connectOk,
} from "./test-helpers.js";

describe("gateway sessions", () => {
  installGatewayTestHooks();

  it("lists sessions via RPC", async () => {
    const { server, ws } = await startServerWithClient();
    try {
      await connectOk(ws);

      const res = await rpcReq(ws, "sessions.list", {
        includeGlobal: false,
      });

      expect(res.ok).toBe(true);
      expect(res.payload).toHaveProperty("sessions");
    } finally {
      ws.close();
      await server.close();
    }
  });
});
```

### Live Test Pattern (from `src/agents/zai.live.test.ts`)

```typescript
const API_KEY = process.env.ZAI_API_KEY ?? "";
const LIVE = process.env.ZAI_LIVE_TEST === "1" || process.env.LIVE === "1";

// Skip unless explicitly enabled
const describeLive = LIVE && API_KEY ? describe : describe.skip;

describeLive("zai live", () => {
  it("returns assistant text", async () => {
    const result = await callRealApi(API_KEY);
    expect(result.text.length).toBeGreaterThan(0);
  }, 20_000); // Extended timeout for real API
});
```

---

## TDD for Bug Fixes

1. **Reproduce**: Write test that fails with current code
2. **Verify RED**: Ensure test fails for the right reason
3. **Fix**: Implement minimal fix
4. **Verify GREEN**: Test passes
5. **Commit**: Include both test and fix

```bash
scripts/committer "fix: handle empty input in myFeature" \
  src/my-feature.ts \
  src/my-feature.test.ts
```

---

## TDD for New Features

1. **Outline**: Write `it.todo()` tests for expected behavior
2. **Implement incrementally**: One test at a time
3. **Refactor**: Clean up once all tests pass

```typescript
describe("newFeature", () => {
  it.todo("handles basic input");
  it.todo("validates required fields");
  it.todo("returns error for invalid input");
  it.todo("integrates with existing system");
});
```

---

## Quality Checklist

Before committing:

- [ ] All tests pass: `pnpm test --run`
- [ ] Coverage maintained: `pnpm test:coverage`
- [ ] Lint passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`
- [ ] Used `scripts/committer` for commit

---

## Watch Mode for TDD

For the core TDD feedback loop, add to `package.json`:

```json
{
  "scripts": {
    "test:watch": "vitest --watch",
    "test:watch:ui": "vitest --ui",
    "test:related": "vitest --watch --changed"
  }
}
```

- `test:watch` - Re-runs on file changes
- `test:watch:ui` - Browser UI for test results
- `test:related` - Only tests affected by changes
