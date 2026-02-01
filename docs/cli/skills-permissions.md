---
summary: "Skill permissions: manifest format, risk assessment, and security config"
read_when:
  - You want to understand what permissions a skill requests
  - You want to audit skill security and risk levels
  - You want to add a permission manifest to your skill
---

# Skill Permissions

OpenClaw skill permission manifests declare what resources a skill needs access to. This helps users make informed decisions about which skills to trust.

Related:

- Skills system: [Skills](/tools/skills)
- Skills CLI: [openclaw skills](/cli/skills)
- Security: [Security](/gateway/security)

## Overview

Permission manifests are **declarative** (not enforced at runtime). They exist to:

- Document what a skill needs access to
- Enable risk assessment before loading
- Support security policy configuration
- Provide transparency about skill behavior

## Manifest Format

Add a `permissions` block under `metadata.openclaw` in your `SKILL.md`:

```yaml
---
name: my-skill
description: Example skill with permissions
metadata:
  openclaw:
    permissions:
      version: 1
      declared_purpose: "What this skill does and why"
      filesystem:
        - "read:./data"
        - "write:./output"
      network:
        - "api.example.com"
      env:
        - "API_KEY"
      exec:
        - "node"
        - "curl"
      sensitive_data:
        credentials: true
        personal_info: true
        financial: false
      security_notes: "Additional context about security"
---
```

## Permission Types

### Filesystem

Declares file/directory access. Format: `<mode>:<path>`

Modes:

- `read:` — read-only access
- `write:` — write-only access
- `readwrite:` — full access

Paths:

- Relative paths (e.g., `./data`) are relative to the skill directory
- `~` expands to the user's home directory
- `**` wildcards are supported

Examples:

```yaml
filesystem:
  - "read:./config" # Read skill's config dir
  - "write:./output" # Write to output dir
  - "readwrite:~/.myapp" # Full access to ~/.myapp
  - "read:~/**/*.json" # Read all JSON files in home
```

High-risk patterns (flagged during audit):

- Dotfiles (`~/.ssh`, `~/.gnupg`, `~/.aws`)
- Environment files (`.env`)
- Recursive wildcards (`**`)
- Absolute paths (`/`)

### Network

Declares network endpoints the skill communicates with.

```yaml
network:
  - "api.example.com" # Specific domain
  - "*.example.com" # Wildcard subdomain
```

High-risk patterns:

- `any` or `*` (unrestricted network access)
- Known data exfiltration endpoints (webhook.site, ngrok, requestbin)

### Environment Variables

Declares environment variables the skill reads.

```yaml
env:
  - "API_KEY"
  - "SECRET_TOKEN"
```

High-risk patterns (flagged during audit):

- AWS credentials (`AWS_*`)
- Tokens (`*_TOKEN`)
- Secrets (`*_SECRET`)
- Passwords (`*_PASSWORD`)
- API keys (`*_KEY`)

### Executables

Declares binaries/commands the skill invokes.

```yaml
exec:
  - "node"
  - "curl"
  - "jq"
```

High-risk executables (flagged during audit):

- Shells: `bash`, `sh`, `zsh`, `fish`
- Privilege escalation: `sudo`, `su`
- Destructive commands: `rm`, `dd`, `mkfs`
- Dynamic execution: `eval`, `exec`

### Sensitive Data Flags

Optional flags indicating access to sensitive data types:

```yaml
sensitive_data:
  credentials: true # Passwords, tokens, keys
  personal_info: true # PII, contacts, messages
  financial: false # Financial data, transactions
```

### Additional Flags

```yaml
elevated: true # Requires sudo/admin access
system_config: true # Modifies system configuration
security_notes: "..." # Free-form security context
```

## Risk Levels

Skills are assessed into five risk levels based on their permissions:

| Level       | Criteria                             | Example                |
| ----------- | ------------------------------------ | ---------------------- |
| 🟢 Minimal  | No special permissions               | Pure computation skill |
| 🟡 Low      | Network access only                  | Weather API client     |
| 🟠 Moderate | 1-2 risk factors                     | Reads env vars         |
| 🔴 High     | 3+ risk factors or credential access | Password manager       |
| ⛔ Critical | Shell exec or elevated access        | System automation      |

## Auditing Skills

Use the CLI to audit permissions:

```bash
# Audit all skills
openclaw skills audit

# Show verbose risk factors
openclaw skills audit -v

# Filter by minimum risk level
openclaw skills audit --risk-level high

# Audit a specific skill
openclaw skills audit github

# JSON output
openclaw skills audit --json
```

## Generating Manifests

Generate a manifest template for an existing skill:

```bash
# Output to stdout
openclaw skills init-manifest my-skill

# Write to file
openclaw skills init-manifest my-skill -o manifest.yaml
```

## Security Configuration

Configure skill loading behavior in `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    security: {
      // How to handle skills without manifests or above risk threshold
      // "allow" | "warn" | "prompt" | "deny"
      // Default: "warn" (will change to "prompt" in future)
      requireManifest: "warn",

      // Maximum risk level to auto-load without confirmation
      // "minimal" | "low" | "moderate" | "high" | "critical"
      // Default: "moderate"
      maxAutoLoadRisk: "moderate",

      // Path to file with approved skill names
      // Skills in this file bypass all security checks
      approvedSkillsFile: "~/.openclaw/approved-skills.txt",

      // Log permission warnings at runtime
      // Default: true
      logViolations: true,
    },
  },
}
```

### Manifest Requirement Modes

| Mode       | No Manifest | Above Risk Threshold | Behavior                         |
| ---------- | ----------- | -------------------- | -------------------------------- |
| **allow**  | Load        | Load                 | Log warnings only                |
| **warn**   | Load        | Load                 | Log warnings (current default)   |
| **prompt** | Prompt      | Prompt               | Require user confirmation in CLI |
| **deny**   | Block       | Block                | Refuse to load                   |

### Auto-load Risk Threshold

The `maxAutoLoadRisk` setting controls which risk levels are auto-loaded:

- Skills at or below the threshold load automatically
- In **prompt** mode, skills above the threshold require user confirmation
- In **deny** mode, skills above the threshold are blocked
- In **allow**/**warn** modes, all skills load but high-risk ones log warnings

### Approved Skills File

Pre-approve specific skills to bypass all security checks:

```bash
# Add skills to the approved list
openclaw skills approve my-skill another-skill

# Or manually edit ~/.openclaw/approved-skills.txt
```

The approved skills file format is one skill name per line (lines starting with `#` are comments).

## Best Practices

1. **Always add a manifest** to your skills, even if permissions are minimal
2. **Be specific** about what you need — avoid wildcards when possible
3. **Include security_notes** for high-risk permissions to explain why they're needed
4. **Declare a purpose** so users understand what the skill does
5. **Audit regularly** with `openclaw skills audit` to review your skills

## Migration Guide

Existing skills without manifests continue to work but are flagged as "high" risk during audits. To migrate:

1. Run `openclaw skills init-manifest <skill-name>` to generate a template
2. Edit the manifest to match actual permissions
3. Add the `permissions` block to your `SKILL.md` frontmatter
4. Run `openclaw skills audit <skill-name>` to verify

---
