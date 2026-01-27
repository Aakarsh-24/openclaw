---
title: Access Control Policy
summary: User access management, RBAC governance, and authorization procedures for Clawdbot deployments.
permalink: /compliance/access-control-policy/
---

# Access Control Policy

This policy defines the principles, roles, and procedures for managing user access to Clawdbot systems.

## Policy Statement

Access to Clawdbot functionality shall be granted based on the principle of least privilege. Users receive only the permissions necessary to perform their authorized functions, and access is regularly reviewed and revoked when no longer needed.

## Scope

This policy applies to:
- Gateway API access
- Messaging channel interactions
- Command execution permissions
- Administrative functions
- Agent and tool access

## Access Control Model

Clawdbot implements Role-Based Access Control (RBAC) as defined in `src/security/rbac.ts`.

### Built-in Roles

| Role | Description | Permissions | Use Case |
|------|-------------|-------------|----------|
| `admin` | Full administrative access | All permissions | System administrators |
| `operator` | Operational access with approval rights | `exec`, `exec.approve` | Operations staff, power users |
| `user` | Standard execution access | `exec` | Regular users |
| `viewer` | Read-only access | `read-only` | Auditors, observers |

### Permission Types

| Permission | Description | Grants |
|------------|-------------|--------|
| `exec` | Execute basic commands | Shell commands, tool invocations |
| `exec.elevated` | Execute privileged commands | sudo, system administration |
| `exec.approve` | Approve pending executions | Approve requests from agents or other users |
| `admin` | Full administrative access | All permissions including RBAC management |
| `read-only` | View-only access | Read operations, no tool execution |

### Permission Hierarchy

```
admin
  └── exec.elevated
        └── exec.approve
              └── exec
                    └── read-only
```

The `admin` permission implicitly grants all other permissions.

## Authentication Methods

### Gateway Authentication

| Method | Security Level | Use Case | Configuration |
|--------|---------------|----------|---------------|
| Token | High | API clients, automation | `gateway.auth.mode: token` |
| Password | Medium | Interactive users | `gateway.auth.mode: password` |
| Tailscale | High | Zero-trust networking | `gateway.tailscale.mode: serve` |
| Device Token | High | Paired devices | Automatic after pairing approval |

**Token Requirements:**
- Minimum 24 characters
- Generated with cryptographic randomness
- Stored securely (environment variable or secrets manager)

```bash
# Generate compliant token
openssl rand -base64 32
```

### Channel Authentication

Messaging channel access is controlled via:

1. **Pairing codes**: 16-character codes with 80-bit entropy for initial authorization
2. **Allowlists**: Per-channel lists of authorized sender IDs
3. **Rate limiting**: 10 pairing attempts per minute maximum

## Access Provisioning

### New User Access Request

1. **Request submission**: User submits access request specifying:
   - Required role
   - Business justification
   - Channels needed
   - Duration (if temporary)

2. **Approval**: Security team or designated approver reviews request

3. **Provisioning**: Administrator configures access:

```yaml
# config.yaml
rbac:
  enabled: true
  assignments:
    "user@example.com": operator    # Assign role by user ID
    "team-channel-id": user         # Assign role by channel/group
```

4. **Verification**: User confirms access works as expected

5. **Documentation**: Access grant recorded in access log

### Role Assignment via CLI

```bash
# Assign user to role
clawdbot config set rbac.assignments.USER_ID "role_name"

# Verify assignment
clawdbot config get rbac.assignments.USER_ID
```

### Channel Authorization via Pairing

```bash
# Initiate pairing (user sends from their device)
# Bot responds with pairing code

# Administrator approves pairing
clawdbot pairing approve --code PAIRING_CODE

# Or add directly to allowlist
clawdbot config set channels.telegram.dm.allowFrom '["user_id_1", "user_id_2"]'
```

## Access Review and Revocation

### Periodic Access Review

Conduct access reviews:
- **Admin role**: Quarterly
- **Operator role**: Semi-annually
- **User role**: Annually
- **All roles**: Upon role change or termination

**Review checklist:**
- [ ] User still requires access
- [ ] Role is appropriate for current responsibilities
- [ ] No excessive permissions
- [ ] Last access date within expected timeframe

### Access Revocation

**Immediate revocation triggers:**
- Employment termination
- Role change removing need
- Security incident
- Policy violation

**Revocation procedure:**

```bash
# Remove RBAC assignment
clawdbot config unset rbac.assignments.USER_ID

# Revoke channel pairing
clawdbot pairing revoke --channel CHANNEL --sender USER_ID

# Revoke device pairing
clawdbot pairing revoke --device-id DEVICE_ID

# Rotate gateway token if shared
clawdbot config set gateway.auth.token "$(openssl rand -base64 32)"
```

### Emergency Access Revocation

For P1/P2 security incidents:

```bash
# Disable all channel access temporarily
clawdbot config set channels.defaults.dmPolicy "disabled"

# Rotate gateway authentication
clawdbot config set gateway.auth.token "$(openssl rand -base64 32)"

# Restart gateway to terminate active sessions
clawdbot gateway stop && clawdbot gateway run
```

## Tool and Agent Restrictions

### Tool Access Control

Restrict tools per role:

```yaml
rbac:
  roles:
    restricted_user:
      name: "Restricted User"
      permissions: [exec]
      tools:
        allow:
          - read
          - search
          - glob
        deny:
          - bash
          - write
          - edit
```

### Agent Access Control

Restrict agents per role:

```yaml
rbac:
  roles:
    limited_agent_access:
      name: "Limited Agent Access"
      permissions: [exec]
      agents:
        - main
        - support
      # User cannot access other agents
```

## Audit and Logging

### Access Events Logged

All access-related events are logged to `~/.clawdbot/audit.jsonl`:

| Event Type | Description | Data Captured |
|------------|-------------|---------------|
| `auth.login` | Successful authentication | Actor, method, timestamp |
| `auth.failure` | Failed authentication | Actor, reason, IP address |
| `rbac.denied` | Permission denied | Actor, action, resource, reason |
| `pairing.request` | Pairing initiated | Channel, sender |
| `pairing.approve` | Pairing approved | Actor, target device |
| `pairing.reject` | Pairing denied | Actor, target, reason |
| `pairing.revoke` | Access revoked | Actor, target device |

### Audit Log Queries

```bash
# Authentication failures in last 24 hours
cat ~/.clawdbot/audit.jsonl | jq 'select(.type == "auth.failure" and .ts > (now - 86400 | todate))'

# All RBAC denials for a user
cat ~/.clawdbot/audit.jsonl | jq 'select(.type == "rbac.denied" and .actor.id == "USER_ID")'

# Pairing activity summary
cat ~/.clawdbot/audit.jsonl | jq 'select(.type | startswith("pairing."))'
```

## Rate Limiting

Protection against brute-force attacks:

| Scope | Limit | Window | Action |
|-------|-------|--------|--------|
| Unauthenticated requests | 60 | 1 minute | Block |
| Channel messages | 200 | 1 minute | Queue |
| Pairing attempts | 10 | 1 minute | Reject |
| Auth failures | 5 | 5 minutes | Exponential backoff |

Rate limit status is auditable via Prometheus metrics.

## Compliance Verification

### Security Audit Checks

The `clawdbot security audit` command verifies:

- RBAC is enabled for production deployments
- Gateway authentication is configured
- No wildcard allowlists (`*`)
- File permissions are restrictive
- Rate limiting is active

```bash
# Run access control audit
clawdbot security audit --deep | grep -E "(rbac|auth|pairing)"
```

### Access Control Checklist

- [ ] RBAC is enabled (`rbac.enabled: true`)
- [ ] Default role is appropriate (`rbac.defaultRole`)
- [ ] Admin role assignments are documented
- [ ] Gateway authentication is enabled
- [ ] Channel allowlists are explicit (no wildcards)
- [ ] Pairing rate limiting is active
- [ ] Audit logging is enabled
- [ ] Access reviews are scheduled

## Exceptions

Access control exceptions require:
- Written justification
- Security team approval
- Defined expiration date
- Compensating controls documented
- Periodic review

## Policy Violations

Violations of this policy may result in:
- Immediate access revocation
- Security incident classification
- Escalation per incident response procedure

## Related Documentation

- [Security Hardening Guide](/enterprise/security-hardening#role-based-access-control-rbac) - RBAC configuration details
- [Gateway Authentication](/gateway/authentication) - Authentication setup
- [Pairing Guide](/start/pairing) - Device pairing procedures
- [Incident Response](/compliance/incident-response) - Handling access-related incidents

---

*Policy owner: Security Team*
*Effective date: 2026-01-27*
*Last reviewed: 2026-01-27*
*Next review: 2026-07-27*
