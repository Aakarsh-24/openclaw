---
title: Compliance Readiness Checklist
summary: Self-assessment checklist for SOC2 Type II and ISO 27001 compliance readiness.
permalink: /compliance/readiness-checklist/
---

# Compliance Readiness Checklist

This checklist helps assess readiness for SOC2 Type II and ISO 27001 compliance audits. Use it to identify gaps and collect evidence.

## How to Use This Checklist

1. **Run automated checks**: `clawdbot security audit --deep`
2. **Review each section**: Verify controls are implemented
3. **Collect evidence**: Document artifacts for each control
4. **Track remediation**: Address any gaps identified
5. **Schedule reviews**: Re-assess quarterly

## SOC2 Trust Services Criteria

### CC1: Control Environment

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC1.1 | Security policies documented | Review `/compliance/*` docs exist | Policy documents |
| CC1.2 | Roles and responsibilities defined | Check RBAC config | `clawdbot config get rbac` |
| CC1.3 | Security training provided | N/A (organizational) | Training records |
| CC1.4 | Competence evaluated | N/A (organizational) | Performance records |

**Automated Check:**
```bash
# Verify RBAC is enabled and configured
clawdbot config get rbac.enabled
clawdbot config get rbac.roles
```

### CC2: Communication and Information

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC2.1 | Security policies communicated | Policies accessible | Documentation links |
| CC2.2 | External party communications | Disclosure policy exists | [Vulnerability Disclosure](/compliance/vulnerability-disclosure) |
| CC2.3 | Incident communication | Incident response documented | [Incident Response](/compliance/incident-response) |

### CC3: Risk Assessment

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC3.1 | Risk objectives defined | Threat model documented | [Threat Model](/security/threat-model) |
| CC3.2 | Risk identification | Security audit identifies risks | `clawdbot security audit --deep` |
| CC3.3 | Fraud risk considered | Prompt injection risks documented | Threat model attack vectors |
| CC3.4 | Change risk assessed | Change management documented | [Change Management](/compliance/change-management) |

**Automated Check:**
```bash
# Run full security audit
clawdbot security audit --deep

# Check for critical findings
clawdbot security audit --summary
```

### CC4: Monitoring Activities

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC4.1 | Ongoing monitoring | Audit logging enabled | Check audit.jsonl exists |
| CC4.2 | Control effectiveness evaluated | Security metrics tracked | [Security Metrics](/compliance/security-metrics) |

**Automated Check:**
```bash
# Verify audit logging is working
ls -la ~/.clawdbot/audit.jsonl

# Check recent audit events
tail -10 ~/.clawdbot/audit.jsonl | jq .type

# Verify Prometheus metrics available (if configured)
curl -s http://localhost:18789/metrics | head -20
```

### CC5: Control Activities

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC5.1 | Controls mitigate risks | Security controls documented | Security hardening guide |
| CC5.2 | Technology controls | Automated checks implemented | Security audit CLI |
| CC5.3 | Policies deployed | Configuration enforces policy | Config validation |

### CC6: Logical and Physical Access

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC6.1 | Access rights defined | RBAC roles documented | [Access Control Policy](/compliance/access-control-policy) |
| CC6.2 | Access provisioned | Assignment process defined | Access policy procedures |
| CC6.3 | Access removed | Revocation process defined | Access policy procedures |
| CC6.4 | Access reviewed | Review schedule exists | Quarterly review records |
| CC6.5 | Physical access | N/A (software system) | - |
| CC6.6 | Authentication mechanisms | Token/password/Tailscale configured | Gateway auth config |
| CC6.7 | Access credentials managed | Token rotation guidance | Security hardening guide |
| CC6.8 | Transmission protected | Rate limiting implemented | Rate limit config |

**Automated Check:**
```bash
# Verify authentication is configured
clawdbot security audit --deep | grep -i "auth"

# Check RBAC is enabled
clawdbot config get rbac.enabled

# Verify no wildcard allowlists
clawdbot security audit --deep | grep -i "wildcard"
```

### CC7: System Operations

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC7.1 | Vulnerabilities detected | Security audit runs | Audit output |
| CC7.2 | Anomalies monitored | Alerting configured | Prometheus alerts |
| CC7.3 | Incidents evaluated | Incident response defined | [Incident Response](/compliance/incident-response) |
| CC7.4 | Incidents responded to | Response procedures exist | Incident response phases |
| CC7.5 | Recovery activities | Recovery procedures exist | Incident response Phase 4 |

**Automated Check:**
```bash
# Run vulnerability scan
clawdbot security audit --deep

# Check for security findings
clawdbot security audit --summary
```

### CC8: Change Management

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC8.1 | Changes authorized | Change process documented | [Change Management](/compliance/change-management) |

**Automated Check:**
```bash
# Check config change audit events
cat ~/.clawdbot/audit.jsonl | jq 'select(.type == "config.change")' | tail -5
```

### CC9: Risk Mitigation

| Req | Control | Verification | Evidence |
|-----|---------|--------------|----------|
| CC9.1 | Risk mitigation | Controls reduce risk | Threat model mitigations |
| CC9.2 | Vendor risk | Provider risks documented | Data handling policy |

## ISO 27001 Annex A Controls

### A.5: Information Security Policies

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.5.1.1 | Policies for information security | Compliance documentation suite |
| A.5.1.2 | Review of policies | Review dates on policy documents |

### A.6: Organization of Information Security

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.6.1.1 | Information security roles | RBAC role definitions |
| A.6.1.2 | Segregation of duties | Role separation (admin vs user) |

### A.9: Access Control

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.9.1.1 | Access control policy | [Access Control Policy](/compliance/access-control-policy) |
| A.9.1.2 | Access to networks | Gateway bind configuration |
| A.9.2.1 | User registration | Pairing procedures |
| A.9.2.2 | Access provisioning | Role assignment procedures |
| A.9.2.3 | Privileged access | Admin/operator role restrictions |
| A.9.2.4 | Secret authentication | Token generation guidance |
| A.9.2.5 | Access rights review | Quarterly review schedule |
| A.9.2.6 | Access removal | Revocation procedures |
| A.9.4.1 | Access restriction | RBAC permission checks |
| A.9.4.2 | Secure log-on | Rate limiting, exponential backoff |
| A.9.4.3 | Password management | Token/password requirements |

**Automated Check:**
```bash
# Full access control verification
clawdbot security audit --deep | grep -E "(rbac|auth|pairing|allowlist)"
```

### A.12: Operations Security

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.12.1.1 | Documented procedures | CLI documentation |
| A.12.1.2 | Change management | [Change Management](/compliance/change-management) |
| A.12.1.4 | Separation of environments | Config isolation per agent |
| A.12.4.1 | Event logging | Audit log implementation |
| A.12.4.2 | Protection of logs | File permissions (0o600) |
| A.12.4.3 | Admin/operator logs | Auth events logged |
| A.12.6.1 | Technical vulnerabilities | Security audit CLI |

### A.14: System Development

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.14.2.2 | Change control | Change management procedures |
| A.14.2.3 | Technical review | Security audit after changes |

### A.16: Incident Management

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.16.1.1 | Responsibilities defined | Incident response roles |
| A.16.1.2 | Reporting events | Detection procedures |
| A.16.1.3 | Reporting weaknesses | Vulnerability disclosure |
| A.16.1.4 | Assessment of events | Severity classification |
| A.16.1.5 | Response to incidents | Response phases |
| A.16.1.6 | Learning from incidents | Post-incident review |
| A.16.1.7 | Collection of evidence | Evidence collection guidance |

### A.18: Compliance

| Control | Requirement | Evidence |
|---------|-------------|----------|
| A.18.2.2 | Compliance with policies | Security audit verification |
| A.18.2.3 | Technical compliance | Automated compliance checks |

## Evidence Collection Guide

### Automated Evidence

| Evidence Type | Collection Method | Frequency |
|--------------|-------------------|-----------|
| Security audit report | `clawdbot security audit --deep > audit-$(date +%Y%m%d).txt` | Weekly |
| Configuration snapshot | `clawdbot config show > config-$(date +%Y%m%d).yaml` | After changes |
| Audit log export | `cp ~/.clawdbot/audit*.jsonl evidence/` | Daily |
| Metrics snapshot | `curl localhost:18789/metrics > metrics-$(date +%Y%m%d).txt` | Weekly |

### Manual Evidence

| Evidence Type | Collection Method | Frequency |
|--------------|-------------------|-----------|
| Access review records | Document review meetings | Quarterly |
| Incident records | Completed incident templates | Per incident |
| Training records | Training completion certificates | Annually |
| Policy acknowledgments | Signed policy forms | At hire, annually |

### Evidence Retention

| Evidence Type | Retention Period | Storage |
|--------------|------------------|---------|
| Audit logs | 1 year | Secure backup |
| Security audits | 2 years | Document management |
| Incident records | 3 years | Secure archive |
| Configuration history | 1 year | Version control |

## Gap Remediation

### Priority Matrix

| Severity | Example | Remediation Timeframe |
|----------|---------|----------------------|
| Critical | No gateway auth, wildcard allowlists | Immediate (24 hours) |
| High | RBAC disabled, weak tokens | 1 week |
| Medium | Missing documentation, review overdue | 30 days |
| Low | Informational findings | 90 days |

### Common Gaps and Remediation

| Gap | Finding | Remediation |
|-----|---------|-------------|
| No RBAC | `rbac.enabled: false` | Enable RBAC, assign roles |
| Weak auth | Token < 24 chars | Generate strong token |
| Open DMs | `dmPolicy: "open"` | Use pairing or allowlist |
| No audit | Audit file missing | Verify audit logging config |
| Wildcard access | `allowFrom: ["*"]` | Replace with explicit IDs |

## Compliance Summary Dashboard

Run this script to generate a compliance status summary:

```bash
#!/bin/bash
echo "=== Clawdbot Compliance Status ==="
echo "Date: $(date)"
echo ""

echo "--- Security Audit Summary ---"
clawdbot security audit --summary 2>/dev/null || echo "Security audit failed"
echo ""

echo "--- RBAC Status ---"
clawdbot config get rbac.enabled 2>/dev/null || echo "RBAC config unavailable"
echo ""

echo "--- Gateway Auth ---"
clawdbot config get gateway.auth.mode 2>/dev/null || echo "Auth config unavailable"
echo ""

echo "--- Audit Log Status ---"
if [ -f ~/.clawdbot/audit.jsonl ]; then
    echo "Audit log exists"
    echo "Last entry: $(tail -1 ~/.clawdbot/audit.jsonl | jq -r '.ts')"
    echo "Total events: $(wc -l < ~/.clawdbot/audit.jsonl)"
else
    echo "WARNING: No audit log found"
fi
echo ""

echo "--- Critical Findings ---"
clawdbot security audit --deep 2>/dev/null | grep -i "critical" || echo "No critical findings"
```

## Review Schedule

| Review Type | Frequency | Participants | Output |
|-------------|-----------|--------------|--------|
| Access review | Quarterly | Security, HR | Updated assignments |
| Policy review | Semi-annually | Security, Legal | Updated policies |
| Security audit | Weekly (automated) | Security | Audit report |
| Full compliance assessment | Annually | Security, Audit | Readiness report |

## Certification Path

### SOC2 Type II

1. **Gap assessment** (this checklist)
2. **Remediation** (address critical/high gaps)
3. **Control operation** (3-12 month observation period)
4. **Auditor engagement**
5. **Evidence collection** (automated + manual)
6. **Audit examination**
7. **Report issuance**

### ISO 27001

1. **Gap assessment** (this checklist)
2. **ISMS documentation**
3. **Control implementation**
4. **Internal audit**
5. **Management review**
6. **Certification audit (Stage 1)**
7. **Certification audit (Stage 2)**
8. **Certification**
9. **Surveillance audits** (annually)

## Related Documentation

- [Compliance Overview](/compliance/) - Compliance documentation hub
- [Incident Response](/compliance/incident-response) - Incident procedures
- [Access Control Policy](/compliance/access-control-policy) - Access management
- [Security Metrics](/compliance/security-metrics) - Monitoring KPIs
- [Threat Model](/security/threat-model) - Risk assessment

---

*Checklist owner: Security Team*
*Last updated: 2026-01-27*
*Next review: 2026-04-27*
