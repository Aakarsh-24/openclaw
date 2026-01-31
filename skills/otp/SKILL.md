# OTP Skill

Provides TOTP (Time-based One-Time Password) verification for OpenClaw. Use this skill to add 2FA authentication to commands, sessions, or workflows.

## What it does

- **Verify OTP codes** against configured secrets
- **Track verification state** (who verified when, expiration tracking)
- **Generate new secrets** for users/services
- **Check expiration** and grace periods
- **Integrate with other skills** for command protection

## Requirements

- The standalone `@openclaw/totp` CLI tool (included in `packages/totp-cli/`)
- Config at `auth.otpVerification` in `openclaw.json`

## Quick Start

### 1. Generate a secret (one-time setup)

```bash
cd packages/totp-cli
./totp.mjs generate admin@yourapp.com YourApp
```

Save the secret to your config:

```json
{
  "auth": {
    "otpVerification": {
      "enabled": true,
      "secret": "JBSWY3DPEHPK3PXP",
      "accountName": "admin@yourapp.com",
      "issuer": "YourApp",
      "intervalHours": 24
    }
  }
}
```

### 2. Ask the agent to verify

```
Verify OTP code: 123456
```

Or from another skill:

```javascript
// In your skill's tool/script
const result = await agent.exec('bash', ['-c', 
  './skills/otp/verify.sh 123456'
]);

if (result.exitCode === 0) {
  // Valid!
} else {
  // Invalid or expired
}
```

### 3. Check verification state

```
Check my OTP status
```

Or:

```bash
./skills/otp/check-status.sh slack:U123456
```

## Commands

### `verify.sh <code>`

Validates a TOTP code against the configured secret.

**Exit codes:**
- `0` - Valid code, user verified
- `1` - Invalid code
- `2` - Config error (no secret, etc.)

**Example:**
```bash
./skills/otp/verify.sh 123456
# Output: VERIFIED (or ERROR/INVALID)
```

### `check-status.sh [userId]`

Checks if a user's verification is still valid (based on `intervalHours`).

**Exit codes:**
- `0` - Still verified (within time window)
- `1` - Expired or never verified
- `2` - Config error

**Example:**
```bash
./skills/otp/check-status.sh slack:U123456
# Output: VALID (last verified: 2024-01-30 10:23:45)
# or: EXPIRED (last verified: 2024-01-29 08:15:30)
```

### `generate-secret.sh [account] [issuer]`

Generates a new TOTP secret. Use this when setting up OTP for the first time or rotating secrets.

**Example:**
```bash
./skills/otp/generate-secret.sh admin@myapp.com MyApp
# Output: JSON with secret, URI, QR code link
```

### `get-current-code.sh`

Gets the current valid code for testing (don't expose this to users!).

**Example:**
```bash
./skills/otp/get-current-code.sh
# Output: 123456
```

## State Management

Verification state is stored in `memory/otp-state.json`:

```json
{
  "slack:U123456": {
    "lastVerified": "2024-01-30T18:30:00.000Z",
    "expiresAt": "2024-01-31T18:30:00.000Z"
  }
}
```

This allows tracking multiple users across channels.

## Configuration

In `openclaw.json`:

```json
{
  "auth": {
    "otpVerification": {
      "enabled": true,
      "secret": "YOUR_BASE32_SECRET",
      "accountName": "user@example.com",
      "issuer": "OpenClaw",
      "intervalHours": 24,
      "gracePeriodMinutes": 15
    }
  }
}
```

**Options:**

- `enabled` - Enable/disable OTP verification
- `secret` - Base32-encoded TOTP secret
- `accountName` - Label shown in authenticator app
- `issuer` - Service name (e.g., "OpenClaw")
- `intervalHours` - How often to require re-verification (default: 24)
- `gracePeriodMinutes` - Grace period after expiration (default: 15)

## Use Cases

### Protect sensitive commands

```javascript
// In your skill
const needsAuth = isAdminCommand(command);

if (needsAuth) {
  const status = await exec('./skills/otp/check-status.sh', [userId]);
  
  if (status.exitCode !== 0) {
    return "Please verify your identity first: provide your OTP code";
  }
}

// Proceed with command...
```

### Require verification after inactivity

```javascript
const lastVerified = getLastVerifiedTime(userId);
const hoursSince = (Date.now() - lastVerified) / (1000 * 60 * 60);

if (hoursSince > 24) {
  return "It's been a while. Please re-verify with your OTP code.";
}
```

### Multi-user verification

```javascript
// Track verification per user
await exec('./skills/otp/verify.sh', [code, userId]);
```

## Security Notes

- **Never log or expose secrets** - They're like passwords
- **Use HTTPS/secure channels** when setting up
- **Rotate secrets periodically** (e.g., every 90 days)
- **Store state in memory/** (gitignored by default)
- **Time sync matters** - Server clock must be accurate (±30s tolerance)

## Troubleshooting

### "INVALID" for codes that should work

- Check server time: `date` (must be within ±30s of real time)
- Verify secret is correct (Base32, no spaces)
- Try the current code: `./skills/otp/get-current-code.sh`

### "Config error"

- Ensure `auth.otpVerification.secret` is set in config
- Verify config is valid: `openclaw doctor`

### State not persisting

- Check `memory/otp-state.json` exists and is writable
- Ensure workspace is in the correct directory

## Examples

See `examples/` directory for:
- Protected admin commands
- Session verification tracking
- Multi-user OTP flows

## License

MIT (same as OpenClaw)
