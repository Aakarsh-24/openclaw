# APEX v7 Plan: Gmail Inbox Zero - gonzalez.simon@gmail.com

**Created:** 2026-01-31 09:42 PST  
**APEX Version:** 7.0  
**Account:** gonzalez.simon@gmail.com  
**Estimated Volume:** 1,500-3,000+ inbox emails (back to 2023)  
**Goal:** Inbox Zero with sustainable maintenance

---

## Phase 0: Pre-Flight Verification (COMPLETED)

### Test Before/After Checklist
- [x] BEFORE: Verify Gmail API access works - **CONFIRMED**
- [x] BEFORE: Document current inbox state - **CONFIRMED**
- [x] BEFORE: Check available storage - **N/A (cloud)**
- [ ] AFTER: Verify batch operations complete successfully
- [ ] AFTER: Confirm no important emails lost

### Current State Verified
| Metric | Value |
|--------|-------|
| Inbox volume | 500+ per page, multiple pages |
| Date range | Jan 2023 → Jan 2026 (~3 years) |
| Custom labels | 3 (Notes, [Gmail]All Mail, Action Needed) |
| Categories | Promotions-heavy |

---

## Phase 1: Category Analysis (Read-First)

### 1.1 High-Volume Senders to Target
From sample scan, these senders dominate:
- **Promotions:** Slickdeals, Jomashop, Carvana, various sales
- **Updates:** Credit One, Spectrum, T-Mobile, UCLA job alerts
- **Newsletters:** Wall Street Wizardry, MyFitnessPal

### 1.2 Time-Based Segments
| Segment | Date Range | Risk Level | Est. Count |
|---------|------------|------------|------------|
| Ancient | 3+ years ago (pre-2023) | Low | TBD |
| Old | 2-3 years ago (2023) | Low-Medium | ~300+ |
| Recent | 1-2 years ago (2024) | Medium | ~500+ |
| Current | <1 year (2025-2026) | High (review) | ~700+ |

---

## Phase 2: Batch Processing (APEX Compliant)

**⚠️ Gateway Constraint:** Using `--max 100` batches instead of 500 due to gateway instability with large bulk jobs. Will iterate through multiple 100-message batches as needed.


### Phase 2A: 3+ Year Old Emails (Ancient)
**Criteria:** `older_than:3y` - anything from 2022 or earlier

**Command:**
```bash
gog gmail messages search "in:inbox older_than:3y" --account gonzalez.simon@gmail.com --max 100
```

**Action:** Archive all (remove INBOX label, keep in All Mail)
**Risk:** Minimal - 3+ year old emails unlikely needed
**Checkpoint:** Simon approval after seeing count

### Phase 2B: 2-3 Year Old (2023) - Promotions/Updates
**Criteria:** `older_than:2y` + `label:CATEGORY_PROMOTIONS`

**Command:**
```bash
gog gmail messages search "in:inbox older_than:2y label:CATEGORY_PROMOTIONS" --account gonzalez.simon@gmail.com --max 100
```

**Action:** Archive promotional emails 2+ years old
**Risk:** Low - expired deals/promotions
**Checkpoint:** Archive count logged

### Phase 2C: 2-3 Year Old (2023) - Notifications
**Criteria:** `older_than:2y` + from:noreply/donotreply + no attachments

**Action:** Archive system notifications, password resets, billing alerts from 2023
**Risk:** Low-Medium - verify no important receipts

### Phase 2D: 1-2 Year Old (2024) - Promotions
**Criteria:** `older_than:1y` + `label:CATEGORY_PROMOTIONS` + `is:unread`

**Action:** Archive unread promotional emails from 2024
**Risk:** Low - if unread, likely not important
**Checkpoint:** Simon approval

---

## Phase 3: Smart Organization

### 3.1 Create PARA-Style Labels
```bash
gog gmail labels create "@Action-Required" --account gonzalez.simon@gmail.com
gog gmail labels create "@Waiting-For" --account gonzalez.simon@gmail.com
gog gmail labels create "@Someday-Maybe" --account gonzalez.simon@gmail.com
gog gmail labels create "Receipts-2025" --account gonzalez.simon@gmail.com
gog gmail labels create "Receipts-2024" --account gonzalez.simon@gmail.com
```

### 3.2 Identify Keepers (Don't Archive)
- Emails with attachments (invoices, tax docs)
- From personal contacts (not noreply domains)
- STARRED or marked IMPORTANT manually
- From: known personal emails, family, work

---

## Phase 4: Maintenance System

### 4.1 Daily Auto-Archive (Cron)
```
Every day 6 AM:
- Archive emails >90 days old in CATEGORY_PROMOTIONS
- Archive emails >180 days old in CATEGORY_SOCIAL
```

### 4.2 Weekly Inbox Review (Heartbeat Integration)
Add to HEARTBEAT.md:
- Check inbox count, alert if >100
- Surface unread emails >14 days
- Verify auto-processing working

---

## Execution Checkpoints (STAY IN LANE)

| Checkpoint | Condition | Action |
|------------|-----------|--------|
| **1** | Before any bulk ops | Show counts, get explicit "go" |
| **2** | After 2A (Ancient) | Report archived count, confirm no issues |
| **3** | After 2B/C (2023) | Check-in, verify approach working |
| **4** | After 2D (2024) | Final count, Inbox Zero status |
| **5** | Completion | Labels created, maintenance cron set |

---

## Rollback Plan

1. **Archive ≠ Delete** - All emails remain in "All Mail"
2. **Searchable** - Can find and restore anything
3. **Trash recovery** - 30-day window if deleted
4. **Gmail backup** - Google Takeout available

---

## Cost/Time Estimate

| Phase | Est. Time | Checkpoints | Auto/Manual |
|-------|-----------|-------------|-------------|
| 1. Analysis | 10 min | 1 | Auto |
| 2A. Ancient | 10 min | 1 | Auto with approval |
| 2B/C. 2023 batch | 20 min | 2 | Auto with approval |
| 2D. 2024 batch | 20 min | 1 | Auto with approval |
| 3. Organization | 15 min | 0 | Auto |
| 4. Maintenance | 10 min | 0 | Auto |

**Total:** ~85 minutes with 5 approval checkpoints

---

## NEXT ACTION REQUIRED

**I need your "go" to start Phase 2A.** 

Before I touch anything, I'll:
1. Get exact count of 3+ year old emails
2. Show you the oldest 10 (to verify nothing precious)
3. Wait for your explicit "archive them"

Say **"analyze first"** to see counts, or **"go"** to proceed with Phase 2A.
