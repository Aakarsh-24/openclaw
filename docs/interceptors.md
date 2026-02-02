# Interceptors

Interceptors let you hook into the agent execution pipeline at multiple points: mutate messages before the agent processes them (`message.before`), adjust LLM parameters dynamically (`params.before`), mutate tool arguments before execution (`tool.before`), and transform results after completion (`tool.after`). They are independent from hooks and plugins, though plugins will typically use them.

Common uses:

- Enrich or classify incoming messages before the agent sees them
- Dynamically adjust thinking level or reasoning based on message content
- Inject default arguments into specific tools
- Block dangerous tool calls based on custom logic
- Redact sensitive data from tool results
- Log or audit every tool invocation
- Transform tool output before the agent sees it

## How It Works

Every agent run flows through the interceptor pipeline:

```
User message arrives
  -> message.before interceptors (can mutate message text, set metadata tags)
  -> params.before interceptors (can override thinkLevel, reasoningLevel; reads metadata)
  -> Session created with effective parameters
  -> Agent decides to call a tool
    -> tool.before interceptors (can mutate args or block)
      -> Tool executes
    -> tool.after interceptors (can mutate result)
  -> Agent receives the result
```

Interceptors are registered on a **registry** (a simple ordered list). When a tool executes, the adapter queries the registry for matching interceptors, runs them sequentially, and uses the (possibly mutated) output.

## Known Tool Names

The registry validates `toolMatcher` regexes at registration time. If your regex cannot match any known tool name, `registry.add()` throws immediately instead of failing silently at runtime.

The canonical (normalized) tool names are:

| Group | Tool names |
|-------|-----------|
| File system (`group:fs`) | `read`, `write`, `edit`, `apply_patch` |
| Runtime (`group:runtime`) | `exec`, `process` |
| Memory (`group:memory`) | `memory_search`, `memory_get` |
| Web (`group:web`) | `web_search`, `web_fetch` |
| Sessions (`group:sessions`) | `sessions_list`, `sessions_history`, `sessions_send`, `sessions_spawn`, `session_status` |
| UI (`group:ui`) | `browser`, `canvas` |
| Automation (`group:automation`) | `cron`, `gateway` |
| Messaging (`group:messaging`) | `message` |
| Nodes (`group:nodes`) | `nodes` |
| Other | `agents_list`, `image`, `tts` |

Note: `bash` is normalized to `exec` and `apply-patch` to `apply_patch` (see `src/agents/tool-policy.ts`). Plugin-provided tools are not in this list but can still be intercepted — just skip `toolMatcher` validation with a catch-all regex or omit `toolMatcher` entirely.

The full set is defined in `src/interceptors/types.ts` as `KNOWN_TOOL_NAMES`.

## Interceptor Names

| Name | When it runs | What it can do |
|------|-------------|----------------|
| `message.before` | Before the agent processes a message | Mutate message text, set metadata tags |
| `params.before` | After message.before, before session creation | Override thinkLevel, reasoningLevel, temperature |
| `tool.before` | Before the tool executes | Mutate args, block execution |
| `tool.after` | After the tool executes | Mutate the result |

## Types

### Registration

Each interceptor is registered with an `InterceptorRegistration`:

```typescript
import type { InterceptorRegistration } from "../interceptors/index.js";

const registration: InterceptorRegistration<"tool.before"> = {
  id: "my-arg-injector",         // unique identifier
  name: "tool.before",           // which hook point
  priority: 10,                  // higher runs first (default: 0)
  toolMatcher: /^exec$/,         // optional regex filter on tool name (tool events)
  agentMatcher: /^coder$/,       // optional regex filter on agent ID (message/params events)
  handler: (input, output) => {
    // input is read-only context
    // output is mutable — modify it in place
  },
};
```

- `toolMatcher` applies to `tool.before` / `tool.after` — filters by normalized tool name
- `agentMatcher` applies to `message.before` / `params.before` — filters by agent ID

### message.before

**Input** (read-only):

```typescript
type MessageBeforeInput = {
  agentId: string;       // resolved agent ID
  sessionKey?: string;   // session key
  provider: string;      // e.g. "anthropic", "openrouter"
  model: string;         // e.g. "claude-3-5-sonnet"
};
```

**Output** (mutable):

```typescript
type MessageBeforeOutput = {
  message: string;                       // the message text — mutate to change what the agent sees
  metadata: Record<string, unknown>;     // metadata bag — set tags for params.before to read
};
```

### params.before

**Input** (read-only):

```typescript
type ParamsBeforeInput = {
  agentId: string;                       // resolved agent ID
  sessionKey?: string;                   // session key
  message: string;                       // message text (possibly mutated by message.before)
  metadata: Record<string, unknown>;     // metadata from message.before interceptors
};
```

**Output** (mutable):

```typescript
type ParamsBeforeOutput = {
  provider: string;         // current provider (read-only context in v1)
  model: string;            // current model (read-only context in v1)
  thinkLevel?: string;      // override thinking level ("off" | "low" | "medium" | "high")
  reasoningLevel?: string;  // override reasoning level ("off" | "on")
  temperature?: number;     // override temperature (reserved for future use)
};
```

### tool.before

**Input** (read-only):

```typescript
type ToolBeforeInput = {
  toolName: string;    // normalized tool name (e.g. "exec", "read")
  toolCallId: string;  // unique ID for this tool call
};
```

**Output** (mutable):

```typescript
type ToolBeforeOutput = {
  args: Record<string, unknown>;  // tool arguments — mutate to change what the tool receives
  block?: boolean;                // set true to prevent execution
  blockReason?: string;           // reason shown to the agent when blocked
};
```

### tool.after

**Input** (read-only):

```typescript
type ToolAfterInput = {
  toolName: string;    // normalized tool name
  toolCallId: string;  // unique ID for this tool call
  isError: boolean;    // whether the tool threw an error
};
```

**Output** (mutable):

```typescript
type ToolAfterOutput = {
  result: AgentToolResult<unknown>;  // the tool result — replace or mutate
};
```

## Inter-Interceptor Communication

The `metadata` bag on `MessageBeforeOutput` is passed through to `ParamsBeforeInput`. This enables interceptors to communicate across events:

```typescript
// 1. message.before: classify the message
registry.add({
  id: "classifier",
  name: "message.before",
  handler: (_input, output) => {
    const isComplex = output.message.length > 500 || output.message.includes("debug");
    output.metadata.complexity = isComplex ? "high" : "low";
  },
});

// 2. params.before: adjust thinking based on classification
registry.add({
  id: "think-adjuster",
  name: "params.before",
  handler: (input, output) => {
    if (input.metadata.complexity === "high") {
      output.thinkLevel = "high";
    }
  },
});
```

You could also use `message.before` with an async handler that calls a lightweight LLM to classify the request, tags the metadata, and then `params.before` reads those tags to route to different models or adjust parameters.

## Built-in Interceptors

Two interceptors are registered automatically when the global registry is initialized.

### Command Safety Guard

**ID**: `builtin:command-safety-guard`
**Hook**: `tool.before` on `exec`
**Priority**: 100 (runs first)
**Source**: `src/interceptors/builtin/command-safety-guard.ts`

Blocks dangerous bash commands before they execute. Patterns are checked against the command string with quoted strings stripped to reduce false positives.

Blocked categories:

- Filesystem destruction (`rm -rf /`, `rm -rf ~`, `rm *`, `find / -delete`)
- Direct disk operations (`dd`, `mkfs`, `fdisk` on `/dev/*`)
- Permission disasters (`chmod 777`, `chmod 000` on system dirs, `chown -R /`)
- System file corruption (overwriting `/etc/passwd`, `/etc/shadow`, `/etc/sudoers`)
- Remote code execution (`curl | bash`, `wget | sh`)
- Network backdoors (`nc -l -e /bin/bash`)
- Fork bombs (`:(){ :|:& };:`)
- Git hook bypass (`git commit --no-verify`)
- Docker data wipe (`docker system prune -a --volumes`)

### Security Audit

**ID**: `builtin:security-audit`
**Hook**: `tool.before` on `read`, `write`, `edit`
**Priority**: 99
**Source**: `src/interceptors/builtin/security-audit.ts`

Blocks read/write/edit access to sensitive files and paths.

Blocked path patterns:

- SSH private keys (`id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519`)
- Cloud credentials (`.aws/`, `.boto`, `credentials.json`, `service-account.json`, `kubeconfig`)
- Crypto/keyring (`.gnupg/`, `.password-store/`)
- System auth files (`/etc/passwd`, `/etc/shadow`, `/etc/sudoers`)
- Environment files (`/.env`)
- Certificate/key files (`.pem`, `.key`, `.p12`, `.pfx`)
- Claude Code auth (`.claude/.credentials.json`, `.claude/credentials/`)
- OpenClaw/Clawdbot auth (`.openclaw/credentials/`, `.clawdbot/credentials/`, `auth-profiles.json`)
- OpenAI Codex auth (`.codex/auth.json`)
- GitHub Copilot tokens (`github-copilot.token.json`)
- Qwen/MiniMax portal OAuth (`.qwen/oauth_creds.json`, `.minimax/oauth_creds.json`)
- Google CLI OAuth (`gogcli/credentials.json`)
- WhatsApp session creds (`whatsapp/default/creds.json`)
- Shell profile files (`/.profile`, `/.bashrc`, `/.zshrc`, `/.zprofile`, `/.bash_profile`, `.config/fish/config.fish`) — may contain exported API keys

Allow-listed exceptions (not blocked):

- Files inside `node_modules/`
- Files matching `.test.` or inside `/test/` or `/fixtures/` directories
- `package-lock.json`

## Adding a New Interceptor

### 1. Get the registry

The global interceptor registry is created at gateway startup. Access it from anywhere:

```typescript
import { getGlobalInterceptorRegistry } from "../interceptors/global.js";

const registry = getGlobalInterceptorRegistry();
if (!registry) {
  // Gateway not initialized yet
  return;
}
```

### 2. Register your interceptor

```typescript
registry.add({
  id: "my-plugin:redact-secrets",
  name: "tool.after",
  priority: 5,
  handler: (_input, output) => {
    // Redact any API keys from tool output
    if (typeof output.result.output === "string") {
      output.result = {
        ...output.result,
        output: output.result.output.replace(/sk-[a-zA-Z0-9]{20,}/g, "sk-***"),
      };
    }
  },
});
```

If you use `toolMatcher`, it is validated at registration time:

```typescript
// This throws immediately:
registry.add({
  id: "bad",
  name: "tool.before",
  toolMatcher: /^nonexistent_tool$/,  // Error: does not match any known tool name
  handler: () => {},
});
```

### 3. Remove when done (optional)

```typescript
registry.remove("my-plugin:redact-secrets");
```

## Examples

### Block a tool

Prevent the `exec` tool from running `rm -rf`:

```typescript
registry.add({
  id: "safety:no-rm-rf",
  name: "tool.before",
  priority: 100,
  toolMatcher: /^exec$/,
  handler: (_input, output) => {
    const cmd = typeof output.args.command === "string" ? output.args.command : "";
    if (cmd.includes("rm -rf")) {
      output.block = true;
      output.blockReason = "rm -rf is not allowed";
    }
  },
});
```

When blocked, the agent receives a result like:

```json
{ "status": "blocked", "tool": "exec", "reason": "rm -rf is not allowed" }
```

### Inject default arguments

Always add `--color=never` to exec commands:

```typescript
registry.add({
  id: "style:no-color",
  name: "tool.before",
  toolMatcher: /^exec$/,
  handler: (_input, output) => {
    const cmd = typeof output.args.command === "string" ? output.args.command : "";
    if (!cmd.includes("--color")) {
      output.args = { ...output.args, command: `${cmd} --color=never` };
    }
  },
});
```

### Log every tool call

```typescript
registry.add({
  id: "audit:log-tools",
  name: "tool.before",
  priority: -10,  // low priority — runs last, after all mutations
  handler: (input, output) => {
    console.log(`[audit] tool=${input.toolName} callId=${input.toolCallId} args=${JSON.stringify(output.args)}`);
  },
});
```

### Transform tool results

Strip ANSI escape codes from all tool output:

```typescript
const ANSI_RE = /\x1b\[[0-9;]*m/g;

registry.add({
  id: "clean:strip-ansi",
  name: "tool.after",
  handler: (_input, output) => {
    if (typeof output.result.output === "string") {
      output.result = {
        ...output.result,
        output: output.result.output.replace(ANSI_RE, ""),
      };
    }
  },
});
```

### Async interceptor

Interceptors can be async. Each runs sequentially in priority order:

```typescript
registry.add({
  id: "enrich:fetch-metadata",
  name: "tool.after",
  toolMatcher: /^web_search$/,
  handler: async (_input, output) => {
    const details = output.result.details as Record<string, unknown>;
    if (details?.url) {
      const meta = await fetchPageMetadata(String(details.url));
      output.result = {
        ...output.result,
        details: { ...details, meta },
      };
    }
  },
});
```

## Priority and Ordering

Interceptors run in **descending priority order** (higher number runs first). Interceptors with the same priority run in registration order.

| Priority | Use case |
|----------|----------|
| 100+ | Security gates, blockers |
| 10-99 | Argument transformation |
| 0 (default) | General-purpose |
| Negative | Logging, auditing (observe final state) |

## Tool Matching and Validation

The optional `toolMatcher` field is a `RegExp` tested against the normalized tool name. If omitted, the interceptor runs for all tools.

```typescript
// Match only "exec"
toolMatcher: /^exec$/

// Match any tool starting with "web"
toolMatcher: /^web/

// Match "read" or "write"
toolMatcher: /^(read|write)$/
```

**Validation**: When you call `registry.add()`, the `toolMatcher` is tested against all known tool names. If it cannot match any known tool, registration throws an error with the full list of valid tool names. This catches typos and stale tool names at startup instead of silently doing nothing at runtime.

## Registry API

The registry is created via `createInterceptorRegistry()`:

```typescript
import { createInterceptorRegistry } from "../interceptors/index.js";

const registry = createInterceptorRegistry();
```

| Method | Description |
|--------|-------------|
| `add(reg)` | Register an interceptor (validates `toolMatcher`) |
| `remove(id)` | Remove by ID |
| `get(name, matchContext?)` | Get matching interceptors, sorted by priority. Context is toolName for tool events, agentId for message/params events |
| `list()` | List all registered interceptors |
| `clear()` | Remove all interceptors |

## Global Registry

A global singleton registry is initialized at gateway startup via `initializeGlobalInterceptors()`. It is called automatically in `runEmbeddedAttempt()`. Built-in interceptors (command-safety-guard and security-audit) are registered automatically on first init.

```typescript
import {
  initializeGlobalInterceptors,
  getGlobalInterceptorRegistry,
  resetGlobalInterceptors,
} from "../interceptors/global.js";

// Initialize (idempotent) — also registers built-in interceptors
const registry = initializeGlobalInterceptors();

// Access from anywhere
const reg = getGlobalInterceptorRegistry(); // null if not initialized

// Reset (for tests only)
resetGlobalInterceptors();
```

## Architecture

### Source Files

- `src/interceptors/types.ts` — Type definitions + `KNOWN_TOOL_NAMES` set
- `src/interceptors/registry.ts` — Array-backed registry with add/remove/get/clear + toolMatcher validation
- `src/interceptors/trigger.ts` — Runs matched interceptors sequentially
- `src/interceptors/global.ts` — Global singleton + built-in interceptor registration
- `src/interceptors/format.ts` — Event formatting for verbose output
- `src/interceptors/index.ts` — Public re-exports
- `src/interceptors/builtin/command-safety-guard.ts` — Blocks dangerous bash commands
- `src/interceptors/builtin/security-audit.ts` — Blocks access to sensitive files

### Integration Points

- `src/agents/pi-embedded-runner/run/attempt.ts` — Fires `message.before` and `params.before` early in `runEmbeddedAttempt()`, before session creation. Also calls `initializeGlobalInterceptors()`.
- `src/agents/pi-tool-definition-adapter.ts` — Wraps every tool's `execute()` with the `tool.before`/`tool.after` pipeline

### Initialization Flow

```
Gateway startup
  -> loadPlugins() (existing)
  -> initializeGlobalInterceptors()
     -> Creates empty registry
     -> Registers builtin:command-safety-guard
     -> Registers builtin:security-audit
  -> Plugins call registry.add() to register custom interceptors

Each agent run:
  -> message.before interceptors (mutate prompt, set metadata)
  -> params.before interceptors (override thinkLevel, reasoningLevel)
  -> createAgentSession() with effective parameters
  -> Agent prompts the LLM
  -> Each tool.execute() runs: tool.before -> real execute -> tool.after
```

## Verbose Observability

When verbose mode is on (`verboseLevel: "on"` or `"full"`), interceptor activity is surfaced as status lines in the channel output — the same way tool calls appear.

### What you see

```
🛡️ builtin:command-safety-guard · blocked exec — "rm -rf is not allowed"
🛡️ builtin:security-audit · blocked read — "Access denied: ~/.ssh/id_rsa"
📨 message.before · message mutated, metadata: complexity
⚙️ params.before · thinkLevel → high
```

### When events are emitted

| Event | Emits when |
|-------|-----------|
| `tool.before` | An interceptor **blocks** execution |
| `message.before` | Message text is mutated or metadata is set |
| `params.before` | thinkLevel, reasoningLevel, or temperature changes |
| `tool.after` | Not emitted (too noisy for normal use) |

### How it works

The registry has an `onEvent` callback set at the start of each agent run when verbose mode is on. The `trigger()` function detects changes after each handler and emits events through this callback. Events are formatted by `formatInterceptorEvent()` and delivered via the same `onToolResult` path used for tool status lines.

```typescript
// Set callback (done automatically in attempt.ts)
registry.setOnEvent((evt) => {
  const line = formatInterceptorEvent(evt);
  if (line) onToolResult({ text: line });
});

// Clean up after run
registry.setOnEvent(null);
```

## Testing

Run all interceptor tests:

```bash
pnpm test src/interceptors/
```

Run adapter integration tests:

```bash
pnpm test src/agents/pi-tool-definition-adapter
```

When writing tests, use `resetGlobalInterceptors()` in `afterEach` to clean up:

```typescript
import { afterEach } from "vitest";
import {
  initializeGlobalInterceptors,
  resetGlobalInterceptors,
} from "../interceptors/global.js";

afterEach(() => {
  resetGlobalInterceptors();
});
```

## Interceptors vs Hooks vs Plugins

| Feature | Interceptors | Hooks | Plugins |
|---------|-------------|-------|---------|
| Scope | Tool execution pipeline | Agent/command lifecycle events | Full extension system |
| Timing | Synchronous with tool call | Event-driven | Loaded at startup |
| Can block tools | Yes | No | Via interceptors |
| Can mutate args | Yes | No | Via interceptors |
| Can mutate results | Yes | Limited (`tool_result_persist`) | Via interceptors |
| Discovery | Programmatic (`registry.add`) | Directory-based | Manifest-based |

## See Also

- `docs/hooks.md` — Event-driven automation for commands and lifecycle
- `docs/plugin.md` — Full extension system
- `docs/plugins/agent-tools.md` — Building tools for plugins
