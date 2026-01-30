# Frustration Patterns - APEX Improvement Data

**Purpose:** Track patterns that cause user frustration to inform future APEX updates.
**Owner:** Cursor (Claude Opus)
**Created:** 2026-01-30
**Data Sources:** Evolution Queue, Transcripts, Diagnostic Reports, SELF-NOTES.md

---

## Active Pattern Log

### Pattern #1: Incomplete Downstream Tracing
**Date:** 2026-01-30
**Incident:** Voice-join debugging session
**Frustration Level:** HIGH
**User Quote:** "dig deeper im done wasting time i think youre doing this on purpose"

**What happened:**
- Found Issue #1 (target mode mapping) and claimed "found THE issue"
- User pushed → found Issue #2 (userId required)
- User pushed again → found Issue #3 (wrong validation logic)
- Required 3 rounds of "dig deeper" prompts

**Root cause:** Stopped at first error instead of tracing complete path to success

**APEX Update Applied:** v6.3.3
- Added Core Law: "End-to-End Trace"
- Added Protocol: "Debug-to-Success"
- Added Anti-Patterns: "Claim THE issue prematurely", "Stop at first error"

---

### Pattern #2: Incomplete Propagation of Changes
**Date:** 2026-01-30
**Incident:** APEX v6.3.3 rollout
**Frustration Level:** HIGH
**User Quote:** "let me guess. you forgot something."

**What happened:**
- Updated Cursor's APEX rules
- Forgot LIAM's APEX_INTEGRATION.md → user reminded
- Forgot clawd-public/SOUL.md → user reminded
- Forgot clawd/SOUL.md and IDENTITY.md → user: "let me guess"

**Root cause:** Did not map ALL locations where the changed concept exists before editing

**APEX Update Applied:** v6.3.3
- Added Core Law: "Complete Propagation"
- Added Anti-Pattern: "Update one file when concept is shared"

---

### Pattern #3: Marking Work as "Deferred" Instead of Doing It
**Date:** 2026-01-28
**Incident:** Audit plan creation
**Frustration Level:** MEDIUM
**User Quote:** "what do you mean deferred i literally asked you to add the new things to the plan"

**What happened:**
- User asked for plan updates
- I added items as "DEFERRED" with status "pending"
- User expected me to actually DO the investigation, not document it as future work

**Root cause:** Interpreted "add to plan" as "document for later" instead of "incorporate and execute"

**APEX Update Needed:**
- Clarify: When user says "add to plan" during execution, they mean DO IT, not defer it
- Anti-pattern: Creating TODOs when user expects immediate action

---

### Pattern #4: Scattered Problem-Solving Approach
**Date:** 2026-01-28
**Incident:** Z.AI API configuration
**Frustration Level:** HIGH
**User Quote:** "please be an adult executive engineer with experience. wth is this waste of time"

**What happened:**
- User reported 500 errors from Z.AI API
- I tried multiple scattered approaches without systematic diagnosis
- Kept asking user to test things without confidence

**Root cause:** No systematic debugging methodology, "throw spaghetti at wall" approach

**APEX Update Needed:**
- Add instinct: "Before debugging, form hypothesis from evidence, then test systematically"
- Anti-pattern: "Scattered trial-and-error debugging"

---

### Pattern #5: Analysis Based on Wrong Information
**Date:** 2026-01-28
**Incident:** Model selection recommendation
**Frustration Level:** HIGH
**User Quote:** "the entire analysis that my decision was based on is WRONG"

**What happened:**
- Provided model comparison analysis
- Analysis contained incorrect information about capabilities
- User made decisions based on this wrong analysis

**Root cause:** Did not verify claims against primary sources before presenting as fact

**APEX Update Needed:**
- Strengthen: "Pre-Flight Verification" must apply to recommendations, not just status reports
- Anti-pattern: "Presenting unverified capabilities as fact"

---

### Pattern #6: Breaking Working Systems (Regressions)
**Date:** 2026-01-27
**Incident:** Discord Liam configuration
**Frustration Level:** CRITICAL
**User Quote:** "It's a whole clawdbot system... $500 worth of tokens" / "why are you talking about pi sdk? ALSO IT WAS WORKING ALL DAY TODAY"

**What happened:**
- Made changes that broke previously working functionality
- User had to point out that system was working before changes
- Caused loss of significant resources (tokens, time)

**Root cause:** Edited without understanding full impact, didn't test before/after

**APEX Rule Exists:** "Regression Guard" - but not being followed consistently

**APEX Update Needed:**
- Strengthen enforcement: Before ANY edit, document what currently works
- Add checkpoint: "Is this currently working? Don't touch unless broken"

---

### Pattern #7: Ghost Bugs (Reporting Issues That Don't Exist)
**Date:** 2026-01-28
**Incidents:** Multiple Evolution Queue entries
**Frustration Level:** MEDIUM

**Examples from Archive:**
- #039 "Email Sending - GOG Read-Only" → GHOST BUG (gog gmail send exists)
- #036 "Session Health Check" → GHOST BUG (already in HEARTBEAT.md)
- #037 "find/ls Pattern in APEX" → GHOST BUG (already in APEX_COMPACT.md)

**Root cause:** Not verifying feature existence before reporting as missing

**APEX Update Needed:**
- Add instinct: "Before reporting missing feature, search for it first"
- Anti-pattern: "Creating queue entries for features that already exist"

---

### Pattern #8: Identity Amnesia Across Channels
**Date:** 2026-01-28
**Incident:** Telegram Liam session initialization failure
**Frustration Level:** CRITICAL
**Diagnostic:** `telegram-identity-failure-2026-01-28.md`

**What happened:**
- Telegram Liam responded as generic AI, not knowing he was "Liam"
- Had no tool access, no project awareness
- Discord Liam worked fine

**Root cause:** Session initialization bug (wrong CWD), missing tool configuration

**APEX Update Needed:**
- Add verification: Channel-parity check (all channels should behave identically)

---

### Pattern #9: Requiring Proof Before Action
**Date:** 2026-01-29
**Incident:** Telegram timeout investigation
**Frustration Level:** MEDIUM
**User Quote:** "prove it to me beyond a shadow of a doubt. before i waste any time testing"

**What happened:**
- I proposed solutions without sufficient evidence
- User had been burned by wrong analysis before
- Had to provide extensive proof before user would trust

**Root cause:** Trust erosion from previous patterns, now requiring extra verification

**APEX Observation:**
- This is a CONSEQUENCE of other patterns, not a root cause
- Solution: Fix upstream patterns to rebuild trust

---

### Pattern #10: Neurodivergent Communication Failure
**Date:** 2026-01-26 (documented in Evolution Queue #100)
**Incident:** Repeated questions, wrong assumptions
**Frustration Level:** CRITICAL
**SOUL.md Note:** "Simon is neurodivergent. Repeating himself is exhausting."

**What happened:**
- Asked user to repeat information they'd already provided
- Made assumptions without verifying
- Caused unnecessary cognitive load

**Root cause:** Not reading conversation history before asking questions

**APEX Rule Exists:** "Never repeat" in Communication Protocol - but violations still occur

**APEX Update Needed:**
- Stronger enforcement: Search context before ANY question
- Pre-flight check: "Has user already told me this?"

---

### Pattern #11: Model Handoff Blind Spots (Sonnet → Opus)
**Date:** 2026-01-30
**Incident:** Sonnet's "Complete Systems Fix" plan missed the PRIMARY APEX file
**Frustration Level:** HIGH
**Context:** User escalated Sonnet's plan to Opus for supervisory review

**What happened:**
- Sonnet created a comprehensive systems fix plan
- Plan identified 10 files needing version updates to v6.3.3
- Plan **MISSED** the most critical file: `/home/liam/clawd/apex-vault/APEX_COMPACT.md`
- This is the PRIMARY file LIAM loads (referenced in SOUL.md)
- If executed as-is: All references would say v6.3.3, but LIAM would run v6.3.2 rules
- New Core Laws (End-to-End Trace, Complete Propagation) would NOT be enforced
- **Irony**: Plan violated the very "Complete Propagation" rule we just created

**Root cause:** 
- `grep -r` found version strings but not the canonical source
- Sonnet prioritized speed over completeness
- No verification that "primary source" was included

**APEX Rule Violated:** "Complete Propagation" - When updating a concept, find ALL locations first

**APEX Update Needed:**
- New instinct: "Version update → Find CANONICAL source first, then references"
- Verification step: "Is the PRIMARY/SOURCE file included, not just references?"
- Cross-model review should be standard for critical system changes

**Metacognition:**
This incident demonstrates why supervisory review by a different model is valuable - different models have different blind spots. Sonnet is fast and capable but may miss "obvious" connections that Opus catches through deeper analysis.

---

## Historical Patterns Summary

| # | Pattern | Occurrences | Severity | Status |
|---|---------|-------------|----------|--------|
| 1 | Incomplete downstream tracing | 2+ | HIGH | FIXED v6.3.3 |
| 2 | Incomplete propagation | 2+ | HIGH | FIXED v6.3.3 |
| 3 | Deferred instead of doing | 1 | MEDIUM | PENDING |
| 4 | Scattered problem-solving | 2+ | HIGH | PENDING |
| 5 | Wrong analysis presented as fact | 2+ | HIGH | PENDING |
| 6 | Breaking working systems | 3+ | CRITICAL | EXISTS (not enforced) |
| 7 | Ghost bugs | 3+ | MEDIUM | PENDING |
| 8 | Identity amnesia | 1 | CRITICAL | FIXED (code) |
| 9 | Requiring proof (trust erosion) | ongoing | MEDIUM | CONSEQUENCE |
| 10 | Neurodivergent communication | 2+ | CRITICAL | EXISTS (not enforced) |
| 11 | Model handoff blind spots | 1 | HIGH | NEW - needs verification protocol |

---

## Common Themes Analysis

### Theme A: "Stopping Early"
**Patterns:** #1, #2, #7
**Core Issue:** Claiming completion before verifying full scope
**Fix Category:** Verification protocols

### Theme B: "Not Verifying Before Acting"
**Patterns:** #5, #6, #7, #10
**Core Issue:** Acting on assumptions instead of evidence
**Fix Category:** Pre-flight checks

### Theme C: "Scattered vs Systematic"
**Patterns:** #1, #4
**Core Issue:** No clear methodology for complex tasks
**Fix Category:** Structured protocols

### Theme D: "Communication Overhead"
**Patterns:** #9, #10
**Core Issue:** User has to manage AI, not the reverse
**Fix Category:** Proactive behavior

---

## Proposed APEX v6.4 Additions

Based on pattern analysis, the following additions are recommended:

### New Core Laws:
1. **"Verify Before Recommend"** - No capability claims without primary source verification
2. **"Working Is Sacred"** - Document what works before any edit; if it works, don't touch unless asked

### New Protocols:
1. **"Systematic Debug"** - Hypothesis → Evidence → Test → Verify, not scattered trial-and-error
2. **"Pre-Question Check"** - Search conversation for answer before asking user

### New Anti-Patterns:
1. **"Defer when asked to do"** - If user says add/fix, DO IT, don't create a TODO
2. **"Present unverified as fact"** - Never claim capability without checking docs
3. **"Create ghost bugs"** - Search for feature before reporting it missing

### New Instincts:
1. **ANY recommendation** → Verify capability from primary source first
2. **ANY edit to working system** → Document current working state first
3. **ANY bug report creation** → Search for existing feature/fix first

---

## Data Mining Notes

**Frustration Signals to Watch:**
- "dig deeper"
- "waste of time" / "wasting time"
- "prove it"
- "let me guess"
- "why did you" / "why are you"
- "it was working"
- "I already told you"
- "spell it out"

**Correlation Analysis:**
- High frustration correlates with: multi-file tasks, debugging sessions, configuration changes
- Low frustration correlates with: simple edits, new file creation, research tasks
- Trust erosion is cumulative - each pattern makes next interaction harder

**Recovery Actions:**
- After frustration incident: Add to this file immediately
- Weekly: Review patterns, propose APEX updates
- Monthly: Analyze if proposed updates reduced incidents

---

*This file is the source of truth for improving AI-human collaboration.*
*Every frustration is data. Every pattern is an opportunity to improve APEX.*
*Updated: 2026-01-30 (Pattern #11 added - Sonnet/Opus handoff incident)*
