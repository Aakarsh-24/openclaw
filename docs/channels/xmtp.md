---
summary: "XMTP decentralized messaging channel via wallet-to-wallet encrypted communication"
read_when:
  - You want Clawdbot to use XMTP for messaging
  - You're setting up Web3 messaging
---
# XMTP (plugin)

XMTP (Extensible Message Transport Protocol) is an open, decentralized messaging protocol for wallet-to-wallet encrypted communication. Clawdbot connects via a wallet identity, enabling direct messages and group conversations with quantum-resistant encryption.

Status: supported via plugin (@xmtp/agent-sdk). Direct messages, group chats, text messages, reactions, attachments, and ENS address resolution.

## Plugin required

XMTP ships as a plugin and is not bundled with the core install.

Install via CLI (npm registry):

```bash
clawdbot plugins install @clawdbot/xmtp
```

Local checkout (when running from a git repo):

```bash
clawdbot plugins install ./extensions/xmtp
```

If you choose XMTP during configure/onboarding and a git checkout is detected, Clawdbot will offer the local install path automatically.

Details: [Plugins](/plugin)

## Setup

### 1. Install the plugin

From npm:
```bash
clawdbot plugins install @clawdbot/xmtp
```

From a local checkout:
```bash
clawdbot plugins install ./extensions/xmtp
```

### 2. Generate a wallet for the bot

XMTP uses Ethereum wallet identities. Generate a new wallet for your bot:

```bash
# Using the provided script
cd extensions/xmtp
npx tsx scripts/generate-wallet.ts
```

Example output:
```
Private Key: 0xef0760...d3e58b54
Ethereum Address: 0x726149b70827960A6954B159B898C88D42cB7137
```

**Save the private key securely!** This is your bot's identity on XMTP.

### 3. Configure credentials

Add to your config at `~/.clawdbot/clawdbot.json`:

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "env": "dev",
      "walletKey": "0xYOUR_PRIVATE_KEY_HERE",
      "dbPath": "/Users/you/.clawdbot/.xmtp/db",
      "dmPolicy": "pairing"
    }
  }
}
```

Or use environment variables:

```bash
export XMTP_WALLET_KEY=0xYOUR_PRIVATE_KEY_HERE
export XMTP_ENV=dev
export XMTP_DB_PATH=/Users/you/.clawdbot/.xmtp/db
```

### 4. Restart the gateway

```bash
clawdbot gateway restart
```

### 5. Test the connection

Install an XMTP client app:
- [Converse](https://getconverse.app/) (iOS/Android)
- [xmtp.chat](https://xmtp.chat/) (Web)

Message your bot's Ethereum address (from step 2) and your bot should reply!

## Configuration reference

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `false` | Enable XMTP channel |
| `env` | string | `"dev"` | Network environment: `"dev"` or `"production"` |
| `walletKey` | string | required | Bot's Ethereum private key (hex format with 0x prefix) |
| `dbPath` | string | `".xmtp/db"` | Local database path for XMTP state |
| `encryptionKey` | string | (optional) | Database encryption key (auto-generated if not set) |
| `dmPolicy` | string | `"pairing"` | DM access policy (`"open"`, `"pairing"`, or `"allowlist"`) |
| `allowFrom` | string[] | `[]` | Allowed sender addresses (when using allowlist policy) |

## Networks

### Development Network
- **Purpose:** Testing and development
- **Cost:** Free
- **Persistence:** Messages may not persist long-term
- **Configuration:** Set `env: "dev"`
- **Use when:** Building and testing your bot

### Production Network
- **Purpose:** Production use
- **Cost:** ~5 USDC per 100,000 messages
- **Persistence:** Long-term message storage
- **Configuration:** Set `env: "production"`
- **Use when:** Deploying for real users

**Important:** Development and production are separate networks. Users on dev cannot message users on production and vice versa.

## Security

### Wallet key management

- **Never commit your wallet private key** to version control
- Use environment variables or encrypted config for production
- Keep separate wallets for dev and production environments
- Consider using a dedicated bot wallet with minimal assets

### DM policies

Like other channels, XMTP supports DM access policies:

- `"open"` - Anyone can message the bot (not recommended)
- `"pairing"` - Users must pair first (recommended)
- `"allowlist"` - Only specific addresses can message

Example allowlist config:

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "env": "production",
      "walletKey": "${XMTP_WALLET_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": [
        "0x0a8138c495cd47367e635b94feb7612a230221a4"
      ]
    }
  }
}
```

## Features

### Supported
- ✅ Direct messages (DMs)
- ✅ Group conversations
- ✅ Text messages
- ✅ Reactions
- ✅ Attachments
- ✅ ENS address resolution
- ✅ Multi-account support (via config)
- ✅ Quantum-resistant encryption (MLS protocol)

### Coming soon
- ⏳ Read receipts
- ⏳ Thread replies

## ENS resolution

XMTP supports ENS (Ethereum Name Service) for human-readable addresses:

```
# Message via ENS name
Send "Hello!" to vitalik.eth
```

The plugin automatically resolves ENS names to Ethereum addresses.

## Multi-account support

Future versions will support multiple XMTP accounts. Configuration structure:

```json
{
  "channels": {
    "xmtp": {
      "enabled": true,
      "accounts": [
        {
          "label": "primary",
          "env": "production",
          "walletKey": "${XMTP_PRIMARY_KEY}",
          "dbPath": ".xmtp/primary"
        },
        {
          "label": "dev-bot",
          "env": "dev",
          "walletKey": "${XMTP_DEV_KEY}",
          "dbPath": ".xmtp/dev"
        }
      ]
    }
  }
}
```

See [examples/multi-account.json5](https://github.com/clawdbot/clawdbot/blob/main/extensions/xmtp/examples/multi-account.json5) for details.

## Example configurations

The XMTP plugin includes ready-to-use configuration templates in the `examples/` directory:

- **quickstart.json5** - Minimal 2-minute setup
- **dev-network.json5** - Full dev network config with comments
- **production-network.json5** - Production-ready config with security best practices
- **multi-account.json5** - Multi-wallet support (planned feature)

Browse them at: https://github.com/clawdbot/clawdbot/tree/main/extensions/xmtp/examples

## Troubleshooting

### "XMTP wallet key not configured"

Generate a wallet:
```bash
cd extensions/xmtp
npx tsx scripts/generate-wallet.ts
```

Set the key:
```bash
export XMTP_WALLET_KEY="0x..."
```

### Messages not appearing

Check if XMTP is connected:
```bash
clawdbot channels status
```

Check for errors:
```bash
clawdbot logs | grep -i xmtp
```

Verify network environment matches (both on `dev` or both on `production`).

### Can't send to an address

- Recipient must have XMTP enabled (used an XMTP client before)
- Both sender and recipient must be on the same network (dev or production)
- Check that the address is valid (0x prefix, 40 hex characters)

### Database errors

If you see database corruption errors, stop the gateway and remove the database:

```bash
clawdbot gateway stop
rm -rf ~/.clawdbot/.xmtp/db
clawdbot gateway start
```

The database will be recreated on next start.

## Resources

- [XMTP Protocol](https://xmtp.org)
- [XMTP Documentation](https://docs.xmtp.org/)
- [XMTP Agent SDK](https://github.com/xmtp/xmtp-js/tree/main/sdks/agent-sdk)
- [Test Your Bot](https://xmtp.chat/)
- [Converse App](https://getconverse.app/)
- [Plugin README](https://github.com/clawdbot/clawdbot/blob/main/extensions/xmtp/README.md)

## Contributing

See the main [Contributing Guide](https://github.com/clawdbot/clawdbot/blob/main/CONTRIBUTING.md) for details on contributing to Clawdbot and its channel plugins.
