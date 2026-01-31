# SUCCESS-PATTERNS.md - Behaviors That Work Well

*The opposite of FRUSTRATION-PATTERNS.md. Track what works to reinforce good habits.*

**Purpose:** When Cursor (or any AI assistant) demonstrates behaviors that please the user or produce good outcomes, document them here. These patterns should be reinforced and potentially integrated into APEX rules.

**Update frequency:** After completing complex tasks that went well, or when user expresses satisfaction.

---

## Pattern #1: Proactive Issue Detection

**Date:** 2026-01-31
**Context:** Investigating gateway timeout issues

**Good Behavior:**
While reviewing gateway logs for the user-reported timeout, I discovered a separate issue (Groq TTS schema crash) that would have caused gateway restart failure - before the user mentioned it.

**Why It Worked:**
- Thorough log analysis catches peripheral issues
- User didn't have to debug a second problem

**APEX Enhancement:**
> Add to instincts: "When reviewing logs for one issue, scan for other errors/warnings that may impact the user."

---

## Pattern #2: Multi-Pass Investigation

**Date:** 2026-01-31
**Context:** User said "do another pass" on timeout investigation

**Good Behavior:**
On second pass with fresh data, discovered 3 NEW issues that weren't visible in first analysis:
1. Compaction ineffective (context growing despite "successful" compaction)
2. Model fallback context mismatch (248K session → 128K fallback = immediate fail)
3. TTS schema crash (gateway wouldn't restart)

**Why It Worked:**
- Fresh data reveals patterns not visible in stale data
- Not assuming first analysis was complete

**APEX Enhancement:**
> Add to protocols: "When investigating recurring issues, always do a validation pass with fresh data."

---

## Pattern #3: Comprehensive Agent Audit

**Date:** 2026-01-31
**Context:** Fixing context explosion vulnerability

**Good Behavior:**
Before implementing fix, checked ALL Liam variants (Telegram, Discord, Phone lightweight, Phone full, Subagents) to understand which were vulnerable and why.

**Why It Worked:**
- Fix addresses all affected agents, not just the reported one
- User understands full scope of protection

**APEX Enhancement:**
> Add to comorbidity: "When fixing shared infrastructure, audit ALL consumers."

---

## Pattern #4: Evidence-Based Diagnosis

**Date:** 2026-01-31
**Context:** Proving compaction ineffectiveness

**Good Behavior:**
Used actual token counts from logs (227K → 248K across 5 compactions) instead of assuming compaction was working.

**Why It Worked:**
- Quantified evidence is undeniable
- Led to correct root cause (compaction too weak)

**APEX Enhancement:**
> Add to thinking protocol: "Quantify the problem with actual data before proposing solutions."

---

## Pattern #5: Plan Evolution

**Date:** 2026-01-31
**Context:** Updated plan 3x as new evidence emerged

**Good Behavior:**
Didn't defend original plan when new evidence contradicted it. Updated todos, added new issues, revised rollout phases.

**Why It Worked:**
- Plan reflected reality, not assumptions
- User could trust plan accuracy

**APEX Enhancement:**
> Add to modes: "Plans should evolve with new data, not be defended."

---

## Pattern #6: Catching Own Mistakes Before User

**Date:** 2026-01-31
**Context:** Groq TTS schema issue

**Good Behavior:**
Found in gateway logs that my earlier TTS config change had broken the schema. Reported it proactively instead of waiting for user to discover it.

**Why It Worked:**
- Demonstrates self-awareness
- Saves user debugging time
- Builds trust

**APEX Enhancement:**
> Add to instincts: "When checking results, actively look for your own mistakes."

---

## How to Use This File

1. **After pleasing the user:** Add a new pattern entry
2. **When uncertain:** Read this file - often the solution is to do MORE of these patterns
3. **APEX updates:** Periodically review and propose pattern integrations to APEX rules
4. **Balance check:** Good patterns should outnumber FRUSTRATION-PATTERNS over time

---

*Last updated: 2026-01-31*
