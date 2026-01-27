# XMTP Configuration Examples

This directory contains example configurations for different XMTP deployment scenarios.

## Available Examples

### 1. Development Network (`dev-network.json5`)
**Use when:**
- Testing XMTP integration locally
- Development and debugging
- Free to use, no gas costs
- Messages don't persist long-term

**Best for:** First-time setup, experimentation, CI/CD testing.

### 2. Production Network (`production-network.json5`)
**Use when:**
- Deploying to production
- Real user conversations
- Permanent message storage required

**Cost:** ~$5 USDC per 100k messages (one-time setup cost for identity registration).

**Important:** Production network data is permanent and cannot be migrated to dev network.

### 3. Multi-Account (Coming Soon)
**Status:** Not yet implemented. XMTP plugin currently supports single wallet only.

**Planned features:**
- Multiple bot wallets in one Clawdbot instance
- Per-wallet DM policies
- Wallet-specific authorization rules

## Quick Start

1. **Choose your network:**
   - New users → start with `dev-network.json5`
   - Production deployments → use `production-network.json5`

2. **Generate a wallet:**
   ```bash
   clawdbot onboard xmtp
   # OR manually:
   npx tsx scripts/generate-wallet.ts
   ```

3. **Copy example config:**
   ```bash
   # For dev network:
   cp examples/dev-network.json5 my-config.json5
   
   # Edit and add your wallet key:
   # walletKey: "0x..." (64 hex characters from wallet generation)
   ```

4. **Set environment variables (alternative to config file):**
   ```bash
   export XMTP_WALLET_KEY="0x..."
   export XMTP_ENV="dev"  # or "production"
   ```

5. **Start Clawdbot:**
   ```bash
   clawdbot gateway start
   ```

## Configuration Precedence

**Config file > Environment variables**

If both are set:
- `channels.xmtp.walletKey` in config overrides `XMTP_WALLET_KEY`
- `channels.xmtp.env` in config overrides `XMTP_ENV`

## Important Notes

### Network Isolation
- Dev and production networks are completely separate
- A wallet's messages on dev won't appear on production
- Choose carefully before deploying to production

### Wallet Security
- **Never commit wallet keys to git**
- Store production keys in secure environment variables or secrets manager
- Use separate wallets for dev and production

### Database Paths
- Each wallet needs its own database directory
- Default: `.xmtp/db` (relative to working directory)
- Production: use absolute paths for reliability
- Multi-account: different `dbPath` per wallet required

### DM Policies
- **`open`**: Anyone can message (commands restricted to authorized users)
- **`pairing`**: Requires approval via `clawdbot pairing approve xmtp <code>`
- **`allowlist`**: Only addresses in `allowFrom` can message

**Recommendation:** Start with `pairing` for security, switch to `open` only if needed.

## Troubleshooting

### "Wallet key validation failed"
- Key must be 66 characters: `0x` + 64 hex digits
- Check for typos, missing `0x` prefix, or extra whitespace

### "Network mismatch detected"
- Database was created on a different network
- Solution: Use different `dbPath` or delete old database

### "DB path not writable"
- Ensure directory exists and has write permissions
- Don't use `/tmp` (cleared on reboot)
- Use persistent paths like `~/.xmtp/db` or `/var/lib/xmtp/db`

## See Also

- [XMTP Channel Documentation](/docs/channels/xmtp.md)
- [Clawdbot Configuration Guide](https://docs.clawd.bot/gateway/configuration)
- [XMTP Protocol Docs](https://docs.xmtp.org)
