---
name: google-calendar
description: Manage Google Calendar via the Google Calendar API (list, add, edit, delete events). Supports quick add with natural language, multiple calendars, and timezone handling. Use when working with Google Calendar events, scheduling, or calendar management.
metadata:
  {
    "openclaw":
      {
        "emoji": "📅",
        "requires": { "bins": ["python3", "gcal"] },
        "install":
          [
            {
              "id": "pip",
              "kind": "pip",
              "package": "google-api-python-client google-auth-httplib2 google-auth-oauthlib",
              "label": "Install Google API client libraries",
            },
          ],
      },
  }
---

# Google Calendar

Manage Google Calendar events via API. Requires OAuth authentication (one-time setup).

## Setup

### 1. Enable Google Calendar API
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create/select a project
- Enable **Google Calendar API**
- Create **OAuth 2.0 credentials** (Desktop app)
- Download `credentials.json`

### 2. Authenticate
Run once to authorize:
```bash
python3 scripts/gcal_auth.py
```
This creates `token.json` for future API calls.

## Quick Start

### List Events
```bash
# Today's events
gcal list

# Specific date
gcal list --date 2026-02-15

# Date range
gcal list --start 2026-02-01 --end 2026-02-28

# Specific calendar
gcal list --calendar "Work"
```

### Add Event
```bash
# Quick add (natural language)
gcal add "Meeting with team tomorrow at 3pm"

# With details
gcal add --title "Doctor appointment" --date 2026-02-15 --time 14:00 --duration 60

# All-day event
gcal add --title "Vacation" --date 2026-02-20 --all-day
```

### Edit Event
```bash
gcal edit <event-id> --title "New title"
gcal edit <event-id> --date 2026-02-16 --time 10:00
```

### Delete Event
```bash
gcal delete <event-id>
```

## Calendar Management

### List Calendars
```bash
gcal calendars
```

### Calendar Colors
See [references/calendar-colors.md](references/calendar-colors.md) for available colors.

## Date/Time Formats

- **Dates:** `2026-02-15`, `tomorrow`, `next monday`
- **Times:** `14:00`, `2pm`, `2:30 PM`
- **Durations:** minutes (60 = 1 hour)

## Output Formats

```bash
# JSON (scripting)
gcal list --json

# Plain text
gcal list --plain

# With IDs (for editing/deleting)
gcal list --with-ids
```

## Testing

Run unit tests (no API credentials needed):
```bash
python3 scripts/test_gcal.py
```

Tests cover:
- Date parsing (ISO, US, EU formats, relative dates)
- Time parsing (24h, 12h AM/PM formats)
- Edge cases and error handling

## Resources

- [references/api-guide.md](references/api-guide.md) - Full API reference
- [references/calendar-colors.md](references/calendar-colors.md) - Calendar color IDs
