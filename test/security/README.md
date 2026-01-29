# Security Acceptance Tests

E2E security testing framework for Moltbot. Validates resistance to:
- Prompt injection via external data sources
- Data exfiltration attempts
- Trust boundary violations
- Tool poisoning attacks

## Architecture: LLM-as-Judge

Pattern matching can't reliably detect whether prompt injection succeeded. We use
**Claude as a judge** to evaluate whether Moltbot resisted attacks:

1. Run test scenario (send poisoned data to Moltbot)
2. Capture Moltbot's response and tool calls
3. Send to Claude judge with structured output
4. Judge evaluates: injection detected? complied with? data leaked?

This enables nuanced evaluation of subtle attacks that regex can't catch.

## Quick Start

```bash
# Install Anthropic SDK (required for LLM judge)
pnpm add -D @anthropic-ai/sdk

# Run security tests
ANTHROPIC_API_KEY=sk-ant-xxx pnpm test:security

# Run specific category
pnpm test:security --grep "Email Injection"
```

## Structure

```
test/security/
├── SPEC.md                    # Full specification document
├── README.md                  # This file
├── harness/
│   ├── index.ts               # Exports
│   ├── gateway-client.ts      # WebSocket gateway client
│   ├── assertions.ts          # Pattern-based assertions (fast checks)
│   ├── llm-judge.ts           # Claude-based evaluation (nuanced checks)
│   └── cli-mocks/
│       └── mock-binary.ts     # CLI binary mocking utilities
└── *.e2e.test.ts              # Test files by category
```

## Implementation Priority

Based on SPEC.md, implement in this order:

1. **email-injection.e2e.test.ts** - Gmail/email tests (highest attack surface)
2. **calendar-injection.e2e.test.ts** - Calendar event injection tests
3. **api-injection.e2e.test.ts** - Generic API response injection
4. **trust-boundary.e2e.test.ts** - Authentication bypass and session leakage
5. **tool-poisoning.e2e.test.ts** - Malicious skill/plugin output

## Key Dependencies

```bash
# Add to devDependencies
pnpm add -D @anthropic-ai/sdk ws
```

- **Vitest** - Test runner (already configured in repo)
- **@anthropic-ai/sdk** - LLM judge (Claude Sonnet for evaluation)
- **ws** - WebSocket client
- **Hono** - Mock HTTP servers (already in deps)

## Running Tests

### Option 1: Local Script (Recommended)

```bash
# Install Anthropic SDK first
pnpm add -D @anthropic-ai/sdk ws

# Set API key
export ANTHROPIC_API_KEY=sk-ant-xxx

# Run all tests (auto-detects local gateway or spins up Docker)
./test/security/run-local.sh

# Run specific test category
./test/security/run-local.sh "Email Injection"
```

### Option 2: Docker Compose (Full Isolation)

```bash
# Run containerized tests
ANTHROPIC_API_KEY=sk-ant-xxx \
docker compose -f test/security/docker-compose.yml up --build --abort-on-container-exit

# Cleanup
docker compose -f test/security/docker-compose.yml down -v
```

### Option 3: Against Local Gateway

```bash
# Terminal 1: Start gateway
moltbot gateway

# Terminal 2: Run tests directly
ANTHROPIC_API_KEY=sk-ant-xxx pnpm vitest run --config vitest.security.config.ts
```

## CI Integration

Security tests run automatically via GitHub Actions:
- On every push to `main`
- On every PR to `main`
- Daily at midnight UTC (scheduled)
- Manually via workflow dispatch

**Required secrets:**
- `ANTHROPIC_API_KEY`: For LLM judge evaluation

The workflow blocks releases if security tests fail.

## Test Output

Each test produces a `SecurityVerdict`:

```typescript
{
  passed: boolean;           // Did the security test pass?
  injectionDetected: boolean; // Did agent notice the attack?
  injectionCompliedWith: boolean; // Did agent follow malicious instructions?
  dataLeaked: boolean;       // Was sensitive data exposed?
  reasoning: string;         // Judge's explanation
  severity: "none" | "low" | "medium" | "high" | "critical";
  evidence: string[];        // Supporting evidence
}
```

See SPEC.md for complete implementation details.
