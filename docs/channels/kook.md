---
summary: "Kook bot support status, capabilities, and configuration"
read_when:
  - Working on Kook channel features
---
# Kook (Bot API)


Status: production-ready for bot DMs + channels via WebSocket.

## Quick setup (beginner)
1) Create a bot on the [Kook Developer Platform](https://developer.kookapp.cn/bot/) and copy the token.
2) Set the token:
   - Env: `KOOK_BOT_TOKEN=...`
   - Or config: `channels.kook.token: "..."`.
   - If both are set, config takes precedence (env fallback is default-account only).
3) Start the gateway.
4) **Security**: Set `channels.kook.allowedUserId` to restrict bot access to your user ID only.

Minimal config:
```json5
{
  channels: {
    kook: {
      enabled: true,
      token: "your-bot-token",
      allowedUserId: "your-user-id"  // strongly recommended for security
    }
  }
}
```

## What it is
- A Kook Bot API channel owned by the Gateway.
- Deterministic routing: replies go back to Kook; the model never chooses channels.
- DMs share the agent's main session; channels stay isolated (`agent:<agentId>:kook:channel:<channelId>`).

## Setup (fast path)
### 1) Create a bot token
1) Visit the [Kook Developer Platform](https://developer.kookapp.cn/bot/).
2) Create a new bot application and copy the Bot Token.
3) Store the token safely.

### 2) Configure the token (env or config)
Example:

```json5
{
  channels: {
    kook: {
      enabled: true,
      token: "your-bot-token",
      allowedUserId: "your-user-id"
    }
  }
}
```

Env option: `KOOK_BOT_TOKEN=...` (works for the default account).
If both env and config are set, config takes precedence.

### 3) Get your user ID (for security)
**Method 1**: Enable Developer Mode in Kook
1. Open Kook → Personal Settings → Advanced Settings → Developer Mode → Enable
2. Right-click your avatar in any server channel → Copy ID

**Method 2**: Check logs
Send a message to the bot and check the gateway logs for `authorId`.

### 4) Start the gateway
```bash
moltbot gateway
```

Kook channel starts when a token is resolved (config first, env fallback) and `channels.kook.enabled` is not `false`.

## Features
- **WebSocket connection**: Real-time message delivery via Kook's WebSocket API
- **Private messages**: Support for direct messages with the bot
- **Channel messages**: Support for messages in server channels
- **User allowlist**: `allowedUserId` restricts bot control to specific users (security)
- **Message chunking**: Automatically splits long messages to fit Kook's limits
- **Auto-reconnection**: Handles connection drops and reconnects automatically

## Security
- **Strongly recommended**: Set `channels.kook.allowedUserId` to your Kook user ID
- Without `allowedUserId`, anyone who can DM the bot or is in the same channel can control it
- The bot will only respond to messages from the specified user ID(s)

## Configuration reference

### Core settings
```json5
{
  channels: {
    kook: {
      enabled: true,              // Enable/disable the Kook channel
      token: "YOUR_BOT_TOKEN",    // Required: Bot token from developer platform
      allowedUserId: "USER_ID"    // Strongly recommended: Your Kook user ID
    }
  }
}
```

### Environment variables
- `KOOK_BOT_TOKEN`: Bot token (fallback for default account)

## Troubleshooting

### Bot not responding
1. Check that `channels.kook.enabled` is `true`
2. Verify your bot token is correct
3. Check gateway logs for connection errors
4. Ensure `allowedUserId` matches your Kook user ID

### Connection issues
- Kook WebSocket connection requires stable internet
- The bot automatically reconnects on connection drops
- Check gateway logs for WebSocket connection status

### Message not sent
- Verify the bot has permission to send messages in the channel
- Check if message length exceeds limits (automatically chunked)
- Review gateway logs for delivery errors

## Message routing
- **Private messages**: Collapse into the agent's main session (default `agent:main:main`)
- **Channel messages**: Isolated per channel (`agent:<agentId>:kook:channel:<channelId>`)
- Replies always go back to the channel they arrived on (deterministic routing)

## Known limitations
- Kook API rate limits apply (handled automatically with retries)
- Message formatting may differ from other platforms
- Rich media support depends on Kook API capabilities

## See also
- [Channels overview](/channels/)
- [Configuration reference](/gateway/configuration)
- [Security guidelines](/security/)
