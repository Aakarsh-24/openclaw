#!/bin/bash
# Overnight Inbox Intelligence + Archive
# Extracts insights THEN archives noise

ACCOUNT="simon@puenteworks.com"
LOGDIR="/home/liam/clawd/logs"
LOGFILE="$LOGDIR/inbox-intelligence-$(date +%Y%m%d-%H%M).log"
INSIGHTS_FILE="/home/liam/clawd/memory/insights-digest-$(date +%Y%m%d).md"
ARCHIVED=0

mkdir -p "$LOGDIR"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOGFILE"
}

# Initialize insights file
cat > "$INSIGHTS_FILE" << 'EOF'
# Daily Inbox Insights Digest
**Date:** $(date +%Y-%m-%d)
**Source:** simon@puenteworks.com inbox analysis

## Key Patterns & Opportunities

EOF

log "=== INBOX INTELLIGENCE START ==="

# Phase 1: Analyze by category
log "Phase 1: Categorizing inbox..."

# Get sample of recent emails for analysis
gog gmail messages search "in:inbox" --account "$ACCOUNT" --max 100 --format json 2>/dev/null > /tmp/inbox_sample.json

# Count by category
NEWSLETTERS=$(cat /tmp/inbox_sample.json | grep -c "substack\|medium\|newsletter\|digest" || echo "0")
RECEIPTS=$(cat /tmp/inbox_sample.json | grep -c "receipt\|invoice\|payment\|order" || echo "0")
SECURITY=$(cat /tmp/inbox_sample.json | grep -c "security\|alert\|sign-in" || echo "0")
GITHUB=$(cat /tmp/inbox_sample.json | grep -c "github\|notifications" || echo "0")

log "Found: $NEWSLETTERS newsletters, $RECEIPTS receipts, $SECURITY security, $GITHUB GitHub"

# Phase 2: Extract valuable insights (KEEP these patterns)
log "Phase 2: Extracting insights..."

# Tool/service opportunities from receipts
RECEIPT_SENDERS=$(cat /tmp/inbox_sample.json | jq -r '.[] | select(.subject | test("receipt|invoice|payment"; "i")) | .from' 2>/dev/null | sort | uniq -c | sort -rn | head -10)
if [ -n "$RECEIPT_SENDERS" ]; then
  echo "### Active Subscriptions/Services" >> "$INSIGHTS_FILE"
  echo "\`\`\`" >> "$INSIGHTS_FILE"
  echo "$RECEIPT_SENDERS" >> "$INSIGHTS_FILE"
  echo "\`\`\`" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Extracted: Active services"
fi

# GitHub project activity
GITHUB_REPOS=$(cat /tmp/inbox_sample.json | jq -r '.[] | select(.from | contains("github")) | .subject' 2>/dev/null | grep -oP '\[\K[^\]]+' | sort | uniq -c | sort -rn | head -5)
if [ -n "$GITHUB_REPOS" ]; then
  echo "### Active GitHub Projects (CI/Activity)" >> "$INSIGHTS_FILE"
  echo "\`\`\`" >> "$INSIGHTS_FILE"
  echo "$GITHUB_REPOS" >> "$INSIGHTS_FILE"
  echo "\`\`\`" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Extracted: GitHub activity"
fi

# Networking/opportunity contacts
OPPORTUNITY_EMAILS=$(cat /tmp/inbox_sample.json | jq -r '.[] | select(.subject | test("job|opportunity|interview|meeting|introduction"; "i")) | "- **\(.from)**: \(.subject)"' 2>/dev/null | head -5)
if [ -n "$OPPORTUNITY_EMAILS" ]; then
  echo "### Potential Opportunities" >> "$INSIGHTS_FILE"
  echo "$OPPORTUNITY_EMAILS" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Extracted: Opportunities"
fi

# Phase 3: Archive PURE noise (leave insights for manual review)
log "Phase 3: Archiving pure noise..."

# Only archive obvious noise (not newsletters with potential value)
NOISE_SENDERS=(
  "USPSInformeddelivery@email.informeddelivery.usps.com"
  "website@e.aspca.org"
  "DoNotReply-MemberComm@email.anthem.com"
  "promotions@promo.glassesusa.com"
  "support@gld.com"
  "showroom@colleenmauerdesigns.com"
  "hello@maisonmiru.com"
  "spectrum@exchange.spectrum.com"
  "no-reply@dutchie.com"
  "teamtwilio@team.twilio.com"
)

for SENDER in "${NOISE_SENDERS[@]}"; do
  IDS=$(gog gmail messages search "from:$SENDER in:inbox" --account "$ACCOUNT" --plain 2>/dev/null | grep -E '^[0-9a-f]{16}' | awk '{print $1}')
  if [ -n "$IDS" ]; then
    COUNT=$(echo "$IDS" | wc -l)
    BATCH=$(echo "$IDS" | head -50 | tr '\n' ' ')
    if gog gmail batch modify $BATCH --remove INBOX --account "$ACCOUNT" >> "$LOGFILE" 2>&1; then
      ARCHIVED=$((ARCHIVED + COUNT))
      log "  Archived $COUNT from $SENDER"
    fi
    sleep 1
  fi
done

# Phase 4: Flag high-value for manual review
log "Phase 4: Flagging high-value items..."

# Security alerts
SECURITY_IDS=$(gog gmail messages search "from:no-reply@accounts.google.com in:inbox" --account "$ACCOUNT" --plain 2>/dev/null | grep -E '^[0-9a-f]{16}' | awk '{print $1}')
if [ -n "$SECURITY_IDS" ]; then
  COUNT=$(echo "$SECURITY_IDS" | wc -l)
  echo "### ⚠️ Security Alerts (Review Required)" >> "$INSIGHTS_FILE"
  echo "- $COUNT Google security alerts in inbox" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Flagged: $COUNT security alerts"
fi

# Invoices over $50
INVOICE_IDS=$(gog gmail messages search "subject:invoice in:inbox" --account "$ACCOUNT" --plain 2>/dev/null | grep -E '^[0-9a-f]{16}' | awk '{print $1}')
if [ -n "$INVOICE_IDS" ]; then
  COUNT=$(echo "$INVOICE_IDS" | wc -l)
  echo "### 💰 Invoices/Receipts (Review for tax/expense)" >> "$INSIGHTS_FILE"
  echo "- $COUNT invoices/receipts in inbox" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Flagged: $COUNT invoices"
fi

# Close insights file
cat >> "$INSIGHTS_FILE" << EOF

## Summary
- **Analyzed:** 100+ emails
- **Archived:** $ARCHIVED pure noise emails
- **Flagged for review:** Security alerts, invoices, opportunities

## Next Actions
1. Review security alerts
2. Check flagged opportunities
3. Extract receipts for tax records

---
*Auto-generated at $(date '+%H:%M:%S')*
EOF

log "=== COMPLETE ==="
log "Insights saved to: $INSIGHTS_FILE"
log "Total archived: $ARCHIVED"
log "Log file: $LOGFILE"

# Output summary for notification
echo "Inbox intelligence complete: $ARCHIVED archived, insights extracted to $(basename $INSIGHTS_FILE)"
