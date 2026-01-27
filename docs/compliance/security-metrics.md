---
title: Security Metrics and KPIs
summary: Key performance indicators and metrics for security monitoring in Clawdbot deployments.
permalink: /compliance/security-metrics/
---

# Security Metrics and KPIs

This document defines security metrics, key performance indicators (KPIs), and monitoring guidance for Clawdbot deployments.

## Purpose

Security metrics enable:
- Continuous monitoring of security controls
- Early detection of security incidents
- Measurement of security program effectiveness
- Evidence collection for compliance audits
- Data-driven security improvements

## Metrics Sources

### Audit Logs

Location: `~/.clawdbot/audit.jsonl`

Security-relevant event types:
- `auth.login`, `auth.failure`, `auth.logout`
- `rbac.denied`
- `pairing.request`, `pairing.approve`, `pairing.reject`, `pairing.revoke`
- `exec.request`, `exec.approve`, `exec.reject`
- `config.change`
- `gateway.start`, `gateway.stop`

### Prometheus Metrics

Endpoint: `GET /metrics` (requires gateway authentication)

Metrics are defined in `src/observability/metrics-registry.ts` and updated via diagnostic events.

## Access Control Metrics

### Authentication Failure Rate

**Definition**: Percentage of authentication attempts that fail

**Formula**: `(auth.failure count / total auth attempts) * 100`

**Threshold**:
| Level | Value | Action |
|-------|-------|--------|
| Normal | < 5% | Monitor |
| Warning | 5-15% | Investigate |
| Critical | > 15% | Incident response |

**Audit Log Query**:
```bash
# Count auth failures in last hour
FAILURES=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "auth.failure" and .ts > (now - 3600 | todate))' | wc -l)

# Count total auth attempts
TOTAL=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type | startswith("auth.") and .ts > (now - 3600 | todate))' | wc -l)

echo "Auth failure rate: $((FAILURES * 100 / TOTAL))%"
```

**Prometheus Alert**:
```yaml
- alert: HighAuthFailureRate
  expr: |
    (increase(clawdbot_auth_failure_total[1h]) /
     (increase(clawdbot_auth_login_total[1h]) + increase(clawdbot_auth_failure_total[1h]))) > 0.15
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Authentication failure rate exceeds 15%"
```

### RBAC Denial Rate

**Definition**: Rate of permission denials per hour

**Formula**: Count of `rbac.denied` events per hour

**Threshold**:
| Level | Value | Action |
|-------|-------|--------|
| Normal | < 10/hour | Monitor |
| Warning | 10-50/hour | Review access patterns |
| Critical | > 50/hour | Investigate potential attack |

**Audit Log Query**:
```bash
# RBAC denials per hour over last 24 hours
cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "rbac.denied")' | \
  jq -s 'group_by(.ts[:13]) | map({hour: .[0].ts[:13], count: length})'
```

**Prometheus Alert**:
```yaml
- alert: HighRbacDenialRate
  expr: increase(clawdbot_rbac_denied_total[1h]) > 50
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Unusual RBAC denial rate: {{ $value }} denials/hour"
```

### Unique Failed Actors

**Definition**: Count of distinct actors with authentication failures

**Formula**: Count of unique `actor.id` values in `auth.failure` events

**Threshold**:
| Level | Value | Action |
|-------|-------|--------|
| Normal | < 3/hour | Monitor |
| Warning | 3-10/hour | Investigate sources |
| Critical | > 10/hour | Potential attack |

**Audit Log Query**:
```bash
# Unique actors with auth failures in last hour
cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "auth.failure" and .ts > (now - 3600 | todate))' | \
  jq -s '[.[].actor.id] | unique | length'
```

## Incident Metrics

### Mean Time to Detect (MTTD)

**Definition**: Average time from incident occurrence to detection

**Formula**: `(Detection timestamp - Incident start timestamp) / Number of incidents`

**Target**: < 15 minutes for P1/P2 incidents

**Measurement**:
- Track detection time in incident records
- Compare against first suspicious audit event timestamp
- Review alert trigger times

### Mean Time to Contain (MTTC)

**Definition**: Average time from detection to containment

**Formula**: `(Containment timestamp - Detection timestamp) / Number of incidents`

**Target**:
| Severity | Target MTTC |
|----------|-------------|
| P1 | < 30 minutes |
| P2 | < 2 hours |
| P3 | < 8 hours |
| P4 | < 24 hours |

### Mean Time to Resolve (MTTR)

**Definition**: Average time from detection to full resolution

**Formula**: `(Resolution timestamp - Detection timestamp) / Number of incidents`

**Target**:
| Severity | Target MTTR |
|----------|-------------|
| P1 | < 4 hours |
| P2 | < 24 hours |
| P3 | < 72 hours |
| P4 | < 1 week |

### Incident Volume

**Definition**: Count of security incidents by severity over time

**Audit Log Query**:
```bash
# Security events that may indicate incidents
cat ~/.clawdbot/audit.jsonl | jq -c 'select(.outcome == "failure" or .outcome == "denied")' | \
  jq -s 'group_by(.type) | map({type: .[0].type, count: length}) | sort_by(.count) | reverse'
```

## Operational Metrics

### Gateway Uptime

**Definition**: Percentage of time gateway is operational

**Formula**: `(Uptime seconds / Total period seconds) * 100`

**Target**: > 99.9%

**Prometheus Metric**:
```prometheus
clawdbot_gateway_uptime_seconds
```

**Alert**:
```yaml
- alert: GatewayDown
  expr: up{job="clawdbot"} == 0
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Clawdbot gateway is down"
```

### Rate Limit Activations

**Definition**: Count of rate limit enforcements

**Formula**: Count of rate limit events per hour

**Threshold**:
| Level | Value | Action |
|-------|-------|--------|
| Normal | < 10/hour | Monitor |
| Warning | 10-100/hour | Review traffic patterns |
| Critical | > 100/hour | Potential DoS |

### Security Audit Score

**Definition**: Count of findings by severity from automated security audit

**Formula**: Run `clawdbot security audit --summary` and track over time

**Target**:
- Critical findings: 0
- Warning findings: < 5
- Info findings: Tracked but not alarmed

**Collection Script**:
```bash
#!/bin/bash
# Collect security audit metrics
DATE=$(date +%Y-%m-%d)
OUTPUT=$(clawdbot security audit --summary 2>/dev/null)

CRITICAL=$(echo "$OUTPUT" | grep -oP 'critical:\s*\K\d+' || echo 0)
WARNING=$(echo "$OUTPUT" | grep -oP 'warn:\s*\K\d+' || echo 0)
INFO=$(echo "$OUTPUT" | grep -oP 'info:\s*\K\d+' || echo 0)

echo "$DATE,$CRITICAL,$WARNING,$INFO" >> security-audit-trend.csv
```

## Channel Security Metrics

### Pairing Approval Rate

**Definition**: Percentage of pairing requests that are approved

**Formula**: `(pairing.approve count / pairing.request count) * 100`

**Threshold**: Low approval rate may indicate attack attempts

**Audit Log Query**:
```bash
# Pairing metrics for last 30 days
REQUESTS=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "pairing.request")' | wc -l)
APPROVED=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "pairing.approve")' | wc -l)
REJECTED=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "pairing.reject")' | wc -l)

echo "Pairing requests: $REQUESTS"
echo "Approved: $APPROVED ($((APPROVED * 100 / REQUESTS))%)"
echo "Rejected: $REJECTED ($((REJECTED * 100 / REQUESTS))%)"
```

### Command Rejection Rate

**Definition**: Percentage of exec requests that are rejected

**Formula**: `(exec.reject count / total exec events) * 100`

**Threshold**:
| Level | Value | Interpretation |
|-------|-------|----------------|
| Normal | < 5% | Policy working as expected |
| Elevated | 5-20% | Review blocked commands |
| High | > 20% | Potential abuse or misconfiguration |

## Grafana Dashboard

### Dashboard JSON

```json
{
  "title": "Clawdbot Security Metrics",
  "panels": [
    {
      "title": "Authentication Failures",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 0, "y": 0},
      "targets": [
        {"expr": "increase(clawdbot_auth_failure_total[24h])", "legendFormat": "24h failures"}
      ],
      "fieldConfig": {
        "defaults": {
          "thresholds": {
            "steps": [
              {"value": 0, "color": "green"},
              {"value": 10, "color": "yellow"},
              {"value": 50, "color": "red"}
            ]
          }
        }
      }
    },
    {
      "title": "RBAC Denials Rate",
      "type": "graph",
      "gridPos": {"h": 8, "w": 12, "x": 0, "y": 4},
      "targets": [
        {"expr": "rate(clawdbot_rbac_denied_total[5m])", "legendFormat": "Denials/sec"}
      ]
    },
    {
      "title": "Gateway Uptime",
      "type": "stat",
      "gridPos": {"h": 4, "w": 6, "x": 6, "y": 0},
      "targets": [
        {"expr": "clawdbot_gateway_uptime_seconds / 86400", "legendFormat": "Days"}
      ],
      "fieldConfig": {
        "defaults": {"unit": "d"}
      }
    },
    {
      "title": "Message Processing by Outcome",
      "type": "piechart",
      "gridPos": {"h": 8, "w": 6, "x": 12, "y": 4},
      "targets": [
        {"expr": "sum by (outcome) (clawdbot_message_processed_total)", "legendFormat": "{{outcome}}"}
      ]
    },
    {
      "title": "Security Events Timeline",
      "type": "graph",
      "gridPos": {"h": 8, "w": 18, "x": 0, "y": 12},
      "targets": [
        {"expr": "rate(clawdbot_auth_failure_total[5m])", "legendFormat": "Auth failures"},
        {"expr": "rate(clawdbot_rbac_denied_total[5m])", "legendFormat": "RBAC denials"}
      ]
    }
  ]
}
```

### Prometheus Recording Rules

Pre-compute common aggregations for dashboard performance:

```yaml
groups:
  - name: clawdbot-security-recording
    rules:
      - record: clawdbot:auth_failure_rate_1h
        expr: increase(clawdbot_auth_failure_total[1h])

      - record: clawdbot:rbac_denied_rate_1h
        expr: increase(clawdbot_rbac_denied_total[1h])

      - record: clawdbot:message_error_rate_5m
        expr: |
          rate(clawdbot_message_processed_total{outcome="error"}[5m]) /
          rate(clawdbot_message_processed_total[5m])
```

## Alerting Rules

### Complete Alert Configuration

```yaml
groups:
  - name: clawdbot-security-alerts
    rules:
      # Authentication alerts
      - alert: HighAuthFailureRate
        expr: clawdbot:auth_failure_rate_1h > 50
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High authentication failure rate"
          description: "{{ $value }} auth failures in the last hour"
          runbook_url: "/compliance/incident-response#authentication"

      - alert: BruteForceAttempt
        expr: clawdbot:auth_failure_rate_1h > 100
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Possible brute force attack"
          description: "{{ $value }} auth failures in the last hour"

      # RBAC alerts
      - alert: RbacDenialSpike
        expr: clawdbot:rbac_denied_rate_1h > 25
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Unusual RBAC denial rate"

      # Availability alerts
      - alert: GatewayDown
        expr: up{job="clawdbot"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Gateway is down"

      - alert: HighMessageErrorRate
        expr: clawdbot:message_error_rate_5m > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High message processing error rate"
          description: "{{ $value | humanizePercentage }} of messages failing"

      # Queue alerts
      - alert: QueueBacklog
        expr: clawdbot_queue_depth > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Message queue backlog building"
```

## Reporting

### Weekly Security Report Template

```markdown
# Weekly Security Report: [Week of YYYY-MM-DD]

## Executive Summary
- Overall security posture: [Good/Fair/Needs Attention]
- Open incidents: [count]
- New vulnerabilities: [count]

## Key Metrics

### Access Control
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Auth failure rate | X% | < 5% | [OK/WARN] |
| RBAC denials | X/week | < 70 | [OK/WARN] |
| Unique failed actors | X | < 21 | [OK/WARN] |

### Incident Response
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| MTTD (average) | X min | < 15 min | [OK/WARN] |
| MTTC (average) | X hours | < 2 hours | [OK/WARN] |
| Incidents this week | X | - | [Info] |

### Availability
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Gateway uptime | X% | > 99.9% | [OK/WARN] |
| Security audit score | X critical | 0 | [OK/WARN] |

## Incidents
[Summary of any incidents]

## Audit Findings
[New findings from security audit]

## Action Items
- [ ] [Action item 1]
- [ ] [Action item 2]

## Next Week Focus
[Planned security activities]
```

### Automated Report Generation

```bash
#!/bin/bash
# Generate weekly security metrics report

WEEK=$(date +%Y-W%V)
OUTPUT="security-report-$WEEK.md"

echo "# Weekly Security Report: $WEEK" > $OUTPUT
echo "" >> $OUTPUT

echo "## Access Control Metrics" >> $OUTPUT
echo "" >> $OUTPUT

# Auth failures
FAILURES=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "auth.failure" and .ts > (now - 604800 | todate))' | wc -l)
echo "- Authentication failures: $FAILURES" >> $OUTPUT

# RBAC denials
DENIALS=$(cat ~/.clawdbot/audit.jsonl | jq -c 'select(.type == "rbac.denied" and .ts > (now - 604800 | todate))' | wc -l)
echo "- RBAC denials: $DENIALS" >> $OUTPUT

echo "" >> $OUTPUT
echo "## Security Audit Summary" >> $OUTPUT
clawdbot security audit --summary 2>/dev/null >> $OUTPUT

echo "" >> $OUTPUT
echo "Report generated: $(date)" >> $OUTPUT
```

## Compliance Evidence

Use these metrics as evidence for compliance audits:

| SOC2 Criteria | Metric | Evidence Collection |
|---------------|--------|---------------------|
| CC4.1 | Gateway uptime, audit log completeness | Export uptime metrics, verify audit rotation |
| CC6.2 | Auth failure rate, RBAC denials | Export access control metrics |
| CC7.3 | MTTD, MTTC, MTTR | Document incident timelines |

## Related Documentation

- [Observability Guide](/enterprise/observability) - Prometheus and Grafana setup
- [Incident Response](/compliance/incident-response) - Incident handling procedures
- [Readiness Checklist](/compliance/readiness-checklist) - Compliance verification
- [Security Hardening](/enterprise/security-hardening) - Security configuration

---

*Document owner: Security Team*
*Last reviewed: 2026-01-27*
*Next review: 2026-07-27*
