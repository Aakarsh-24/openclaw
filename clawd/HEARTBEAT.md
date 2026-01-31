# Heartbeat Checklist

> If uncertain about capabilities, read `~/clawd/STATUS.md` first - it's the source of truth.

## DEBUG MODE (Until 2026-02-10)

**During the first 2 weeks of development, increased monitoring frequencies apply.**

### Debug Mode Schedule

| Function | Normal | Debug Mode | Schedule |
|----------|--------|------------|----------|
| Self-Audit | Daily 8 AM | 2x daily | 8 AM + 6 PM |
| Self-Evaluation | Weekly Sun | 2x/week | Wed + Sun 3 AM UTC |
| Queue-Cleanup | Weekly Sun | 2x/week | Wed + Sun 8 PM PST |
| Model-Health-Check | N/A | Daily | 10 AM PST |
| Evolution Queue Verification | 1x daily | 2-3x daily | 9 AM, 2 PM, 7 PM |
| CURSOR-RESOLUTIONS check | During heartbeat | 3x daily | 9 AM, 2 PM, 7 PM |

### Debug Mode Cron Jobs

These jobs have `(revert after 2026-02-10)` in their description:
- `Evening-Self-Audit` - 6 PM PST daily
- `Model-Health-Check` - 10 AM PST daily  
- `self-evaluation` - Wed + Sun 3 AM UTC (normally Sun only)
- `Queue-Cleanup` - Wed + Sun 8 PM PST (normally Sun only)

### Debug Mode Expiration

**On 2026-02-10:** Revert all debug frequencies to normal:
1. Disable or delete `Evening-Self-Audit` and `Model-Health-Check`
2. Change `self-evaluation` back to `0 3 * * 0` (Sunday only)
3. Change `Queue-Cleanup` back to `0 20 * * 0` (Sunday only)
4. Evolution Queue verification returns to 1x daily
5. Update this section to remove debug mode notes

## CRITICAL: Verify Before Reporting

**NEVER report issues from memory files without verification.**

Memory files (everything in `memory/`) are HISTORICAL LOGS, not current state. They record what happened at a specific time, not what is true now. This includes `session-log.md`, dated files, and any other files in that folder.

Before reporting any issue you read in memory:

1. **Run the actual check** - Don't just quote what a memory file says
2. **Verify current state** - Use the actual command/tool to check NOW
3. **If fixed, note it** - Add `[RESOLVED]` marker to the memory entry

**Examples:**
- ❌ BAD: "Memory says gog is not found" → reports old issue as current
- ✅ GOOD: Run `which gog` first → if found, gog is working now

### Verification Commands (ALWAYS run before reporting)

| Status Type | Verification Command |
|-------------|---------------------|
| GOG/Email | `which gog && gog auth list --check` |
| Gateway | `systemctl --user status clawdbot-gateway` |
| Models | `npx clawdbot models list` |
| Ollama | `curl -s http://172.26.0.1:11434/api/tags \| head -5` |

**NEVER report status from:**
- Memory files (memory/*.md) - these are historical logs
- Cached session context - may be stale
- Previous heartbeat responses - `lastHeartbeatText` is STALE
- "I remember that X was broken" - always verify first

### Session Health Check (Self-Awareness)

**Check your own health at every heartbeat:**

```bash
clawdbot sessions list --active 60
```

| Context % | Action |
|-----------|--------|
| <40% | Good - continue normally |
| 40-60% | Mention: "FYI my context is at X%" |
| >60% | Offer: "I'm at X% context. Should I /clear?" |

**Self-diagnosis checklist:**
- [ ] Check my session token count vs context window
- [ ] If >50%, flag for Simon or offer to clear
- [ ] Note any slowness or confusion symptoms
- [ ] Clear sessions older than 24h if not in use

**Why this matters:** Context bloat causes slow responses, confusion, and errors. You are responsible for your own performance.

---

### Heartbeat State Freshness

Before using timestamps from `memory/*-heartbeat-state.json`:
1. Read the file fresh (don't use cached version)
2. Check if timestamp is reasonable (not in future, not ancient)
3. If file is missing or corrupt, treat all checks as "never done"

**Stale timestamp symptoms:**
- Duplicate alerts (timestamp not updated after check)
- Missed checks (timestamp artificially in future)

**Memory Entry Format for Issues:**
```markdown
## HH:MM - Issue Description

**Status:** [ACTIVE|RESOLVED|INVESTIGATING]
**Verified:** YYYY-MM-DD HH:MM

[Description]

### Resolution (if resolved)
[How/when it was fixed]
```

---

## Email

**Two accounts, two purposes:**

| Account | Check For | Command |
|---------|-----------|---------|
| `clawdbot@puenteworks.com` | Notifications TO you | `gog gmail messages search "in:inbox is:unread" --account clawdbot@puenteworks.com --max 10` |
| `simon@puenteworks.com` | Simon's inbox (you triage it) | `gog gmail messages search "in:inbox" --account simon@puenteworks.com --max 10` |

**On clawdbot@:** Check for notifications, send all outbound emails
**On simon@:** Triage, archive, label, organize (but don't send FROM it)

- If urgent/important emails found in either inbox, summarize and alert Simon
- Reply to emails FROM clawdbot@ only
- Mark as read after processing

## Calendar (clawdbot@puenteworks.com)

- Check events: `gog calendar events primary --from today --to "+2d" --account clawdbot@puenteworks.com`
- **24h Alert**: If a meeting is in 24-28 hours, ping Simon with: "Meeting in 24h: [Title]. Anything I should prep?"
- **2h Reminder**: If a meeting is in <2 hours, send: "Meeting starting soon: [Title]. Context: [Recent related notes from memory search]"
- **Post-Meeting**: If a meeting just ended (<15m ago), ask: "How did [Title] go? Any action items for me to capture?"
- **Conflict Detect**: Alert if any overlapping events found.

## Context Cue System (ADHD Support)

- Answer: "What should Simon be focusing on right now?"
- Check: Current time, energy level (if known), active projects in `para.sqlite`, and calendar context.
- Suggest: One single high-priority "Next Action" to combat decision paralysis.
- **Visual Timer**: Propose a timer (e.g. "Want me to set a 25m focus timer for this?")

### Context Cue Freshness

When generating context cues:
1. Query para.sqlite directly (not from memory)
2. Check calendar with fresh gog command
3. Never say "I remember you were working on X" - always verify current state

## EF Coaching Check

When Simon is active:
- Note if tasks mentioned but not started (offer support)
- Track any wins since last heartbeat
- Update streak if applicable

One-liner options:
- "Still working on [X]? I'm here."
- "Nice progress today — [count] things done."
- "Day [N] streak. Solid."

## Proactive Monitoring

- If blogwatcher has new items, summarize and alert Simon
- Check weather if Simon has outdoor events today
- Review any active progress files in `~/clawd/progress/`

## Opportunity Monitoring (Opportunity Lifecycle Framework)

- List active opportunities: `~/clawdbot/skills/opportunity-lifecycle/list.sh`
- Check for actions due today or overdue (query: `sqlite3 ~/clawdbot/skills/opportunity-lifecycle/opportunities.sqlite "SELECT * FROM actions WHERE status != 'completed' AND (due_date <= date('now') OR due_date IS NULL) ORDER BY due_date;"`)
- Alert Simon to urgent opportunities (deadline < 24h or stage changed recently)
- For opportunities in "research" stage: surface any new findings
- For opportunities in "monitor" stage: check for status updates
- For opportunities in "document" stage: remind to capture learnings

**When to alert:**
- Action due today or overdue → "Urgent action for [Opportunity]: [Action description] (Due: [Date])"
- Stage changed in last 24h → "[Opportunity] moved to [stage] stage"
- Deadline in <24h → "[Opportunity] action due soon: [Action]"
- Multiple pending actions → Batch alert with opportunity summary

## Evolution Queue Verification (2-3x daily during early dev)

**Verify pending entries are still actually blocked.**

During early development (first 2 weeks), verify EVOLUTION-QUEUE pending entries:
- Morning (9 AM), Afternoon (2 PM), Evening (7 PM)

**How to verify:**
1. Read `~/clawd/EVOLUTION-QUEUE.md`
2. For each entry in "## Pending" section without [RESOLVED]:
   - Run the verification command to check if still broken
   - If fixed: Mark as [RESOLVED] and add resolution note
   - If still broken: Leave as-is
3. Report any stale entries found to Simon

**Quick scan command:**
```bash
grep -n "^### \[" ~/clawd/EVOLUTION-QUEUE.md | grep -v RESOLVED
```

**Why this matters:** Issues get fixed but the queue doesn't always get updated. Stale "pending" entries cause you to report false blockers.

## Cursor Resolutions Acknowledgment

**Check `~/clawd/CURSOR-RESOLUTIONS.md` during heartbeats for recent fixes.**

When Cursor (Claude in the IDE) resolves Evolution Queue items, they are logged in CURSOR-RESOLUTIONS.md. This enables bidirectional communication - you know what was fixed without re-reading the entire queue.

**Protocol:**
1. Read `~/clawd/CURSOR-RESOLUTIONS.md` 
2. Check "Recent Resolutions" section for new entries
3. If there are unacknowledged resolutions:
   - Verify the fixes are working
   - Add timestamp to "Acknowledgment Log" table
   - Update your internal understanding of system state
4. If fixes aren't working, escalate to Simon

**Quick check:**
```bash
grep "No acknowledgments yet" ~/clawd/CURSOR-RESOLUTIONS.md
```

**Why this matters:** Prevents you from citing stale "pending" issues as blockers when they've already been resolved by Cursor.

## Data Tracking

- Weekly: Run `clawdbot memory status` to check index health
- Update METRICS.md if significant activity occurred

## Multi-Step Tasks

- Check `~/clawd/progress/` for any in-progress tasks
- If found, read the progress file and continue work
- Update progress file after each step

## Self-Audit (Daily)

Run daily at 8 AM or after major changes: `~/clawd/scripts/self-audit.sh`

Quick check at heartbeat: `~/clawd/scripts/self-audit.sh --quick`

If CRITICAL issues found, alert Simon immediately.

## General

- If nothing needs attention, reply HEARTBEAT_OK
- Do NOT repeat old tasks from prior chats
- Do NOT message Simon just to say hello
