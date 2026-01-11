---
name: hope-church
description: Hope Christian Church service info from The Loop (updates.church)
homepage: https://hopechristianchurch.updates.church/
metadata: {"clawdis":{"emoji":"⛪","requires":{"bins":["uv"]}}}
---

# Hope Christian Church

Winchester, MA • Pastor Todd Cravens • [The Loop](https://hopechristianchurch.updates.church/)

## Quick Info
- **Early Service**: 8:30 AM
- **Late Service**: 10:30 AM
- **Location**: Winchester, MA
- **Pastor**: Todd Cravens (ppl.gift ID: 687436)

## Fetch This Week's Service

```bash
uv run {baseDir}/scripts/hope-loop.py
```

Options:
- `--json` — Output as JSON
- `--raw` — Show all Loop items, not just Sunday service

## What It Returns

- Service date
- Order of service (prelude, worship songs, sermon, etc.)
- Sermon title and scripture
- Announcements
- Upcoming events

## Cron Integration

A cron job runs every Saturday at 5 PM to fetch Sunday's service details and cache them. Steve can then answer questions about the upcoming service without needing to scrape live.

## The Hurley Family

David, Erin, Kate, Claire, and Samuel attend Hope Christian Church. Early service (8:30 AM) is typical.
