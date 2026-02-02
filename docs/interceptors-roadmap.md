# Interceptors Roadmap

## Background

This system is inspired by [OpenCode's hook system](https://github.com/anomalyco/opencode) and Claude Code's hooks. The goal is to bring similar extensibility to OpenClaw, completely independent from the existing internal hooks system.

## Implemented

| Interceptor | Event | Matches | Description |
|---|---|---|---|
| `message.before` | Before agent processes message | `agentMatcher` | Mutate message text, set metadata tags for downstream interceptors |
| `params.before` | Before session creation | `agentMatcher` | Override thinkLevel, reasoningLevel; reads metadata from message.before |
| `tool.before` | Pre-tool execution | `toolMatcher` | Can inspect/mutate args or block execution |
| `tool.after` | Post-tool execution | `toolMatcher` | Can inspect/mutate results |

### Built-in interceptors

- **`builtin:command-safety-guard`** — `tool.before` on `exec`. Blocks dangerous shell commands (rm -rf, chmod 777, curl\|bash, fork bombs, git --no-verify, docker nukes). Detects file-read commands (cat, head, tail, base64, etc.) and file-copy commands (cp, scp, rsync) targeting sensitive paths. Closes the exec-tool bypass loophole.
- **`builtin:security-audit`** — `tool.before` on `read`/`write`/`edit`. Blocks access to sensitive paths (SSH keys, AWS creds, .env, shell profiles, Claude/Codex/Copilot/Qwen/MiniMax tokens, etc.) with allow-list exceptions for node_modules/test fixtures.

## OpenCode Hook Reference

Full list of hook points from `anomalyco/opencode`:

| Hook | What it does | OpenClaw status |
|---|---|---|
| `tool.execute.before` | Before a tool executes, can mutate args | **Done** (`tool.before`) |
| `tool.execute.after` | After a tool executes, can mutate output | **Done** (`tool.after`) |
| `chat.message` | Modify incoming messages and parts before they hit the agent | **Done** (`message.before`) |
| `chat.params` | Modify LLM parameters (temperature, topP, topK) before sending | **Done** (`params.before`) — model/provider override deferred |
| `chat.headers` | Modify HTTP headers sent to LLM provider | Planned |
| `permission.ask` | Intercept permission checks (allow/deny/ask) | Planned |
| `command.execute.before` | Before a slash command runs | Planned |
| `experimental.chat.messages.transform` | Transform full message array before LLM call | Planned |
| `experimental.chat.system.transform` | Transform system prompt before LLM call | Planned |
| `experimental.session.compacting` | Customize session compaction | Planned |
| `event` | Catch-all for any bus event | Planned |
| `config` | Receive config on init | Planned |

## Design Comparison

| Aspect | OpenCode | Claude Code | OpenClaw Interceptors |
|---|---|---|---|
| **Pattern** | JS function mutates output object in-place | Shell/prompt/agent process, returns JSON | Sequential in-process, mutates output in-place |
| **Execution** | Sequential, in-process | Out-of-process subprocess | Sequential, in-process |
| **Can block?** | Only via `permission.ask` | Yes (exit code 2 or `deny`) | Yes (`output.block = true`) |
| **Can mutate input?** | `tool.execute.before` mutates args | `updatedInput` in PreToolUse | `tool.before` mutates `output.args` |
| **Can mutate output?** | `tool.execute.after` mutates result | `updatedMCPToolOutput` in PostToolUse | `tool.after` mutates `output.result` |

## Architecture Note

OpenClaw's existing plugin hooks (`before_tool_call`, `after_tool_call`) were defined in types but never actually wired into the tool execution pipeline. Tool execution happens inside the `@mariozechner/pi-coding-agent` library, so interceptors wrap tools at the `toToolDefinitions()` adapter boundary — the function in `pi-tool-definition-adapter.ts` that converts OpenClaw tools into the format pi-agent expects.

## Decisions Made

- **Dependency checker**: Skipped — "we don't install stuff from inside"
- **Notification handler / user-prompt-hook** (from gists): Don't map to tool interceptors — they're prompt/notification level
- **Task quality analyzer** (from gists): Too heavy for synchronous interceptor (calls LLM)
- The interceptor system is **completely independent** from existing OpenClaw internal hooks (`hook-runner-global.ts`)
- Tool name validation at registration time — `toolMatcher` regex is validated against `KNOWN_TOOL_NAMES` so typos fail loudly

## Next Steps

Discuss and prioritize which planned hooks to implement next. Candidates roughly ordered by usefulness:

1. **`chat.system.transform`** — transform system prompt (inject context, modify behavior)
2. **`permission.ask`** — intercept permission decisions programmatically
3. **`command.execute.before`** — intercept slash commands before execution
4. **`chat.messages.transform`** — transform full message array before LLM call
5. **Model/provider override in `params.before`** — currently read-only context; needs model re-resolution logic moved into attempt.ts
