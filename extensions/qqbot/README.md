
# QQ Bot Channel Plugin for Moltbot

A Moltbot channel plugin for the official QQ Robot API, supporting C2C private chats, Group @mentions, and Guild messages.

## Features

- **Multi-Scenario Support**: C2C one-on-one chats, QQ Group @mentions, Guild public messages, and Guild direct messages (DMs).
- **Auto-Reconnection**: Automatically reconnects after WebSocket disconnection and supports Session Resume.
- **Message Deduplication**: Automatically manages `msg_seq` and supports multiple replies to the same message.
- **System Prompts**: Configurable custom system prompts injected into AI requests.
- **Error Notifications**: Automatically notifies the user to check the configuration if the AI fails to respond.

## Usage Example
<img width="1852" height="1082" alt="image" src="https://github.com/user-attachments/assets/a16d582b-708c-473e-b3a2-e0c4c503a0c8" />

## Installation

Run the following command in the plugin directory:

```bash
clawdbot plugins install .
```

## Configuration

### 1. Obtain QQ Robot Credentials

1. Visit the [QQ Open Platform](https://q.qq.com/).
2. Create a Robot Application.
3. Get the `AppID` and `AppSecret` (ClientSecret).
4. The Token format is `AppID:AppSecret`, for example: `102146862:Xjv7JVhu7KXkxANbp3HVjxCRgvAPeuAQ`.

### 2. Add Configuration

#### Method 1: Interactive Configuration

```bash
clawdbot channels add
# Select 'qqbot' and enter the Token as prompted
```

#### Method 2: Command Line Configuration

```bash
clawdbot channels add --channel qqbot --token "AppID:AppSecret"
```

Example:

```bash
clawdbot channels add --channel qqbot --token "102146862:xxxxxxxx"
```

### 3. Manual Configuration (Optional)

You can also directly edit `~/.clawdbot/clawdbot.json`:

```json
{
  "channels": {
    "qqbot": {
      "enabled": true,
      "appId": "YourAppID",
      "clientSecret": "YourAppSecret",
      "systemPrompt": "You are a friendly assistant"
    }
  }
}
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `appId` | string | Yes | QQ Robot AppID |
| `clientSecret` | string | Yes* | AppSecret. Choose either this or `clientSecretFile`. |
| `clientSecretFile` | string | Yes* | Path to the AppSecret file. |
| `enabled` | boolean | No | Whether to enable the plugin. Default is `true`. |
| `name` | string | No | Account display name. |
| `systemPrompt` | string | No | Custom system prompt. |

## Supported Message Types

| Event Type | Description | Intent |
|------------|-------------|--------|
| `C2C_MESSAGE_CREATE` | C2C One-on-One Message | `1 << 25` |
| `GROUP_AT_MESSAGE_CREATE` | Group Chat @Robot Message | `1 << 25` |
| `AT_MESSAGE_CREATE` | Guild @Robot Message | `1 << 30` |
| `DIRECT_MESSAGE_CREATE` | Guild Direct Message (DM) | `1 << 12` |

## Usage

### Startup

Start in background:
```bash
clawdbot gateway restart
```

Start in foreground (convenient for viewing logs):
```bash
clawdbot gateway --port 18789 --verbose
```

### CLI Configuration Wizard

```bash
clawdbot onboard
# Select QQ Bot for interactive configuration
```

## Important Notes

1.  **Reply Limitations**: The official QQ API limits replies to a maximum of 5 per message, with a 60-minute timeout.
2.  **URL Restrictions**: The QQ platform does not allow URLs in messages; the plugin has built-in prompts to restrict this.
3.  **Group Messages**: The robot must be @mentioned in the group to trigger a reply.
4.  **Sandbox Mode**: Newly created robots are in sandbox mode by default and require test users to be added.

## Upgrading

If you need to upgrade the plugin, run the upgrade script to clean up the old version first:

```bash
# Run the upgrade script (cleans up old version and config)
./scripts/upgrade.sh

# Reinstall the plugin
clawdbot plugins install .

# Reconfigure
clawdbot channels add --channel qqbot --token "AppID:AppSecret"

# Restart the gateway
clawdbot gateway restart
```

The upgrade script will automatically:
- Delete the `~/.clawdbot/extensions/qqbot` directory.
- Clean up `qqbot` related configurations in `clawdbot.json`.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev
```

## File Structure

```
qqbot/
├── index.ts          # Entry file
├── src/
│   ├── api.ts        # QQ Bot API wrapper
│   ├── channel.ts    # Channel Plugin definition
│   ├── config.ts     # Configuration parsing
│   ├── gateway.ts    # WebSocket gateway
│   ├── onboarding.ts # CLI configuration wizard
│   ├── outbound.ts   # Outbound message handling
│   ├── runtime.ts    # Runtime state
│   └── types.ts      # Type definitions
├── scripts/
│   └── upgrade.sh    # Upgrade script
├── package.json
└── tsconfig.json
```

## Related Links

- [QQ Robot Official Documentation](https://bot.q.qq.com/wiki/)
- [QQ Open Platform](https://q.qq.com/)
- [API v2 Documentation](https://bot.q.qq.com/wiki/develop/api-v2/)

## License

MIT