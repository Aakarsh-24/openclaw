# End-to-End Testing Guide

> **Purpose**: Patterns for writing E2E tests in clawdbot.
> **Source of truth**: `test/gateway.multi.e2e.test.ts` - explore this file for current implementations.

## Explore First

Before starting, check current state locally:

| Concern | Where to look |
|---------|---------------|
| E2E config | `vitest.e2e.config.ts` |
| E2E test examples | `test/**/*.e2e.test.ts` |
| Test isolation setup | `test/setup.ts` |
| Gateway test helpers | `src/gateway/test-helpers.ts` |
| Live test examples | `src/**/*.live.test.ts` |

---

## Configuration

| File | Purpose |
|------|---------|
| `vitest.e2e.config.ts` | E2E test config |
| `test/setup.ts` | Global setup (temp HOME isolation) |
| `test/gateway.multi.e2e.test.ts` | Main E2E test - reference implementation |

### Run E2E Tests

```bash
pnpm test:e2e
```

### E2E vs Unit Tests

| Aspect | Unit Tests | E2E Tests |
|--------|-----------|-----------|
| Location | `src/**/*.test.ts` | `test/**/*.e2e.test.ts` |
| Config | `vitest.config.ts` | `vitest.e2e.config.ts` |
| Isolation | Mocked dependencies | Real processes |
| Speed | Fast (ms) | Slow (seconds) |
| Timeout | Default 10s | Extended 120s |

---

## Core E2E Patterns

> These patterns are extracted from `test/gateway.multi.e2e.test.ts`.
> Check that file for the current implementation - signatures may evolve.

### Pattern 1: Ephemeral Port Allocation

```typescript
const getFreePort = async () => {
  const srv = net.createServer();
  await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
  const addr = srv.address();
  if (!addr || typeof addr === "string") {
    srv.close();
    throw new Error("failed to bind ephemeral port");
  }
  await new Promise<void>((resolve) => srv.close(() => resolve()));
  return addr.port;
};
```

### Pattern 2: Port Readiness Polling

```typescript
const waitForPortOpen = async (
  proc: ChildProcessWithoutNullStreams,
  port: number,
  timeoutMs: number,
) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (proc.exitCode !== null) {
      throw new Error(`process exited before listening`);
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = net.connect({ host: "127.0.0.1", port });
        socket.once("connect", () => { socket.destroy(); resolve(); });
        socket.once("error", reject);
      });
      return;
    } catch {
      await sleep(25);
    }
  }
  throw new Error(`timeout waiting for port ${port}`);
};
```

### Pattern 3: Process Spawning with Isolation

```typescript
const spawnGatewayInstance = async (name: string): Promise<GatewayInstance> => {
  const port = await getFreePort();

  // Create isolated HOME directory
  const homeDir = await fs.mkdtemp(
    path.join(os.tmpdir(), `clawdbot-e2e-${name}-`),
  );

  // Create config in isolated HOME
  const configDir = path.join(homeDir, ".clawdbot");
  await fs.mkdir(configDir, { recursive: true });

  // Spawn with isolated environment
  const child = spawn("bun", ["src/index.ts", "gateway", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: homeDir,
      // See Environment Variables section for full list
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Capture stdout/stderr for debugging
  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout?.on("data", (d) => stdout.push(String(d)));
  child.stderr?.on("data", (d) => stderr.push(String(d)));

  await waitForPortOpen(child, port, GATEWAY_START_TIMEOUT_MS);
  return { name, port, homeDir, child, stdout, stderr };
};
```

### Pattern 4: Graceful Cleanup

```typescript
const stopGatewayInstance = async (inst: GatewayInstance) => {
  // Try SIGTERM first
  if (inst.child.exitCode === null && !inst.child.killed) {
    inst.child.kill("SIGTERM");
  }

  // Wait for graceful exit
  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      if (inst.child.exitCode !== null) return resolve(true);
      inst.child.once("exit", () => resolve(true));
    }),
    sleep(5_000).then(() => false),
  ]);

  // Force kill if needed
  if (!exited && inst.child.exitCode === null) {
    inst.child.kill("SIGKILL");
  }

  // Clean up temp directory
  await fs.rm(inst.homeDir, { recursive: true, force: true });
};

// Register cleanup in afterAll
describe("e2e tests", () => {
  const instances: GatewayInstance[] = [];

  afterAll(async () => {
    for (const inst of instances) {
      await stopGatewayInstance(inst);
    }
  });
});
```

### Pattern 5: CLI JSON Output Testing

```typescript
const runCliJson = async (args: string[], env: NodeJS.ProcessEnv): Promise<unknown> => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const child = spawn("bun", ["src/index.ts", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (d) => stdout.push(String(d)));
  child.stderr?.on("data", (d) => stderr.push(String(d)));

  const result = await new Promise((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );

  if (result.code !== 0) {
    throw new Error(`cli failed: ${stderr.join("")}`);
  }

  return JSON.parse(stdout.join("").trim());
};

// Usage
const health = await runCliJson(
  ["health", "--json", "--timeout", "10000"],
  { CLAWDBOT_GATEWAY_PORT: String(port) }
);
expect(health.ok).toBe(true);
```

---

## Environment Variables for E2E

See `test/gateway.multi.e2e.test.ts` for the full current list. Common ones:

| Variable | Purpose |
|----------|---------|
| `HOME` | Isolated home directory |
| `CLAWDBOT_CONFIG_PATH` | Config file location |
| `CLAWDBOT_STATE_DIR` | State directory |
| `CLAWDBOT_GATEWAY_TOKEN` | Auth token (empty for no auth) |
| `CLAWDBOT_SKIP_PROVIDERS` | Skip provider initialization |
| `CLAWDBOT_SKIP_BROWSER_CONTROL_SERVER` | Skip browser server |
| `CLAWDBOT_SKIP_CANVAS_HOST` | Skip canvas host |
| `CLAWDBOT_ENABLE_BRIDGE_IN_TESTS` | Enable bridge for testing |

---

## Debugging E2E Tests

### Capture Output

```typescript
const stdout: string[] = [];
const stderr: string[] = [];
child.stdout?.on("data", (d) => stdout.push(String(d)));
child.stderr?.on("data", (d) => stderr.push(String(d)));

// On failure, log captured output
console.log("stdout:", stdout.join(""));
console.log("stderr:", stderr.join(""));
```

### Increase Timeout

```typescript
it("slow test", { timeout: 300_000 }, async () => {
  // 5 minute timeout
});
```

### Keep Instance Running

Comment out cleanup in `afterAll` to inspect state:

```typescript
afterAll(async () => {
  // Temporarily disabled for debugging
  // for (const inst of instances) {
  //   await stopInstance(inst);
  // }
  console.log("Instances still running:", instances.map(i => i.port));
});
```
