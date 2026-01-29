# Components Documentation

## Table of Contents
1. [Overview](#overview)
2. [Gateway Components](#gateway-components)
3. [Agent Runtime Components](#agent-runtime-components)
4. [Channel Components](#channel-components)
5. [Tool Components](#tool-components)
6. [Plugin System Components](#plugin-system-components)
7. [Configuration Components](#configuration-components)
8. [Storage Components](#storage-components)
9. [Utility Components](#utility-components)

---

## Overview

This document provides detailed information about each component in the Jarvis system. Components are organized by layer and functionality.

---

## Gateway Components

### Server (`src/gateway/server.ts`)

**Purpose**: Main WebSocket server that handles all client connections and orchestration.

**Responsibilities**:
- Accept WebSocket connections from clients
- Route messages to appropriate handlers
- Manage active chat sessions
- Coordinate tool execution
- Handle cron jobs and webhooks

**Key APIs**:
```typescript
class GatewayServer {
  constructor(config: GatewayConfig);
  
  async start(): Promise<void>;
  async stop(): Promise<void>;
  
  registerChat(chat: ChatSession): void;
  unregisterChat(chatId: string): void;
  
  async routeMessage(message: InboundMessage): Promise<void>;
  
  getModelCatalog(): ModelCatalog;
  getBrowserTool(): BrowserTool;
  getDiscoveryService(): DiscoveryService;
}
```

**Configuration**:
```yaml
gateway:
  mode: local        # 'local' or 'remote'
  port: 18789
  bind: loopback     # 'loopback' or 'all'
  verbose: true
```

---

### Chat Registry (`src/gateway/chat-registry.ts`)

**Purpose**: Maintains registry of all active chat sessions.

**Responsibilities**:
- Register new chat sessions
- Track active sessions
- Clean up inactive sessions
- Provide session lookup

**Key APIs**:
```typescript
class ChatRegistry {
  register(chat: ChatSession): void;
  unregister(chatId: string): void;
  
  get(chatId: string): ChatSession | undefined;
  getAll(): ChatSession[];
  
  findByChannel(channel: string): ChatSession[];
  findByUser(userId: string): ChatSession[];
  
  cleanup(): void;
}
```

**Data Structure**:
```typescript
interface ChatSession {
  id: string;
  channel: string;
  userId: string;
  groupId?: string;
  
  agent: AgentSession;
  context: SessionContext;
  
  createdAt: number;
  lastActivityAt: number;
  
  metadata: Record<string, unknown>;
}
```

---

### Model Catalog (`src/gateway/model-catalog.ts`)

**Purpose**: Maintains catalog of available AI models and their configurations.

**Responsibilities**:
- List available models
- Provide model configurations
- Handle model authentication
- Track model usage and costs

**Key APIs**:
```typescript
class ModelCatalog {
  getAvailableModels(): ModelInfo[];
  getModel(modelId: string): ModelInfo | undefined;
  
  getAuthProfile(modelId: string): AuthProfile;
  setAuthProfile(modelId: string, profile: AuthProfile): void;
  
  getUsageStats(modelId: string): UsageStats;
}
```

**Model Info Structure**:
```typescript
interface ModelInfo {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google' | 'bedrock' | 'ollama';
  
  capabilities: {
    vision: boolean;
    tools: boolean;
    streaming: boolean;
  };
  
  limits: {
    maxTokens: number;
    contextWindow: number;
    rateLimit: RateLimit;
  };
  
  pricing: {
    inputCostPer1k: number;
    outputCostPer1k: number;
  };
}
```

---

### Browser Tool (`src/gateway/browser-tool.ts`)

**Purpose**: Shared browser automation tool using Playwright.

**Responsibilities**:
- Launch and manage browser instances
- Execute browser automation tasks
- Capture screenshots and PDFs
- Handle browser profiles and cookies

**Key APIs**:
```typescript
class BrowserTool {
  async launch(options: LaunchOptions): Promise<BrowserInstance>;
  async close(instanceId: string): Promise<void>;
  
  async navigate(instanceId: string, url: string): Promise<void>;
  async screenshot(instanceId: string, options: ScreenshotOptions): Promise<Buffer>;
  async pdf(instanceId: string, options: PDFOptions): Promise<Buffer>;
  
  async click(instanceId: string, selector: string): Promise<void>;
  async type(instanceId: string, selector: string, text: string): Promise<void>;
  async fill(instanceId: string, selector: string, value: string): Promise<void>;
  
  async evaluate(instanceId: string, script: string): Promise<unknown>;
  async snapshot(instanceId: string): Promise<PageSnapshot>;
}
```

**Configuration**:
```yaml
tools:
  browser:
    enabled: true
    headless: true
    timeout: 30000
    viewport:
      width: 1280
      height: 720
    profiles:
      - name: default
        cookies: []
        localStorage: {}
```

---

### Discovery Service (`src/gateway/discovery.ts`)

**Purpose**: Service discovery using mDNS for local network.

**Responsibilities**:
- Advertise gateway service
- Discover other gateways
- Handle service announcements

**Key APIs**:
```typescript
class DiscoveryService {
  async advertise(service: ServiceInfo): Promise<void>;
  async stopAdvertise(): Promise<void>;
  
  async discover(serviceType: string): Promise<ServiceInfo[]>;
  watch(serviceType: string, handler: ServiceHandler): void;
}
```

---

## Agent Runtime Components

### Pi Agent Runner (`src/agents/pi-embedded-runner.ts`)

**Purpose**: Execute AI models in RPC mode with tool streaming.

**Responsibilities**:
- Execute model requests
- Stream tool calls and results
- Handle model authentication
- Manage failover on errors

**Key APIs**:
```typescript
class PiAgentRunner {
  constructor(config: AgentConfig);
  
  async* execute(
    session: SessionContext,
    message: string
  ): AsyncGenerator<AgentEvent>;
  
  async executeTools(
    session: SessionContext,
    tools: ToolCall[]
  ): Promise<ToolResult[]>;
  
  async streamResponse(
    session: SessionContext
  ): AsyncGenerator<ResponseChunk>;
}
```

**Event Types**:
```typescript
type AgentEvent = 
  | { type: 'tool_call', data: ToolCall }
  | { type: 'tool_result', data: ToolResult }
  | { type: 'text_chunk', data: string }
  | { type: 'thinking', data: string }
  | { type: 'error', data: Error };
```

---

### Session Manager (`src/agents/session-manager.ts`)

**Purpose**: Manage agent session lifecycle and context.

**Responsibilities**:
- Create and destroy sessions
- Load and save session context
- Manage message history
- Handle session isolation

**Key APIs**:
```typescript
class SessionManager {
  createSession(config: SessionConfig): AgentSession;
  destroySession(sessionId: string): void;
  
  getSession(sessionId: string): AgentSession | undefined;
  getAllSessions(): AgentSession[];
  
  async loadContext(sessionId: string): Promise<SessionContext>;
  async saveContext(sessionId: string, context: SessionContext): Promise<void>;
  
  async addMessage(sessionId: string, message: Message): Promise<void>;
  async getMessages(sessionId: string, limit: number): Promise<Message[]>;
}
```

**Session Context**:
```typescript
interface SessionContext {
  sessionId: string;
  chatId: string;
  channel: string;
  
  messages: Message[];
  maxTokens: number;
  
  model: string;
  temperature: number;
  thinkingMode: 'low' | 'high' | 'always';
  
  availableTools: Tool[];
  toolResults: ToolResult[];
  
  memory: MemoryStore;
  skills: Skill[];
  
  metadata: Record<string, unknown>;
}
```

---

### Tool Registry (`src/agents/tool-registry.ts`)

**Purpose**: Registry of available tools for agents.

**Responsibilities**:
- Register tools
- Validate tool schemas
- Execute tool calls
- Track tool usage

**Key APIs**:
```typescript
class ToolRegistry {
  register(tool: Tool): void;
  unregister(toolName: string): void;
  
  get(toolName: string): Tool | undefined;
  getAll(): Tool[];
  
  async execute(
    toolName: string,
    params: unknown,
    context: ToolContext
  ): Promise<ToolResult>;
  
  validateParams(toolName: string, params: unknown): boolean;
}
```

**Tool Interface**:
```typescript
interface Tool {
  name: string;
  description: string;
  schema: JSONSchema;
  
  execute(params: unknown, context: ToolContext): Promise<ToolResult>;
}
```

---

### Model Auth (`src/agents/model-auth.ts`)

**Purpose**: Handle model authentication and token management.

**Responsibilities**:
- Store API keys and OAuth tokens
- Refresh expired tokens
- Rotate auth profiles on failure
- Secure credential storage

**Key APIs**:
```typescript
class ModelAuth {
  async getAuthProfile(modelId: string): Promise<AuthProfile>;
  async setAuthProfile(modelId: string, profile: AuthProfile): Promise<void>;
  
  async refreshToken(modelId: string): Promise<void>;
  async rotateProfile(modelId: string): Promise<void>;
  
  async validateCredentials(modelId: string): Promise<boolean>;
}
```

**Auth Profile**:
```typescript
interface AuthProfile {
  type: 'api_key' | 'oauth';
  
  // For API keys
  apiKey?: string;
  
  // For OAuth
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  
  metadata: Record<string, unknown>;
}
```

---

## Channel Components

### Base Channel Interface (`src/channels/base.ts`)

**Purpose**: Common interface for all channel implementations.

**Responsibilities**:
- Define channel lifecycle
- Normalize messages
- Handle errors gracefully

**Interface**:
```typescript
interface Channel {
  name: string;
  type: ChannelType;
  
  // Lifecycle
  init(config: ChannelConfig): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  
  // Messaging
  send(message: OutboundMessage): Promise<void>;
  receive(handler: MessageHandler): void;
  
  // Status
  getStatus(): ChannelStatus;
  getConnections(): Connection[];
}
```

---

### WhatsApp Channel (`src/whatsapp/`)

**Purpose**: WhatsApp integration using Baileys library.

**Key Files**:
- `bot.ts` - Main bot implementation
- `send.ts` - Message sending
- `markdown.ts` - Markdown to WhatsApp formatting
- `qr.ts` - QR code pairing

**Configuration**:
```yaml
channels:
  whatsapp:
    enabled: true
    pairing: code
    allowlist:
      - "+1234567890"
    session: main
```

---

### Telegram Channel (`src/telegram/`)

**Purpose**: Telegram integration using grammY library.

**Key Files**:
- `bot.ts` - Main bot implementation
- `handlers.ts` - Message handlers
- `markdown.ts` - Markdown to Telegram formatting
- `keyboard.ts` - Inline keyboard support

**Configuration**:
```yaml
channels:
  telegram:
    enabled: true
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    allowlist:
      - "username1"
      - "username2"
```

---

### Signal Channel (`src/signal/`)

**Purpose**: Signal integration using signal-cli.

**Key Files**:
- `bot.ts` - Main bot implementation
- `cli.ts` - signal-cli wrapper
- `send.ts` - Message sending

**Configuration**:
```yaml
channels:
  signal:
    enabled: true
    phone: "+1234567890"
    allowlist:
      - "+0987654321"
```

---

### Discord Channel (`src/discord/`)

**Purpose**: Discord integration using discord.js.

**Key Files**:
- `bot.ts` - Main bot implementation
- `handlers.ts` - Event handlers
- `markdown.ts` - Markdown to Discord formatting
- `embeds.ts` - Rich embed support

**Configuration**:
```yaml
channels:
  discord:
    enabled: true
    bot_token: "${DISCORD_BOT_TOKEN}"
    dm:
      policy: pairing
      allowFrom: []
    guilds:
      - guild_id: "123456789"
        channels: ["general", "bot-commands"]
```

---

### Slack Channel (`src/slack/`)

**Purpose**: Slack integration using Bolt framework.

**Key Files**:
- `bot.ts` - Main bot implementation
- `handlers.ts` - Event handlers
- `blocks.ts` - Block Kit formatting

**Configuration**:
```yaml
channels:
  slack:
    enabled: true
    bot_token: "${SLACK_BOT_TOKEN}"
    signing_secret: "${SLACK_SIGNING_SECRET}"
    dm:
      policy: pairing
```

---

## Tool Components

### Browser Tool (`src/browser/`)

**Purpose**: Web automation using Playwright.

**Key Files**:
- `browser-tool.ts` - Main tool implementation
- `playwright-bridge.ts` - Playwright wrapper
- `snapshot.ts` - Page snapshot generation
- `profiles.ts` - Browser profile management

**Tool Schema**:
```typescript
{
  name: "browser",
  description: "Automate web browsing",
  schema: {
    action: "navigate" | "click" | "type" | "screenshot",
    url?: string,
    selector?: string,
    text?: string
  }
}
```

---

### Canvas Tool (`src/canvas-host/`)

**Purpose**: Visual workspace with A2UI framework.

**Key Files**:
- `index.ts` - Main canvas implementation
- `a2ui/` - A2UI framework bundles
- `renderer.ts` - DOM rendering
- `websocket.ts` - Real-time updates

**Tool Schema**:
```typescript
{
  name: "canvas",
  description: "Create visual workspace",
  schema: {
    action: "create" | "update" | "render",
    content?: string,
    layout?: string
  }
}
```

---

### Bash Tool (`src/process/`)

**Purpose**: Execute shell commands safely.

**Key Files**:
- `exec.ts` - Command execution
- `spawn-utils.ts` - Process spawning utilities
- `command-queue.ts` - Command queuing

**Tool Schema**:
```typescript
{
  name: "bash",
  description: "Execute shell commands",
  schema: {
    command: string,
    timeout?: number,
    cwd?: string,
    env?: Record<string, string>
  }
}
```

---

### Memory Tool (`src/memory/`)

**Purpose**: Store and retrieve contextual information.

**Key Files**:
- `index.ts` - Main memory implementation
- `vector-store.ts` - Vector embeddings
- `cache.ts` - Caching layer

**Tool Schema**:
```typescript
{
  name: "memory",
  description: "Store and recall information",
  schema: {
    action: "store" | "recall" | "search",
    key?: string,
    value?: unknown,
    query?: string
  }
}
```

---

## Plugin System Components

### Plugin Discovery (`src/plugins/discovery.ts`)

**Purpose**: Auto-detect and validate plugins.

**Responsibilities**:
- Scan plugin directories
- Validate manifests
- Check dependencies

**Key APIs**:
```typescript
class PluginDiscovery {
  async discoverPlugins(): Promise<PluginManifest[]>;
  async validateManifest(manifest: PluginManifest): Promise<boolean>;
  async checkDependencies(manifest: PluginManifest): Promise<boolean>;
}
```

---

### Plugin Loader (`src/plugins/loader.ts`)

**Purpose**: Load and initialize plugins.

**Responsibilities**:
- Load plugin modules
- Initialize plugins
- Register hooks
- Inject services

**Key APIs**:
```typescript
class PluginLoader {
  async load(manifest: PluginManifest): Promise<Plugin>;
  async init(plugin: Plugin): Promise<void>;
  async start(plugin: Plugin): Promise<void>;
  async stop(plugin: Plugin): Promise<void>;
  
  registerHooks(plugin: Plugin): void;
  injectServices(plugin: Plugin, services: PluginServices): void;
}
```

---

### Plugin Services (`src/plugins/services.ts`)

**Purpose**: Provide services to plugins.

**Services**:
```typescript
interface PluginServices {
  gateway: GatewayClient;
  config: ConfigProvider;
  logger: Logger;
  http: HttpClient;
  storage: StorageProvider;
}
```

---

## Configuration Components

### Config Loader (`src/config/index.ts`)

**Purpose**: Load and validate configuration.

**Responsibilities**:
- Load YAML configuration
- Validate with Zod schemas
- Merge environment variables
- Handle migrations

**Key APIs**:
```typescript
class ConfigLoader {
  async load(path: string): Promise<Config>;
  async validate(config: unknown): Promise<Config>;
  async save(path: string, config: Config): Promise<void>;
  
  merge(configs: Partial<Config>[]): Config;
  migrate(oldConfig: unknown): Config;
}
```

---

### Config Schema (`src/config/schema.ts`)

**Purpose**: Zod schemas for configuration validation.

**Schemas**:
```typescript
const ConfigSchema = z.object({
  gateway: GatewayConfigSchema,
  agents: AgentsConfigSchema,
  channels: ChannelsConfigSchema,
  tools: ToolsConfigSchema,
  sandbox: SandboxConfigSchema,
  plugins: PluginsConfigSchema,
  skills: SkillsConfigSchema,
});
```

---

### Path Manager (`src/config/paths.ts`)

**Purpose**: Manage system paths.

**Paths**:
```typescript
class PathManager {
  getConfigDir(): string;
  getCredentialsDir(): string;
  getSessionsDir(): string;
  getMediaDir(): string;
  getMemoryDir(): string;
  getLogsDir(): string;
  
  resolve(relativePath: string): string;
}
```

---

## Storage Components

### Session Store (`src/sessions/`)

**Purpose**: Persist session data.

**Key APIs**:
```typescript
class SessionStore {
  async create(session: SessionContext): Promise<void>;
  async read(sessionId: string): Promise<SessionContext>;
  async update(session: SessionContext): Promise<void>;
  async delete(sessionId: string): Promise<void>;
  
  async addMessage(sessionId: string, message: Message): Promise<void>;
  async getMessages(sessionId: string, limit: number): Promise<Message[]>;
}
```

---

### Memory Store (`src/memory/`)

**Purpose**: Vector storage for contextual memory.

**Key APIs**:
```typescript
class MemoryStore {
  async addEmbedding(key: string, embedding: number[]): Promise<void>;
  async searchEmbeddings(query: number[], k: number): Promise<SearchResult[]>;
  
  async set(key: string, value: unknown): Promise<void>;
  async get(key: string): Promise<unknown>;
  async delete(key: string): Promise<void>;
  
  async recall(query: string): Promise<MemoryResult[]>;
}
```

---

## Utility Components

### Logger (`src/logger.ts`)

**Purpose**: Structured logging with tslog.

**Key APIs**:
```typescript
class Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  
  child(name: string): Logger;
}
```

---

### Terminal Utils (`src/terminal/`)

**Purpose**: Terminal UI utilities.

**Key Files**:
- `palette.ts` - Color palette
- `table.ts` - Table formatting
- `progress.ts` - Progress bars

---

### Markdown Utils (`src/markdown/`)

**Purpose**: Markdown parsing and rendering.

**Key APIs**:
```typescript
class MarkdownUtils {
  parse(markdown: string): MarkdownNode[];
  render(nodes: MarkdownNode[]): string;
  
  toHTML(markdown: string): string;
  toPlainText(markdown: string): string;
}
```

---

**End of Components Documentation**
