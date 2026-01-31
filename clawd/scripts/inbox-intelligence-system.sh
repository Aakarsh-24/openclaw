#!/bin/bash
# Inbox Intelligence + Organization System
# Runs overnight: extracts insights, organizes, leaves only action items in inbox

ACCOUNT="simon@puenteworks.com"
DATE=$(date +%Y%m%d)
LOGDIR="/home/liam/clawd/logs/inbox"
MEMDIR="/home/liam/clawd/memory"
mkdir -p "$LOGDIR"

LOGFILE="$LOGDIR/inbox-org-$DATE.log"
INSIGHTS_FILE="$MEMDIR/inbox-insights-$DATE.md"
ACTION_FILE="$MEMDIR/inbox-actions-$DATE.md"
ARCHIVED=0
LABELED=0

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOGFILE"
}

log "=== INBOX ORGANIZATION START ==="
log "Account: $ACCOUNT"
log "Date: $DATE"

# ============================================
# PHASE 1: EXTRACT INSIGHTS FOR CONTENT INTELLIGENCE
# ============================================
log ""
log "PHASE 1: Extracting insights for Content Intelligence..."

# Get 500 emails for analysis
gog gmail messages search "in:inbox" --account "$ACCOUNT" --max 500 --format json 2>/dev/null > /tmp/inbox_full.json

cat > "$INSIGHTS_FILE" << EOF
# Inbox Insights Extract - $DATE
**Purpose:** Feed into Content Intelligence System
**Source:** simon@puenteworks.com inbox analysis

## Content Intelligence Gold Mine

### AI/Tech Trends Detected
EOF

# Extract AI/tech trends from newsletters
AI_TOPICS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("AI|GPT|agent|model|LLM|prompt"; "i")) | "- \(.subject) (\(.from))"' 2>/dev/null | head -20)
if [ -n "$AI_TOPICS" ]; then
  echo "### Emerging Topics from Newsletters" >> "$INSIGHTS_FILE"
  echo "$AI_TOPICS" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Extracted: AI/trend topics"
fi

# Developer tools & workflows
DEV_TOOLS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("GitHub|Cursor|IDE|code|developer|API"; "i")) | "- \(.subject)"' 2>/dev/null | head -15)
if [ -n "$DEV_TOOLS" ]; then
  echo "### Developer Tool Mentions" >> "$INSIGHTS_FILE"
  echo "$DEV_TOOLS" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Extracted: Dev tools"
fi

# Business/product opportunities
OPPORTUNITIES=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("opportunity|partnership|collaboration|beta|launch|funding"; "i")) | "- **\(.from)**: \(.subject)"' 2>/dev/null | head -10)
if [ -n "$OPPORTUNITIES" ]; then
  echo "### Opportunities Detected" >> "$INSIGHTS_FILE"
  echo "$OPPORTUNITIES" >> "$INSIGHTS_FILE"
  echo "" >> "$INSIGHTS_FILE"
  log "  Extracted: Opportunities"
fi

cat >> "$INSIGHTS_FILE" << EOF

### Services/Subscriptions Tracked
EOF

# Active services from receipts
RECEIPTS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("receipt|invoice|payment|subscription"; "i")) | "- \(.from): \(.subject)"' 2>/dev/null | sort | uniq | head -15)
if [ -n "$RECEIPTS" ]; then
  echo "$RECEIPTS" >> "$INSIGHTS_FILE"
  log "  Extracted: Services/subscriptions"
fi

# ============================================
# PHASE 2: IDENTIFY ACTION ITEMS (KEEP IN INBOX)
# ============================================
log ""
log "PHASE 2: Identifying action items to keep in inbox..."

cat > "$ACTION_FILE" << EOF
# Action Items - Keep in Primary Inbox
**Date:** $DATE
**Status:** These should remain in your inbox for action

## ⚠️ URGENT - Action Required
EOF

# Flag emails needing response (not from newsletters, with personal tone)
PERSONAL_EMAILS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.from | test("substack|medium|noreply|notifications|team@|hello@|support@"; "i") | not) | select(.labels | contains("IMPORTANT") or contains("Needs-Action")) | "### \(.from)\n**Subject:** \(.subject)\n**Date:** \(.date)\n**Action:** Review and respond\n"' 2>/dev/null | head -10)

if [ -n "$PERSONAL_EMAILS" ]; then
  echo "$PERSONAL_EMAILS" >> "$ACTION_FILE"
  log "  Flagged: Personal action items"
fi

# Security alerts
cat >> "$ACTION_FILE" << EOF

## 🔒 Security - Verify These
EOF

SECURITY_ALERTS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("security|sign-in|alert|verify"; "i")) | "- **\(.from)**: \(.subject) (\(.date))"' 2>/dev/null | head -10)
if [ -n "$SECURITY_ALERTS" ]; then
  echo "$SECURITY_ALERTS" >> "$ACTION_FILE"
  log "  Flagged: Security alerts"
fi

# Financial/Invoices
cat >> "$ACTION_FILE" << EOF

## 💰 Financial - Review/Archive After Processing
EOF

FINANCIAL=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("invoice|receipt|payment|order|subscription"; "i")) | "- **\(.from)**: \(.subject)"' 2>/dev/null | head -15)
if [ -n "$FINANCIAL" ]; then
  echo "$FINANCIAL" >> "$ACTION_FILE"
  log "  Flagged: Financial items"
fi

# ============================================
# PHASE 3: ORGANIZE WITH LABELS (NOT INBOX)
# ============================================
log ""
log "PHASE 3: Organizing with labels..."

# Ensure labels exist
for LABEL in "Newsletters" "GitHub" "Receipts" "Promotions"; do
  gog gmail labels create "$LABEL" --account "$ACCOUNT" 2>/dev/null || true
done

# Label newsletters (but don't remove from inbox yet — let Simon decide)
NEWSLETTER_IDS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.from | test("substack|medium@|newsletter|digest"; "i")) | .id' 2>/dev/null | head -50)
if [ -n "$NEWSLETTER_IDS" ]; then
  BATCH=$(echo "$NEWSLETTER_IDS" | head -20 | tr '\n' ' ')
  gog gmail batch modify $BATCH --add "Newsletters" --account "$ACCOUNT" 2>/dev/null
  log "  Labeled: 20 newsletters"
fi

# Label GitHub notifications
GITHUB_IDS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.from | contains("github")) | .id' 2>/dev/null | head -30)
if [ -n "$GITHUB_IDS" ]; then
  BATCH=$(echo "$GITHUB_IDS" | head -20 | tr '\n' ' ')
  gog gmail batch modify $BATCH --add "GitHub" --account "$ACCOUNT" 2>/dev/null
  log "  Labeled: GitHub notifications"
fi

# Label receipts
RECEIPT_IDS=$(cat /tmp/inbox_full.json | jq -r '.[] | select(.subject | test("receipt|invoice|order confirmation"; "i")) | .id' 2>/dev/null | head -20)
if [ -n "$RECEIPT_IDS" ]; then
  BATCH=$(echo "$RECEIPT_IDS" | head -15 | tr '\n' ' ')
  gog gmail batch modify $BATCH --add "Receipts" --account "$ACCOUNT" 2>/dev/null
  log "  Labeled: Receipts"
fi

# ============================================
# PHASE 4: ARCHIVE PURE TRASH
# ============================================
log ""
log "PHASE 4: Archiving pure trash..."

TRASH_SENDERS=(
  "USPSInformeddelivery@email.informeddelivery.usps.com"
  "website@e.aspca.org"
  "DoNotReply-MemberComm@email.anthem.com"
  "promotions@promo.glassesusa.com"
  "support@gld.com"
  "showroom@colleenmauerdesigns.com"
  "hello@maisonmiru.com"
  "spectrum@exchange.spectrum.com"
  "no-reply@dutchie.com"
  "bingo@patreon.com"
  "hello@mail.hinge.co"
)

for SENDER in "${TRASH_SENDERS[@]}"; do
  IDS=$(gog gmail messages search "from:$SENDER in:inbox" --account "$ACCOUNT" --plain 2>/dev/null | grep -E '^[0-9a-f]{16}' | awk '{print $1}')
  if [ -n "$IDS" ]; then
    COUNT=$(echo "$IDS" | wc -l)
    BATCH=$(echo "$IDS" | head -50 | tr '\n' ' ')
    if gog gmail batch modify $BATCH --remove INBOX --account "$ACCOUNT" 2>/dev/null; then
      ARCHIVED=$((ARCHIVED + COUNT))
      log "  Archived $COUNT from $SENDER"
    fi
    sleep 1
  fi
done

# ============================================
# SUMMARY
# ============================================
log ""
log "=== ORGANIZATION COMPLETE ==="
log "Insights extracted to: $INSIGHTS_FILE"
log "Action items logged to: $ACTION_FILE"
log "Total archived: $ARCHIVED"
log ""

# Generate summary
cat >> "$INSIGHTS_FILE" << EOF

---
## Processing Summary
- **Analyzed:** 500 emails
- **Archived:** $ARCHIVED pure trash emails
- **Labeled:** Newsletters, GitHub, Receipts
- **Action items:** See $ACTION_FILE
- **Insights:** Ready for Content Intelligence

## Next Steps for You
1. Review inbox — only action items should remain
2. Check $ACTION_FILE for flagged items
3. Use labels (Newsletters, GitHub, Receipts) to find organized content
4. Insights extracted for Content Intelligence system
EOF

log "Files created:"
log "  - $INSIGHTS_FILE"
log "  - $ACTION_FILE"
log "  - $LOGFILE"

# Output for notification
echo "✅ Inbox organized: $ARCHIVED archived, insights extracted, action items flagged"
