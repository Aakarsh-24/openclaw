#!/bin/bash
# Overnight Newsletter Archive Script
# Archives newsletters from simon@puenteworks.com inbox in batches

ACCOUNT="simon@puenteworks.com"
LOGFILE="/home/liam/clawd/logs/newsletter-archive-$(date +%Y%m%d).log"
ARCHIVED=0
ERRORS=0

# Ensure log directory exists
mkdir -p /home/liam/clawd/logs

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"
}

log "Starting overnight newsletter archive"

# Newsletter senders to archive (expandable list)
SENDERS=(
  "natesnewsletter@substack.com"
  "kilocode@substack.com"
  "noreply@medium.com"
  "theslowai@substack.com"
  "mollysoshea@substack.com"
  "promotions@promo.glassesusa.com"
  "noreply@email.openai.com"
  "no-reply@email.slackhq.com"
  "marketing@engage.canva.com"
  "info@cerebras.net"
  "support@gld.com"
  "hi@mail.cursor.com"
  "spectrum@exchange.spectrum.com"
  "bingo@patreon.com"
  "hello@mail.hinge.co"
  "noreply@substack.com"
  "CloudPlatform-noreply@google.com"
  "xbox@e.xbox.com"
  "upcoming-invoice@wispr.ai"
  "flyers@webstaurantstore.com"
  "OpenTable@mgs.opentable.com"
  "notify@x.com"
  "teamtwilio@team.twilio.com"
  "email@email.monarch.com"
  "hi@kilocode.ai"
  "googleaistudio-noreply@google.com"
  "team@framer.com"
  "editors-noreply@linkedin.com"
  "noreply@netlify.com"
  "showroom@colleenmauerdesigns.com"
  "hello@maisonmiru.com"
  "hello@mail.grammarly.com"
  "no-reply@dutchie.com"
  "USPSInformeddelivery@email.informeddelivery.usps.com"
  "website@e.aspca.org"
  "DoNotReply-MemberComm@email.anthem.com"
  "notifications@github.com"  # Can archive GitHub notifications if desired
)

for SENDER in "${SENDERS[@]}"; do
  log "Processing: $SENDER"
  
  # Get all message IDs for this sender
  IDS=$(gog gmail messages search "from:$SENDER in:inbox" --account "$ACCOUNT" --plain 2>/dev/null | grep -E '^[0-9a-f]{16}' | awk '{print $1}')
  
  if [ -z "$IDS" ]; then
    log "  No emails found"
    continue
  fi
  
  COUNT=$(echo "$IDS" | wc -l)
  log "  Found: $COUNT emails"
  
  # Archive in batches of 50 (efficient for API)
  BATCH=""
  BATCH_COUNT=0
  BATCH_ARCHIVED=0
  
  for ID in $IDS; do
    BATCH="$BATCH $ID"
    BATCH_COUNT=$((BATCH_COUNT + 1))
    
    if [ $BATCH_COUNT -eq 50 ]; then
      if gog gmail batch modify $BATCH --remove INBOX --account "$ACCOUNT" >> "$LOGFILE" 2>&1; then
        BATCH_ARCHIVED=$((BATCH_ARCHIVED + BATCH_COUNT))
        ARCHIVED=$((ARCHIVED + BATCH_COUNT))
      else
        log "  ERROR: Failed to archive batch"
        ERRORS=$((ERRORS + 1))
      fi
      BATCH=""
      BATCH_COUNT=0
      sleep 1  # Rate limiting
    fi
  done
  
  # Process remaining batch
  if [ -n "$BATCH" ]; then
    if gog gmail batch modify $BATCH --remove INBOX --account "$ACCOUNT" >> "$LOGFILE" 2>&1; then
      BATCH_ARCHIVED=$((BATCH_ARCHIVED + BATCH_COUNT))
      ARCHIVED=$((ARCHIVED + BATCH_COUNT))
    else
      log "  ERROR: Failed to archive final batch"
      ERRORS=$((ERRORS + 1))
    fi
  fi
  
  log "  Archived: $BATCH_ARCHIVED from $SENDER"
  sleep 2  # Brief pause between senders
done

log "Complete. Total archived: $ARCHIVED, Errors: $ERRORS"

# Send summary notification via Telegram (using message tool from cron)
if [ $ARCHIVED -gt 0 ]; then
  echo "Overnight archive complete: $ARCHIVED newsletters archived from inbox" > /tmp/archive-summary.txt
fi
