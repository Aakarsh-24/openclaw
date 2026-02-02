# Security Policy

If you believe you've found a security issue in OpenClaw, please report it privately.

## Reporting

- Email: `steipete@gmail.com`
- What to include: reproduction steps, impact assessment, and (if possible) a minimal PoC.

## Bug Bounties

OpenClaw is a labor of love. There is no bug bounty program and no budget for paid reports. Please still disclose responsibly so we can fix issues quickly.
The best way to help the project right now is by sending PRs.

## Out of Scope

- Public Internet Exposure
- Using OpenClaw in ways that the docs recommend not to
- Prompt injection attacks

## Operational Guidance

For threat model + hardening guidance (including `openclaw security audit --deep` and `--fix`), see:

- `https://docs.openclaw.ai/gateway/security`

### Web Interface Safety

OpenClaw's web interface is intended for local use only. Do **not** bind it to the public internet; it is not hardened for public exposure.

## Runtime Requirements

### Node.js Version

OpenClaw requires **Node.js 22.12.0 or later** (LTS). This version includes important security patches:

- CVE-2025-59466: async_hooks DoS vulnerability
- CVE-2026-21636: Permission model bypass vulnerability

Verify your Node.js version:

```bash
node --version  # Should be v22.12.0 or later
```

### Docker Security

When running OpenClaw in Docker:

1. The official image runs as a non-root user (`node`) for reduced attack surface
2. Use `--read-only` flag when possible for additional filesystem protection
3. Limit container capabilities with `--cap-drop=ALL`

Example secure Docker run:

```bash
docker run --read-only --cap-drop=ALL \
  -v openclaw-data:/app/data \
  openclaw/openclaw:latest
```

## Security Scanning

This project uses `detect-secrets` for automated secret detection in CI/CD.
See `.detect-secrets.cfg` for configuration and `.secrets.baseline` for the baseline.

Run locally:

```bash
pip install detect-secrets==1.5.0
detect-secrets scan --baseline .secrets.baseline
```

# Security Policy

This project operates with elevated privileges, executes code, and interacts with external systems using long-lived credentials. **Security failures can result in full host compromise.** This document defines how to report vulnerabilities and how operators must respond.

---

## Supported Versions

Only the `main` branch and the most recent tagged release are supported for security fixes.

Do **not** assume older releases are safe.

---

## Threat Model (Read This First)

OpenClaw:
- Executes code and tools on behalf of users
- Accepts **untrusted input** (messages, prompts, events)
- Stores and loads **secrets at runtime**
- Is commonly deployed with network access and automation privileges

### Primary Threats
- Remote Code Execution (RCE)
- Credential exfiltration from `.env`, containers, volumes, CI
- Lateral movement using reused secrets
- Persistence via cron, services, or modified startup scripts
- Abuse of third-party APIs (LLMs, bots, trading, messaging)

**If OpenClaw is compromised, assume the host is compromised.**

---

## Incident Response (RCE / Active Exploitation)

If you suspect or confirm exploitation:

### 1. Contain Immediately
- Stop OpenClaw and any related services
- Disable inbound access (ports, tunnels, reverse proxies)
- Isolate the host from the network if possible

### 2. Preserve Evidence (Optional but Recommended)
- Save application logs
- Save container logs
- Note timestamps, IPs, and abnormal behavior

### 3. Assume All Secrets Are Compromised
This includes but is not limited to:
- `.env` files
- LLM API keys (OpenAI, Anthropic, etc.)
- Bot tokens (Discord, Telegram, Slack, Signal)
- Webhooks
- CI/CD secrets
- SSH keys accessible to the process
- Tokens cached in containers or volumes

### 4. Rotate and Revoke
- Revoke old keys at the provider level
- Generate new keys
- Do not reuse values
- Do not keep old keys “just in case”

### 5. Rebuild From Clean State
- Delete containers, images, and volumes used by OpenClaw
- Rebuild from fresh sources
- Prefer redeploying to a new host if compromise is likely

**Patching in place after RCE is not sufficient.**

---

## Credential Management Requirements

### Required Practices
- Do not hard-code secrets
- Do not commit `.env` or config files with secrets
- Restrict file permissions (`chmod 600 .env`)
- Use least-privilege API keys
- Rotate secrets regularly and after any incident

### Strongly Recommended
- Use a secret manager instead of `.env`
- Use short-lived tokens where possible
- Apply outbound network restrictions
- Run OpenClaw as a non-root user
- Do not expose services to the public internet unless required

---

## Secure Deployment Guidelines

- Do not expose OpenClaw gateways directly to the internet
- Avoid running with unnecessary filesystem access
- Avoid mounting sensitive host directories
- Audit Docker volumes for stored secrets
- Treat CI runners and automation as high-risk targets

---

## Reporting a Vulnerability

### How to Report
Email: `steipete@gmail.com` 
(If PGP is provided, encrypted disclosure is preferred.)

### Include:
- Description of the issue
- Impact (RCE, credential leak, privilege escalation, etc.)
- Steps to reproduce (if safe)
- Affected versions or commit hashes
- Any indicators of active exploitation

### Expectations
- Please disclose responsibly
- Do not publish exploit details before a fix or advisory
- We aim to acknowledge reports promptly

---

## Bug Bounties

There is currently **no formal bug bounty program**.  
Valid, high-impact reports are still strongly encouraged.

---

## User Responsibility Notice

OpenClaw is powerful by design.  
If you deploy it with automation, network access, or privileged credentials, **you accept operational security responsibility**.

If you do not understand the risks described above, do not deploy OpenClaw in production or on exposed systems.
