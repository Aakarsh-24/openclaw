---
title: Incident Response Procedure
summary: Security incident detection, classification, response, and recovery procedures for Clawdbot deployments.
permalink: /compliance/incident-response/
---

# Incident Response Procedure

This document defines the procedures for detecting, classifying, responding to, and recovering from security incidents in Clawdbot deployments.

## Scope

This procedure applies to:
- Unauthorized access attempts to the Clawdbot gateway
- Compromise of messaging channel credentials
- Malicious command execution via connected channels
- Data exfiltration or unauthorized data access
- Denial of service attacks against the gateway
- Prompt injection attacks that bypass controls

## Incident Classification

### Severity Levels

| Severity | Code | Description | Response Time | Examples |
|----------|------|-------------|---------------|----------|
| Critical | P1 | Active compromise or data breach | Immediate (15 min) | Credential theft, unauthorized admin access, active data exfiltration |
| High | P2 | Attempted compromise or security control failure | 1 hour | Repeated auth failures from unknown sources, RBAC bypass, successful prompt injection |
| Medium | P3 | Policy violation or anomalous behavior | 4 hours | Elevated exec usage outside normal hours, unusual channel activity patterns |
| Low | P4 | Security event requiring review | 24 hours | Failed pairing attempts, rate limit triggers, configuration warnings |

### Classification Criteria

Use these indicators to classify incidents:

**P1 (Critical)**
- Evidence of successful unauthorized access
- Credentials confirmed compromised
- Active malicious command execution
- Data confirmed exfiltrated
- Gateway integrity compromised

**P2 (High)**
- Multiple failed authentication attempts from single source
- Blocked malicious commands attempted
- Prompt injection detected with high confidence
- Security control bypassed but no confirmed impact
- Unauthorized configuration changes attempted

**P3 (Medium)**
- Single failed authentication from unknown source
- Elevated command execution outside policy
- Rate limit exceeded repeatedly
- Security audit findings unresolved

**P4 (Low)**
- Pairing request from unknown device
- Informational security warnings
- Minor policy deviations

## Detection

### Audit Log Monitoring

Security events are logged to `~/.clawdbot/audit.jsonl`. Monitor these event types:

| Event Type | Severity Indicator | Description |
|------------|-------------------|-------------|
| `auth.failure` | P2/P3 | Failed authentication attempt |
| `rbac.denied` | P3 | Permission check failed |
| `exec.reject` | P3 | Command blocked by policy |
| `pairing.reject` | P4 | Pairing request denied |
| `config.change` | P3/P4 | Configuration modified |

**Detection Query Examples**

```bash
# Find failed authentication attempts in last hour
cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "auth.failure" and .ts > (now - 3600 | todate))'

# Find RBAC denials by actor
cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "rbac.denied")' | jq -s 'group_by(.actor.id) | map({actor: .[0].actor.id, count: length})'

# Find command rejections
cat ~/.clawdbot/audit.jsonl | jq 'select(.type == "exec.reject")'

# Correlate events by trace ID
cat ~/.clawdbot/audit.jsonl | jq 'select(.traceId == "TRACE_ID_HERE")'
```

### Prometheus Alerts

Configure these alerts for automated detection (see [Observability Guide](/enterprise/observability#alerting)):

```yaml
groups:
  - name: clawdbot-security
    rules:
      # P2: High rate of authentication failures
      - alert: HighAuthFailureRate
        expr: increase(clawdbot_auth_failure_total[5m]) > 10
        for: 1m
        labels:
          severity: high
          incident_type: auth_failure
        annotations:
          summary: "High authentication failure rate detected"
          runbook: "Check audit logs for auth.failure events"

      # P2: RBAC denials spike
      - alert: RbacDenialSpike
        expr: increase(clawdbot_rbac_denied_total[5m]) > 5
        for: 1m
        labels:
          severity: high
          incident_type: rbac_denial
        annotations:
          summary: "Unusual RBAC denial rate"

      # P3: Rate limiting activated
      - alert: RateLimitExceeded
        expr: clawdbot_rate_limit_exceeded_total > 0
        for: 5m
        labels:
          severity: medium
          incident_type: rate_limit
        annotations:
          summary: "Rate limiting is actively blocking requests"
```

### Manual Detection Indicators

Watch for these patterns:
- Unexpected gateway restarts
- New devices in pairing store
- Configuration file modifications
- Unusual message patterns in connected channels
- Performance degradation

## Response Phases

### Phase 1: Triage (P1: 15 min, P2: 30 min, P3: 2 hr, P4: 24 hr)

**Objectives**: Confirm incident, assess scope, assign severity

1. **Verify the alert**
   ```bash
   # Check recent audit events
   tail -100 ~/.clawdbot/audit.jsonl | jq -c 'select(.outcome == "failure" or .outcome == "denied")'

   # Check gateway status
   clawdbot status --all

   # Run security audit
   clawdbot security audit --deep
   ```

2. **Identify affected components**
   - Which channels are involved?
   - Which users/actors are affected?
   - What data or functionality is at risk?

3. **Assign severity** using classification criteria above

4. **Document initial findings** in incident record (see template below)

5. **Notify stakeholders** per escalation matrix

### Phase 2: Containment (P1: 30 min, P2: 2 hr, P3: 8 hr)

**Objectives**: Stop active threat, prevent further damage

**Immediate containment actions by incident type:**

**Unauthorized Access**
```bash
# Rotate gateway authentication token
clawdbot config set gateway.auth.token "$(openssl rand -base64 32)"

# Restart gateway to force reconnection
clawdbot gateway stop && clawdbot gateway run

# Revoke specific device pairing
clawdbot pairing revoke --device-id DEVICE_ID
```

**Compromised Channel Credentials**
```bash
# Disable affected channel
clawdbot config set channels.CHANNEL.enabled false

# Rotate channel credentials
# (Provider-specific: regenerate bot token in provider dashboard)
clawdbot config set channels.CHANNEL.token "NEW_TOKEN"
```

**Malicious Command Execution**
```bash
# Enable strict approval mode
clawdbot config set approvals.exec.enabled true
clawdbot config set approvals.exec.requireApproval '["elevated","destructive"]'

# Restrict user permissions via RBAC
clawdbot config set rbac.assignments.SENDER_ID "viewer"
```

**Prompt Injection Attack**
```bash
# Block specific sender
clawdbot pairing revoke --channel CHANNEL --sender SENDER_ID

# Enable stricter input validation
clawdbot config set security.promptInjection.mode "strict"
```

### Phase 3: Eradication (P1: 2 hr, P2: 24 hr, P3: 72 hr)

**Objectives**: Remove threat, identify root cause

1. **Analyze attack vector**
   ```bash
   # Export relevant audit logs
   cat ~/.clawdbot/audit.jsonl | jq 'select(.ts >= "START_TIME" and .ts <= "END_TIME")' > incident-logs.json

   # Trace full attack path using trace IDs
   cat incident-logs.json | jq -s 'group_by(.traceId) | .[]'
   ```

2. **Identify root cause**
   - Misconfiguration?
   - Credential exposure?
   - Software vulnerability?
   - Social engineering?

3. **Remove malicious artifacts**
   - Clear compromised sessions: `clawdbot session clear --agent AGENT_ID`
   - Remove unauthorized pairings: `clawdbot pairing list && clawdbot pairing revoke`
   - Reset modified configurations

4. **Patch vulnerabilities**
   - Update Clawdbot if applicable: `clawdbot update`
   - Apply configuration hardening per security audit recommendations

### Phase 4: Recovery (P1: 4 hr, P2: 48 hr, P3: 1 week)

**Objectives**: Restore normal operations, verify security

1. **Verify clean state**
   ```bash
   # Run full security audit
   clawdbot security audit --deep

   # Verify no critical findings
   clawdbot security audit --summary
   ```

2. **Restore services gradually**
   - Re-enable channels one at a time
   - Monitor for anomalies after each restoration
   - Verify authorized users can access

3. **Confirm recovery**
   - All channels operational
   - Authentication working
   - No security audit warnings
   - Normal message processing

4. **Update monitoring**
   - Add new detection rules if needed
   - Adjust alert thresholds based on incident

### Phase 5: Post-Incident Review

**Objectives**: Document lessons learned, improve procedures

Conduct review within 5 business days of incident closure.

**Review agenda:**
1. Incident timeline reconstruction
2. Detection effectiveness assessment
3. Response procedure evaluation
4. Root cause analysis
5. Improvement recommendations

## Incident Record Template

```markdown
# Incident Record: [INC-YYYY-NNN]

## Summary
- **Severity**: P1/P2/P3/P4
- **Status**: Open/Contained/Eradicated/Recovered/Closed
- **Detected**: YYYY-MM-DD HH:MM UTC
- **Resolved**: YYYY-MM-DD HH:MM UTC
- **Duration**: X hours

## Description
[Brief description of the incident]

## Impact
- **Users affected**: N
- **Channels affected**: [list]
- **Data impact**: None/Exposed/Exfiltrated
- **Service impact**: None/Degraded/Unavailable

## Timeline
| Time (UTC) | Event | Actor |
|------------|-------|-------|
| HH:MM | Detection triggered | System |
| HH:MM | Triage started | [Name] |
| HH:MM | Containment action taken | [Name] |
| HH:MM | Root cause identified | [Name] |
| HH:MM | Recovery complete | [Name] |

## Root Cause
[Description of what caused the incident]

## Actions Taken
1. [Containment action]
2. [Eradication action]
3. [Recovery action]

## Evidence
- Audit logs: [location]
- Screenshots: [location]
- Configuration snapshots: [location]

## Lessons Learned
[What worked, what did not, what to improve]

## Follow-up Actions
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action item] | [Name] | YYYY-MM-DD | Open |
```

## Escalation Matrix

| Severity | Primary Contact | Secondary Contact | Executive Notification |
|----------|-----------------|-------------------|------------------------|
| P1 | On-call engineer | Security lead | Yes (within 1 hour) |
| P2 | On-call engineer | Security lead | Yes (within 4 hours) |
| P3 | Security team | - | No |
| P4 | Security team | - | No |

## Communication Templates

### Internal Notification (P1/P2)

```
Subject: [SECURITY INCIDENT] P[N] - [Brief description]

A security incident has been detected in the Clawdbot deployment.

Severity: P[N]
Status: [Triage/Containment/Eradication/Recovery]
Detected: [timestamp]

Impact:
- [Summary of impact]

Current Actions:
- [What is being done]

Next Update: [timestamp]

Incident Commander: [name]
```

### Status Update

```
Subject: [UPDATE] [INC-YYYY-NNN] - [Brief description]

Status: [Current status]
Update Time: [timestamp]

Progress since last update:
- [Actions completed]

Current focus:
- [What is being worked on]

Next update: [timestamp]
```

## Related Documentation

- [Threat Model](/security/threat-model) - Attack surface and mitigations
- [Security Hardening](/enterprise/security-hardening) - Security configuration
- [Observability Guide](/enterprise/observability) - Monitoring setup
- [Security Metrics](/compliance/security-metrics) - Incident KPIs

---

*Procedure owner: Security Team*
*Last reviewed: 2026-01-27*
*Next review: 2026-07-27*
