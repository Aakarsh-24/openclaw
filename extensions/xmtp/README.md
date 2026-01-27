# XMTP Channel Plugin for Clawdbot

Decentralized messaging for Clawdbot via XMTP protocol.

## What is XMTP?

XMTP (Extensible Message Transport Protocol) is an open, decentralized messaging protocol. Messages are:
- End-to-end encrypted (quantum-resistant MLS)
- Identity-agnostic (works with any wallet, DID, passkey)
- Censorship-resistant (no single company/server controls it)
- Crypto-native (send tokens in messages)

## Features

- ✅ Direct messages (DMs)
- ✅ Group conversations
- ✅ Text messages
- ✅ Reactions
- ✅ Attachments
- ⏳ Read receipts (coming soon)
- ⏳ Replies (coming soon)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Bot Wallet

```bash
npx tsx scripts/generate-wallet.ts
```

This creates a new Ethereum wallet for your XMTP bot. **Save the private key securely!**

Example output:
```
Private Key: 0xef0760...d3e58b54
Ethereum Address: 0x726149b70827960A6954B159B898C88D42cB7137
```

### 3. Configure Clawdbot

Add to your `~/.clawdbot/clawdbot.json`:

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "env": "dev",
      "walletKey": "0xYOUR_PRIVATE_KEY_HERE",
      "dbPath": ".xmtp/db"
    }
  }
}
```

Or use environment variables:

```bash
export XMTP_WALLET_KEY=0xYOUR_PRIVATE_KEY_HERE
export XMTP_ENV=dev
export XMTP_DB_DIRECTORY=.xmtp/db
```

### 4. Install Plugin in Clawdbot

**Option A: Development (local)**

```bash
# Link this plugin to Clawdbot's extensions folder
ln -s $(pwd) /opt/homebrew/lib/node_modules/clawdbot/extensions/xmtp

# Restart Clawdbot
clawdbot gateway restart
```

**Option B: Production (after PR merged)**

The plugin will be built-in to Clawdbot after the PR is merged.

## Example Configurations

See the [`examples/`](./examples/) directory for ready-to-use configuration templates:

- **[quickstart.json5](./examples/quickstart.json5)** - Minimal 2-minute setup
- **[dev-network.json5](./examples/dev-network.json5)** - Full dev network config with comments
- **[production-network.json5](./examples/production-network.json5)** - Production-ready config with security best practices
- **[multi-account.json5](./examples/multi-account.json5)** - Future multi-wallet support (planned)

Each example includes inline comments explaining every option. Start with `quickstart.json5` for the fastest path.

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | false | Enable XMTP channel |
| `env` | "dev" \| "production" | "dev" | XMTP network (dev for testing, production for mainnet) |
| `walletKey` | string | - | Bot's Ethereum private key (required) |
| `dbPath` | string | ".xmtp/db" | Local database path for XMTP state |
| `encryptionKey` | string | (optional) | Database encryption key (auto-generated if not set) |

## Networks

### Development Network
- Free to use
- For testing
- Messages don't persist long-term
- Set `env: "dev"`

### Production Network
- ~5 USDC per 100,000 messages
- Persistent, production-grade
- Set `env: "production"`

## Usage

### Sending Messages

From Clawdbot, you can message XMTP addresses (Ethereum addresses):

```
Send "Hello!" to 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### Receiving Messages

Anyone with XMTP can message your bot's address. The bot will:
1. Receive the message
2. Route it to a Clawdbot session
3. Generate a reply
4. Send it back via XMTP

### Testing Your Bot

1. Install an XMTP client app:
   - [Converse](https://getconverse.app/) (iOS/Android)
   - [xmtp.chat](https://xmtp.chat/) (Web)

2. Message your bot's Ethereum address (from the wallet generation step)

3. Your bot should reply!

## Development

### Project Structure

```
xmtp-plugin/
├── src/
│   ├── channel.ts      # Main channel plugin implementation
│   └── runtime.ts      # Clawdbot runtime bridge
├── scripts/
│   └── generate-wallet.ts  # Wallet generation utility
├── index.ts            # Plugin entry point
├── package.json
├── clawdbot.plugin.json
└── README.md
```

### Key Files

- **`src/channel.ts`** - XMTP Agent setup and event handling
- **`src/runtime.ts`** - Clawdbot API runtime reference
- **`index.ts`** - Plugin registration

### How It Works

1. **Agent Initialization**: Creates XMTP Agent with bot's wallet
2. **Event Listeners**: Subscribes to `text`, `dm`, `group` events
3. **Message Routing**: Maps XMTP conversations → Clawdbot sessions
4. **Bidirectional Flow**:
   - XMTP → Clawdbot: Route incoming messages to sessions
   - Clawdbot → XMTP: Send replies via Agent SDK

## Troubleshooting

**📖 See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for the comprehensive troubleshooting guide** covering:
- Configuration issues (wallet keys, database paths, network mismatches)
- Connection & network problems
- Authorization & pairing errors
- Message delivery issues
- ENS resolution failures
- Group chat behavior
- Performance optimization
- Security & key management
- Advanced debugging techniques

### Quick Fixes

**"XMTP wallet key not configured"**
```bash
clawdbot onboard xmtp  # Generate wallet key
export XMTP_WALLET_KEY="0x..."
```

**Messages not appearing**
```bash
clawdbot channels status  # Check if XMTP is connected
clawdbot logs | grep -i xmtp  # Check for errors
# Verify same network (dev vs production)
```

**Can't send to address**
- Recipient must have XMTP enabled (used an XMTP client before)
- Both must be on same network (dev or production)

For detailed solutions, diagnostics, and advanced debugging, see **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**.

## Resources

- [XMTP Docs](https://docs.xmtp.org/)
- [XMTP Agent SDK](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk)
- [XMTP Protocol](https://xmtp.org)
- [Test Your Bot](https://xmtp.chat/)

## Contributing

This plugin is intended to be merged into Clawdbot core. To contribute:

1. Make your changes
2. Test locally
3. Submit a PR to [clawdbot/clawdbot](https://github.com/clawdbot/clawdbot)

## License

Same as Clawdbot (check main repo for details)
