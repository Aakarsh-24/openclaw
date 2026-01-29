# Moltbot Orchestrator Feature Specification

## Overview

This document specifies the implementation of an **Orchestrator Layer** for Moltbot. The orchestrator acts as an intelligent router that intercepts user messages and decides whether to handle them directly or delegate to specialized agents.

## Goals

1. **Smart Routing**: Use a fast LLM (configurable) to analyze incoming messages and route to appropriate agents
2. **OpenCode Integration**: Enable Moltbot to delegate coding tasks to OpenCode CLI
3. **Parallel Execution**: Support running multiple agents concurrently
4. **Configurable Models**: All agent models should be configurable via `moltbot.json`
5. **Extensible**: Easy to add new specialized agents

## Architecture

```
                         User Message
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ORCHESTRATOR (configurable model)               │
│  - Default: google-gemini-cli/gemini-3-flash-preview        │
│  - System prompt: knows available agents                     │
│  - Delegation tools: spawn specialized agents                │
│  - Decision: handle directly OR delegate                     │
└────────┬─────────────┬──────────────┬──────────────────────┘
         │             │              │
         ▼             ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ OpenCode    │ │ Embedded Pi │ │ Research    │
│ Agent       │ │ Agent       │ │ Agent       │
│ (CLI/HTTP)  │ │ (existing)  │ │ (web tools) │
└─────────────┘ └─────────────┘ └─────────────┘
         │             │              │
         └─────────────┼──────────────┘
                       ▼
              Result Aggregation
```

## Configuration Schema

Add to `moltbot.json`:

```json5
{
  "orchestrator": {
    "enabled": true,
    "model": "google-gemini-cli/gemini-3-flash-preview",
    "fallbacks": ["openai-codex/gpt-5.2-codex"],
    "agents": {
      "opencode": {
        "enabled": true,
        "model": "anthropic/claude-sonnet-4",
        "mode": "cli",  // "cli" | "serve"
        "binary": "opencode",
        "timeoutMs": 300000
      },
      "research": {
        "enabled": true,
        "model": "google-gemini-cli/gemini-3-flash-preview"
      },
      "embedded": {
        "enabled": true,
        "model": null  // null = use agents.defaults.model
      }
    },
    "parallelExecution": true,
    "maxParallelAgents": 3
  }
}
```

## File Structure

```
src/agents/orchestrator/
├── index.ts                    # Main exports
├── types.ts                    # Type definitions
├── config.ts                   # Config schema and defaults
├── orchestrator.ts             # Main orchestrateUserMessage()
├── prompt.ts                   # System prompt builder
├── result-aggregator.ts        # Combine agent results
└── delegation-tools/
    ├── index.ts                # Tool exports
    ├── opencode-agent.ts       # OpenCode CLI/HTTP integration
    ├── research-agent.ts       # Web search delegation
    └── embedded-agent.ts       # Existing Pi agent delegation
```

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create feature branch `feature/orchestrator`
- [ ] Create `src/agents/orchestrator/` directory structure
- [ ] Implement `types.ts` - AgentResult, OrchestratorParams, OrchestratorResponse
- [ ] Implement `config.ts` - Config schema with Zod/TypeBox validation
- [ ] Add orchestrator config types to `src/config/types.ts`

### Phase 2: Orchestrator Core
- [ ] Implement `prompt.ts` - Build orchestrator system prompt
- [ ] Implement `orchestrator.ts` - Main orchestration logic
- [ ] Implement `result-aggregator.ts` - Combine multiple agent outputs

### Phase 3: Delegation Tools
- [ ] Implement `delegation-tools/opencode-agent.ts` - OpenCode CLI integration
- [ ] Implement `delegation-tools/research-agent.ts` - Web search delegation
- [ ] Implement `delegation-tools/embedded-agent.ts` - Existing agent delegation
- [ ] Implement `delegation-tools/index.ts` - Export all tools

### Phase 4: Integration
- [ ] Add orchestrator to tool registry in `moltbot-tools.ts`
- [ ] Integrate into message handling pipeline
- [ ] Add CLI flag for enabling/disabling orchestrator
- [ ] Update config migration if needed

### Phase 5: Testing & Documentation
- [ ] Add unit tests for orchestrator logic
- [ ] Add integration tests for delegation tools
- [ ] Add E2E test for full orchestration flow
- [ ] Update documentation

### Phase 6: Polish
- [ ] Run linter and fix issues
- [ ] Run full test suite
- [ ] Create PR with changelog entry

## Type Definitions

```typescript
// types.ts

export interface AgentResult {
  agentName: string;
  agentType: "opencode" | "research" | "embedded" | "orchestrator";
  status: "success" | "error" | "partial" | "timeout";
  output: string;
  artifacts?: unknown[];
  errorMessage?: string;
  durationMs: number;
  model?: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

export interface OrchestratorParams {
  userMessage: string;
  sessionId: string;
  sessionKey?: string;
  config?: MoltbotConfig;
  images?: ImageContent[];
  timeoutMs?: number;
  thinking?: ThinkLevel;
}

export interface OrchestratorResponse {
  payloads: Array<{ text: string; isError?: boolean }>;
  agentResults: AgentResult[];
  meta: {
    durationMs: number;
    orchestratorModel: string;
    delegatedAgents: string[];
  };
}

export interface OrchestratorConfig {
  enabled: boolean;
  model: string;
  fallbacks?: string[];
  agents: {
    opencode?: OpenCodeAgentConfig;
    research?: ResearchAgentConfig;
    embedded?: EmbeddedAgentConfig;
  };
  parallelExecution?: boolean;
  maxParallelAgents?: number;
}

export interface OpenCodeAgentConfig {
  enabled: boolean;
  model?: string;
  mode: "cli" | "serve";
  binary?: string;
  timeoutMs?: number;
  servePort?: number;
}

export interface ResearchAgentConfig {
  enabled: boolean;
  model?: string;
}

export interface EmbeddedAgentConfig {
  enabled: boolean;
  model?: string | null;
}
```

## OpenCode Integration Details

### CLI Mode (`opencode run`)

```typescript
// Simple one-shot execution
async function runOpenCodeCli(message: string, options: OpenCodeAgentConfig): Promise<AgentResult> {
  const args = ["run", message];
  if (options.model) {
    args.push("--model", options.model);
  }
  
  const result = await spawnCommand(options.binary ?? "opencode", args, {
    timeoutMs: options.timeoutMs ?? 300000,
    cwd: workspaceDir,
  });
  
  return {
    agentName: "OpenCode",
    agentType: "opencode",
    status: result.exitCode === 0 ? "success" : "error",
    output: result.stdout,
    errorMessage: result.stderr || undefined,
    durationMs: result.durationMs,
    model: options.model,
  };
}
```

### Serve Mode (Future)

```typescript
// Persistent HTTP server for sessions
interface OpenCodeServer {
  port: number;
  sessionId: string;
  prompt(message: string): Promise<AgentResult>;
  close(): Promise<void>;
}

async function getOrCreateOpenCodeServer(sessionId: string): Promise<OpenCodeServer> {
  // Check if server exists for this session
  // If not, spawn `opencode serve --port <port>`
  // Return client connected to the server
}
```

## Orchestrator System Prompt

```typescript
// prompt.ts

export function buildOrchestratorSystemPrompt(config: OrchestratorConfig): string {
  const agents = [];
  
  if (config.agents.opencode?.enabled) {
    agents.push(`
**OpenCode Agent** (tool: delegate_to_opencode)
- Use for: coding tasks, file modifications, debugging, shell commands, git operations
- Capabilities: Full IDE-like agent with bash, file editing, LSP, code search
- When to use: User asks to write code, modify files, run commands, debug issues`);
  }
  
  if (config.agents.research?.enabled) {
    agents.push(`
**Research Agent** (tool: delegate_to_research)
- Use for: web searches, information retrieval, fact-checking
- Capabilities: Web search, URL fetching, documentation lookup
- When to use: User needs current information, documentation, or research`);
  }
  
  if (config.agents.embedded?.enabled) {
    agents.push(`
**Moltbot Agent** (tool: delegate_to_moltbot)
- Use for: general queries, Moltbot-specific features, messaging, scheduling
- Capabilities: All Moltbot tools (message, cron, browser, canvas, etc.)
- When to use: User asks about Moltbot, messaging, or general assistance`);
  }

  return `You are Moltbot's Orchestrator. Your role is to understand user requests and route them to the most appropriate specialized agent(s).

## Available Agents
${agents.join("\n")}

## Decision Rules

1. **Analyze the request**: Understand what the user is asking for
2. **Select agent(s)**: Choose the best agent(s) for the task
3. **Parallel execution**: You can call multiple agents simultaneously if the task benefits from it
4. **Direct response**: For simple greetings or trivial questions, respond directly without delegation

## Response Format

- If delegating: Call the appropriate delegation tool(s)
- If handling directly: Provide a brief, helpful response
- If multiple agents needed: Call multiple tools - they will run in parallel

## Examples

User: "Write a Python script to parse JSON"
Action: delegate_to_opencode

User: "What's the weather in Tokyo?"
Action: delegate_to_research

User: "Send a message to John saying hello"
Action: delegate_to_moltbot

User: "Research React best practices and create a component"
Action: delegate_to_research AND delegate_to_opencode (parallel)

User: "Hello!"
Action: Respond directly with a greeting`;
}
```

## Result Aggregation

```typescript
// result-aggregator.ts

export function aggregateResults(results: AgentResult[]): OrchestratorResponse {
  const payloads: Array<{ text: string; isError?: boolean }> = [];
  
  for (const result of results) {
    if (result.status === "error") {
      payloads.push({
        text: `**${result.agentName} Error:**\n${result.errorMessage || result.output}`,
        isError: true,
      });
    } else {
      payloads.push({
        text: results.length > 1 
          ? `**${result.agentName}:**\n${result.output}`
          : result.output,
      });
    }
  }
  
  return {
    payloads,
    agentResults: results,
    meta: {
      durationMs: Math.max(...results.map(r => r.durationMs)),
      orchestratorModel: "configured-model",
      delegatedAgents: results.map(r => r.agentType),
    },
  };
}
```

## Migration Notes

- Orchestrator is **opt-in** via `orchestrator.enabled: true`
- Default behavior (orchestrator disabled) remains unchanged
- Existing `agents.defaults.model` config is preserved
- Orchestrator model is separate from agent models

## Future Enhancements

1. **OpenCode serve mode**: Persistent coding sessions with state
2. **Agent chaining**: Sequential agent execution with context passing
3. **Custom agents**: Plugin system for adding new agent types
4. **Learning**: Track which delegations work best and improve routing
5. **Streaming**: Real-time output from delegated agents

## References

- OpenCode CLI: https://github.com/anomalyco/opencode
- Moltbot Agent Architecture: `src/agents/pi-embedded-runner/`
- Existing Subagent Pattern: `src/agents/tools/sessions-spawn-tool.ts`
