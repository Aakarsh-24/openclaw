# WhatsApp Message Flow Architecture

This document describes the complete lifecycle of a WhatsApp message in Moltbot, from reception through AI processing to response delivery.

## Overview

Moltbot uses the [Baileys](https://github.com/WhiskeySockets/Baileys) library to connect to WhatsApp Web. When a message arrives, it flows through several layers before reaching the Pi agent framework for AI processing, then returns through a dispatcher for delivery.

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│WhatsApp │───▶│ Baileys │───▶│ Monitor │───▶│ Router  │───▶│Pi Agent │
│ Server  │    │ Socket  │    │ Layer   │    │         │    │ Runtime │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     ▲                                                            │
     │                                                            │
     └────────────────────────────────────────────────────────────┘
                         Response Delivery
```

## Layer Architecture

| Layer | Purpose | Key Files |
|-------|---------|-----------|
| Baileys | WhatsApp Web protocol | `src/web/session.ts` |
| Monitor | Message extraction & deduplication | `src/web/inbound/monitor.ts` |
| Channel | Connection orchestration | `src/web/auto-reply/monitor.ts` |
| Router | Agent & session resolution | `src/routing/resolve-route.ts` |
| Processor | Context building & dispatch | `src/web/auto-reply/monitor/process-message.ts` |
| Agent | AI execution via Pi framework | `src/agents/pi-embedded-runner/run.ts` |
| Dispatcher | Response queuing & delivery | `src/auto-reply/reply/reply-dispatcher.ts` |

## Detailed Flow

### Step 1: Baileys Connection

**File:** `src/web/session.ts`
**Function:** `createWaSocket()`

The Baileys socket manages the WhatsApp Web connection:

```typescript
// Creates socket with multi-file auth state
const { state, saveCreds } = await useMultiFileAuthState(authDir)
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
  version,
  auth: state,
  printQRInTerminal: printQr,
  // ... other options
})
```

**Responsibilities:**
- QR code authentication for first-time login
- Credential persistence in `~/.clawdbot/sessions/`
- Connection state management (connecting, open, close)
- Event emission for `messages.upsert`, `connection.update`, `creds.update`

---

### Step 2: Message Reception

**File:** `src/web/inbound/monitor.ts`
**Function:** `monitorWebInbox()`

When Baileys emits a `messages.upsert` event, `handleMessagesUpsert()` processes it:

```typescript
sock.ev.on('messages.upsert', async ({ messages, type }) => {
  for (const msg of messages) {
    // Filter status/broadcast messages
    if (isStatusMessage(msg)) continue

    // Deduplicate
    if (isRecentInboundMessage(msg.key.id)) continue

    // Extract content
    const body = extractText(msg)
    const mediaPath = await downloadInboundMedia(msg)
    const location = extractLocationData(msg)

    // Build WebInboundMsg and call handler
    onMessage(webInboundMsg)
  }
})
```

**Extracts:**
- Message text (`body`)
- Sender info (`senderJid`, `senderE164`, `senderName`)
- Group metadata (`groupSubject`, `groupParticipants`)
- Media content (`mediaPath`, `mediaType`, `mediaUrl`)
- Reply context (`replyToId`, `replyToBody`, `replyToSender`)
- Location data (`latitude`, `longitude`)
- Mentions (`mentionedJids`, `wasMentioned`)

---

### Step 3: Channel Monitoring

**File:** `src/web/auto-reply/monitor.ts`
**Function:** `monitorWebChannel()`

Orchestrates the WhatsApp channel lifecycle:

```typescript
export async function monitorWebChannel(
  verbose: boolean,
  listenerFactory: ListenerFactory,
  keepAlive: KeepAliveController,
  replyResolver: ReplyResolver,
  runtime: ChannelRuntime,
  abortSignal?: AbortSignal,
  tuning?: MonitorTuning
) {
  // Load config
  const config = await loadConfig()

  // Create message handler
  const onMessage = createWebOnMessageHandler({ ... })

  // Start monitoring with reconnect logic
  while (!abortSignal?.aborted) {
    const listener = await monitorWebInbox({ onMessage, ... })
    // Handle disconnects with exponential backoff
  }
}
```

**Responsibilities:**
- Connection retry with exponential backoff
- Heartbeat logging
- Watchdog timer for 30+ minute inactivity
- Status tracking (connected, reconnectAttempts, lastMessageAt)

---

### Step 4: Message Handling & Routing

**File:** `src/web/auto-reply/monitor/on-message.ts`
**Function:** `createWebOnMessageHandler()`

**File:** `src/routing/resolve-route.ts`
**Function:** `resolveAgentRoute()`

Routes the message to the correct agent:

```typescript
// Resolve conversation and peer IDs
const conversationId = resolveConversationId(msg)
const peerId = resolvePeerId(msg)

// Route to agent
const route = await resolveAgentRoute({
  channel: 'whatsapp',
  accountId: msg.accountId,
  peer: { kind: msg.chatType, id: peerId }
})

// For groups, apply gating
if (msg.chatType === 'group') {
  const gateResult = applyGroupGating(msg, route, config)
  if (gateResult.blocked) return
}

// Process message with resolved route
await processMessage({ msg, route, ... })
```

**Routing Logic:**
- Matches against configured bindings (peer, guild, team, account, channel)
- Falls back to default agent if no match
- Returns `agentId` and `sessionKey` for persistence

**Group Gating:**
- Checks if bot was mentioned
- Validates against allowlist
- Applies activation rules

---

### Step 5: Message Processing

**File:** `src/web/auto-reply/monitor/process-message.ts`
**Function:** `processMessage()`

Builds context and dispatches to the agent:

```typescript
export async function processMessage(params: ProcessMessageParams) {
  const { msg, route, ... } = params

  // Build history context from recent messages
  const historyContext = await buildHistoryContextFromEntries(...)

  // Check command authorization
  const authorized = await resolveWhatsAppCommandAuthorized(msg, config)

  // Build MsgContext
  const ctx: MsgContext = {
    body: msg.body,
    from: msg.from,
    agentId: route.agentId,
    sessionKey: route.sessionKey,
    mediaPath: msg.mediaPath,
    // ... other fields
  }

  // Send ACK reaction (optional)
  await maybeSendAckReaction(msg, config)

  // Dispatch to agent
  await dispatchReplyWithBufferedBlockDispatcher({
    ctx,
    onBlockReply: (reply) => deliverWebReply(msg, reply),
    // ...
  })
}
```

---

### Step 6: Agent Execution

**File:** `src/auto-reply/reply/get-reply.ts`
**Function:** `getReplyFromConfig()`

**File:** `src/auto-reply/reply/get-reply-run.ts`
**Function:** `runPreparedReply()`

Sets up and runs the AI agent:

```typescript
export async function getReplyFromConfig(ctx: MsgContext, opts: ReplyOpts) {
  // Resolve model (Claude, GPT, Gemini, etc.)
  const model = await resolveDefaultModel(ctx.agentId)

  // Ensure agent workspace exists
  await ensureAgentWorkspace(ctx.agentId)

  // Create typing controller
  const typing = createTypingController(ctx.sendComposing)

  // Apply media understanding (images, audio, video, PDFs)
  const mediaContext = await applyMediaUnderstanding(ctx.mediaPath, model)

  // Apply link understanding (URL previews)
  const linkContext = await applyLinkUnderstanding(ctx.body)

  // Run the agent
  return runPreparedReply({ ctx, model, typing, ... })
}
```

---

### Step 7: Pi Framework Execution

**File:** `src/agents/pi-embedded-runner/run.ts`
**Function:** `runEmbeddedPiAgent()`

Executes the AI agent using the Pi framework:

```typescript
export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams
): Promise<EmbeddedPiRunResult> {
  // Resolve auth profile and API key
  const apiKey = await getApiKeyForModel(params.model)

  // Load or create session
  const session = await loadSession(params.sessionKey)

  // Build system prompt with skills
  const systemPrompt = await createSystemPromptOverride(params)

  // Run agent attempt with streaming
  const result = await runEmbeddedAttempt({
    session,
    systemPrompt,
    message: params.message,
    tools: params.tools,
    onChunk: (chunk) => params.onBlockReply?.(chunk),
    onToolCall: (call) => params.onToolResult?.(call),
  })

  // Save session transcript
  await saveSession(params.sessionKey, result.session)

  return result
}
```

**Pi Framework Components:**
- `@mariozechner/pi-agent-core` - Agent loop, tool execution
- `@mariozechner/pi-ai` - Multi-provider LLM API
- `@mariozechner/pi-coding-agent` - Session management, tools
- `@mariozechner/pi-tui` - Terminal UI (optional)

**Default Tools:**
- `read` - Read files
- `write` - Write files
- `edit` - Edit files
- `bash` - Execute shell commands
- Custom skills from `skills/` directory

---

### Step 8: Response Dispatch

**File:** `src/auto-reply/reply/reply-dispatcher.ts`
**Function:** `createReplyDispatcher()`

Queues and delivers responses:

```typescript
export function createReplyDispatcher(options: DispatcherOptions) {
  const queue: ReplyPayload[] = []
  let sendChain = Promise.resolve()

  return {
    sendBlockReply(reply: ReplyPayload) {
      queue.push(reply)
      sendChain = sendChain.then(() => deliver(reply))
    },

    sendToolResult(result: ToolResult) {
      // Optional: send tool updates to user
    },

    sendFinalReply(reply: ReplyPayload) {
      queue.push(reply)
      sendChain = sendChain.then(() => deliver(reply))
    },

    async waitForIdle() {
      await sendChain
    }
  }
}
```

**Features:**
- Serializes deliveries to maintain order
- Adds human-like delays between messages
- Tracks pending deliveries for idle signal
- Supports streaming block replies

---

### Step 9: WhatsApp Delivery

**File:** `src/web/auto-reply/deliver-reply.ts`
**Function:** `deliverWebReply()`

**File:** `src/web/inbound/send-api.ts`
**Function:** `createWebSendApi()`

Sends the response back to WhatsApp:

```typescript
export async function deliverWebReply(params: DeliverParams) {
  const { msg, reply } = params

  // Convert markdown tables for WhatsApp
  const text = convertMarkdownTables(reply.text)

  // Chunk long messages
  const chunks = chunkMarkdownTextWithMode(text, 4096)

  for (const chunk of chunks) {
    // Retry with backoff
    await retry(async () => {
      await msg.reply(chunk)
    }, { retries: 3, backoff: 'exponential' })
  }
}

// In send-api.ts
export function createWebSendApi(params: SendApiParams) {
  return {
    async sendMessage(to, text, media) {
      const jid = toWhatsappJid(to)
      const payload = buildPayload(text, media)

      const result = await sock.sendMessage(jid, payload)
      return result.key.id
    }
  }
}
```

---

## Sequence Diagrams

### Complete Message Lifecycle

```
┌──────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ WhatsApp │ │ Baileys │ │ Monitor │ │ Router │ │ Agent  │ │   LLM   │
└────┬─────┘ └────┬────┘ └────┬────┘ └───┬────┘ └───┬────┘ └────┬────┘
     │            │           │          │          │           │
     │  message   │           │          │          │           │
     │───────────▶│           │          │          │           │
     │            │           │          │          │           │
     │            │  upsert   │          │          │           │
     │            │──────────▶│          │          │           │
     │            │           │          │          │           │
     │            │           │  route   │          │           │
     │            │           │─────────▶│          │           │
     │            │           │          │          │           │
     │            │           │  agentId │          │           │
     │            │           │◀─────────│          │           │
     │            │           │          │          │           │
     │            │           │  dispatch│          │           │
     │            │           │─────────────────────▶           │
     │            │           │          │          │           │
     │            │           │          │          │  request  │
     │            │           │          │          │──────────▶│
     │            │           │          │          │           │
     │            │           │          │          │  stream   │
     │            │           │          │          │◀──────────│
     │            │           │          │          │           │
     │            │           │  reply   │          │           │
     │            │           │◀─────────────────────           │
     │            │           │          │          │           │
     │            │  send     │          │          │           │
     │            │◀──────────│          │          │           │
     │            │           │          │          │           │
     │  deliver   │           │          │          │           │
     │◀───────────│           │          │          │           │
     │            │           │          │          │           │
```

### Group Message with Mention Check

```
┌──────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐
│ WhatsApp │ │ Monitor │ │ Gating  │ │ Agent  │
└────┬─────┘ └────┬────┘ └────┬────┘ └───┬────┘
     │            │           │          │
     │ @bot hello │           │          │
     │───────────▶│           │          │
     │            │           │          │
     │            │ is group? │          │
     │            │───────────▶          │
     │            │           │          │
     │            │ mentioned?│          │
     │            │───────────▶          │
     │            │           │          │
     │            │   yes ✓   │          │
     │            │◀───────────          │
     │            │           │          │
     │            │ dispatch  │          │
     │            │──────────────────────▶
     │            │           │          │
     │            │   reply   │          │
     │◀───────────────────────────────────
     │            │           │          │
```

### Tool Execution Flow

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  Agent  │ │   LLM   │ │  Tool   │ │Dispatcher│
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │
     │  request  │           │           │
     │──────────▶│           │           │
     │           │           │           │
     │ tool_call │           │           │
     │◀──────────│           │           │
     │           │           │           │
     │  execute  │           │           │
     │──────────────────────▶│           │
     │           │           │           │
     │  result   │           │           │
     │◀──────────────────────│           │
     │           │           │           │
     │ tool_result           │           │
     │──────────▶│           │           │
     │           │           │           │
     │  continue │           │           │
     │◀──────────│           │           │
     │           │           │           │
     │ final text│           │           │
     │◀──────────│           │           │
     │           │           │           │
     │  deliver  │           │           │
     │──────────────────────────────────▶│
     │           │           │           │
```

---

## Key Data Structures

### WebInboundMsg

Represents an incoming WhatsApp message:

```typescript
interface WebInboundMsg {
  id?: string
  from: string              // Sender JID
  to: string                // Recipient JID
  body: string              // Message text
  chatType: 'dm' | 'group'

  // Sender info
  senderE164?: string       // Phone number (+1234567890)
  senderJid?: string        // WhatsApp JID
  senderName?: string       // Display name
  selfE164?: string         // Bot's phone number

  // Group info
  groupSubject?: string     // Group name
  groupParticipants?: string[]
  groupMembers?: GroupMember[]

  // Media
  mediaPath?: string        // Local file path
  mediaType?: string        // MIME type
  mediaUrl?: string         // Remote URL

  // Reply context
  replyToId?: string        // Quoted message ID
  replyToBody?: string      // Quoted message text
  replyToSender?: string    // Quoted message sender

  // Location
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }

  // Mentions
  mentionedJids?: string[]
  wasMentioned?: boolean

  // Account
  accountId: string

  // Methods
  reply(text: string, media?: Buffer): Promise<void>
  sendComposing(): void     // Show typing indicator
}
```

### ResolvedAgentRoute

Routing decision for a message:

```typescript
interface ResolvedAgentRoute {
  agentId: string           // Target agent ID
  channel: string           // 'whatsapp'
  accountId: string         // WhatsApp account ID
  sessionKey: string        // Unique per conversation
  mainSessionKey: string    // For collapsing multiple DMs
  matchedBy:
    | 'binding.peer'
    | 'binding.guild'
    | 'binding.team'
    | 'binding.account'
    | 'binding.channel'
    | 'default'
}
```

### MsgContext

Context passed to the agent:

```typescript
interface MsgContext {
  body: string              // User message
  from: string              // Sender identifier
  agentId: string           // Target agent
  sessionKey: string        // Session for persistence

  // Media
  mediaPath?: string
  mediaType?: string
  mediaContext?: string     // AI-generated description

  // Conversation
  historyContext?: string   // Recent message history
  replyToBody?: string      // Quoted message

  // Authorization
  authorized: boolean
  elevated: boolean

  // Callbacks
  sendComposing?: () => void
  onBlockReply?: (reply: ReplyPayload) => void
  onToolResult?: (result: ToolResult) => void
}
```

### ReplyPayload

Response to deliver:

```typescript
interface ReplyPayload {
  text?: string             // Response text
  mediaUrl?: string         // Single media URL
  mediaUrls?: string[]      // Multiple media URLs
  mediaBuffer?: Buffer      // Raw media data
  mediaType?: string        // MIME type

  // Formatting
  markdown?: boolean        // Enable markdown
  monospace?: boolean       // Code block style
}
```

---

## Configuration

### Agent Routing

Configure in `~/.clawdbot/config.json5`:

```json5
{
  routing: {
    bindings: [
      {
        // Route specific contact to agent
        peer: { kind: 'dm', id: '+1234567890' },
        agentId: 'work-agent'
      },
      {
        // Route group to agent
        peer: { kind: 'group', id: 'group-jid@g.us' },
        agentId: 'group-agent'
      }
    ],
    default: {
      agentId: 'main'  // Fallback agent
    }
  }
}
```

### Group Gating

```json5
{
  channels: {
    whatsapp: {
      groups: {
        // Require mention to respond
        requireMention: true,

        // Allowlist specific groups
        allowlist: ['group-jid@g.us'],

        // Or blocklist
        blocklist: ['spam-group@g.us']
      }
    }
  }
}
```

### Media Understanding

```json5
{
  agents: {
    defaults: {
      mediaUnderstanding: {
        // Enable vision for images
        images: true,

        // Transcribe audio
        audio: true,

        // Extract video frames
        video: true,

        // Parse PDFs
        documents: true
      }
    }
  }
}
```

---

## Error Handling

### Connection Failures

```typescript
// Exponential backoff for reconnection
const backoff = [1000, 2000, 5000, 10000, 30000, 60000]
let attempt = 0

while (!aborted) {
  try {
    await connect()
    attempt = 0  // Reset on success
  } catch (err) {
    const delay = backoff[Math.min(attempt, backoff.length - 1)]
    await sleep(delay)
    attempt++
  }
}
```

### Message Delivery Failures

```typescript
// Retry with backoff
await retry(
  () => msg.reply(text),
  {
    retries: 3,
    backoff: 'exponential',
    onRetry: (err, attempt) => {
      log.warn(`Delivery failed (attempt ${attempt}): ${err.message}`)
    }
  }
)
```

### Agent Failures

```typescript
// Failover to backup model
try {
  return await runWithModel('claude-3-opus')
} catch (err) {
  if (isRateLimitError(err)) {
    return await runWithModel('gpt-4')  // Failover
  }
  throw err
}
```

---

## Observability

### Logging

Key log points:
- Connection state changes
- Message reception (with IDs)
- Routing decisions
- Agent execution start/end
- Tool calls
- Delivery confirmation

### Metrics

Tracked metrics:
- `whatsapp.messages.received` - Inbound message count
- `whatsapp.messages.sent` - Outbound message count
- `whatsapp.connection.uptime` - Connection duration
- `agent.execution.duration` - Agent response time
- `agent.tokens.used` - Token consumption

### Health Checks

```bash
# Check channel status
moltbot channels status --probe

# Check gateway health
curl http://localhost:18789/health
```

---

## Related Documentation

- [Gateway Architecture](/docs/architecture/gateway.md)
- [Agent Configuration](/docs/configuration.md)
- [Skills System](/docs/skills.md)
- [Pi Framework](https://github.com/badlogic/pi-mono)
- [Baileys Library](https://github.com/WhiskeySockets/Baileys)
