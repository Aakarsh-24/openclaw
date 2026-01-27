---
title: Compliance Overview
summary: SOC2 and ISO 27001 compliance documentation and readiness resources for Clawdbot deployments.
permalink: /compliance/
---

# Compliance Overview

This section provides governance and procedure documentation to support SOC2 Type II and ISO 27001 compliance for Clawdbot enterprise deployments.

## Technical Controls Foundation

Clawdbot includes built-in security controls that form the technical foundation for compliance:

| Control | Implementation | Documentation |
|---------|---------------|---------------|
| Audit logging | `~/.clawdbot/audit.jsonl` with 7-day retention | [Security Hardening](/enterprise/security-hardening#audit-logging) |
| Role-based access control | 4 built-in roles with granular permissions | [RBAC Guide](/enterprise/security-hardening#role-based-access-control-rbac) |
| Authentication | Token, password, and Tailscale modes | [Gateway Authentication](/gateway/authentication) |
| Rate limiting | Token bucket with per-client tracking | [Rate Limiting](/enterprise/security-hardening#rate-limiting) |
| Security audit CLI | Automated checks for misconfigurations | [Security Audit](/cli/security) |

## Compliance Documents

### Policies and Procedures

| Document | Purpose | SOC2 Mapping | ISO 27001 Mapping |
|----------|---------|--------------|-------------------|
| [Incident Response](/compliance/incident-response) | Security incident detection, triage, and recovery | CC7.2, CC7.3, CC7.4 | A.16.1 |
| [Access Control Policy](/compliance/access-control-policy) | User access management and RBAC governance | CC6.1, CC6.2, CC6.3 | A.9.1, A.9.2, A.9.4 |
| [Change Management](/compliance/change-management) | Configuration and version change procedures | CC8.1 | A.12.1, A.14.2 |
| [Vulnerability Disclosure](/compliance/vulnerability-disclosure) | Responsible disclosure and security reporting | CC7.1 | A.12.6 |

### Measurement and Readiness

| Document | Purpose | SOC2 Mapping | ISO 27001 Mapping |
|----------|---------|--------------|-------------------|
| [Security Metrics](/compliance/security-metrics) | KPIs and continuous monitoring guidance | CC4.1, CC4.2 | A.18.2 |
| [Readiness Checklist](/compliance/readiness-checklist) | Self-assessment for audit preparation | All TSC | Clause 9, 10 |

## SOC2 Trust Services Criteria Coverage

| Category | Criteria | Primary Documents |
|----------|----------|-------------------|
| CC1: Control Environment | Governance and oversight | Readiness Checklist |
| CC2: Communication | Internal security communication | Incident Response |
| CC3: Risk Assessment | Risk identification | [Threat Model](/security/threat-model) |
| CC4: Monitoring | Ongoing monitoring activities | Security Metrics |
| CC5: Control Activities | Policy implementation | Access Control Policy |
| CC6: Logical Access | Access management | Access Control Policy |
| CC7: System Operations | Incident management | Incident Response, Vulnerability Disclosure |
| CC8: Change Management | Change control | Change Management |
| CC9: Risk Mitigation | Recovery planning | Incident Response |

## ISO 27001 Annex A Coverage

| Control Domain | Controls | Primary Documents |
|----------------|----------|-------------------|
| A.9 Access Control | A.9.1-A.9.4 | Access Control Policy |
| A.12 Operations Security | A.12.1, A.12.6 | Change Management, Vulnerability Disclosure |
| A.14 System Acquisition | A.14.2 | Change Management |
| A.16 Incident Management | A.16.1 | Incident Response |
| A.18 Compliance | A.18.2 | Security Metrics, Readiness Checklist |

## Related Documentation

- [Threat Model](/security/threat-model) - Security threat analysis and mitigations
- [Data Handling Policy](/security/data-handling) - Data storage, retention, and privacy
- [Security Hardening Guide](/enterprise/security-hardening) - Technical security configuration
- [Observability Guide](/enterprise/observability) - Metrics and monitoring setup

## Automated Compliance Verification

Run the security audit to verify compliance controls:

```bash
# Full security audit with deep gateway probe
clawdbot security audit --deep

# Summary of findings by severity
clawdbot security audit --summary
```

The audit checks:
- Gateway authentication configuration
- RBAC policy effectiveness
- File permission hardening
- Channel security policies
- Rate limiting status
- Audit logging enablement

## Getting Started

1. **Assess current state**: Run `clawdbot security audit --deep` to identify gaps
2. **Review policies**: Read each compliance document and adapt to your organization
3. **Implement controls**: Configure RBAC, audit logging, and authentication per guidelines
4. **Collect evidence**: Use the Readiness Checklist to gather audit artifacts
5. **Monitor continuously**: Set up Security Metrics dashboards for ongoing compliance

---

*Last updated: 2026-01-27*
