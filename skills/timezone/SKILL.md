---
name: timezone
description: Get current time in any timezone and convert between timezones (no API key required).
metadata: { "openclaw": { "emoji": "🕐", "requires": { "bins": ["date"] } } }
---

# Timezone / World Clock

Query time in any timezone and convert between timezones using system tools. No API keys needed.

## Get current time in a timezone

```bash
TZ="America/New_York" date "+%Y-%m-%d %H:%M:%S %Z"
# Output: 2026-02-01 09:15:30 EST
```

```bash
TZ="Asia/Tokyo" date "+%Y-%m-%d %H:%M:%S %Z"
# Output: 2026-02-01 23:15:30 JST
```

```bash
TZ="Europe/London" date "+%Y-%m-%d %H:%M:%S %Z"
# Output: 2026-02-01 14:15:30 GMT
```

## Compare multiple timezones at once

```bash
for tz in "America/New_York" "Europe/London" "Asia/Tokyo"; do
  echo "$tz: $(TZ=$tz date '+%H:%M %Z')"
done
```

## Convert a specific time between timezones

To convert 3:00 PM EST to other timezones:

```bash
# Set the source time in EST
SOURCE_TIME="2026-02-01 15:00:00"

# Convert to PST
TZ="America/Los_Angeles" date -d "TZ=\"America/New_York\" $SOURCE_TIME" "+%H:%M %Z"
# Output: 12:00 PST

# Convert to UTC
TZ="UTC" date -d "TZ=\"America/New_York\" $SOURCE_TIME" "+%H:%M %Z"
# Output: 20:00 UTC
```

**macOS Note:** Use `-j -f` instead of `-d`:

```bash
# macOS: Convert 3pm EST to PST
TZ="America/Los_Angeles" date -j -f "%Y-%m-%d %H:%M:%S" "2026-02-01 15:00:00" "+%H:%M %Z"
```

## Common timezone identifiers

| Region | Timezone ID | Common Name |
|--------|-------------|-------------|
| US East | `America/New_York` | EST/EDT |
| US Central | `America/Chicago` | CST/CDT |
| US Mountain | `America/Denver` | MST/MDT |
| US Pacific | `America/Los_Angeles` | PST/PDT |
| UK | `Europe/London` | GMT/BST |
| Central Europe | `Europe/Paris` | CET/CEST |
| India | `Asia/Kolkata` | IST |
| China | `Asia/Shanghai` | CST |
| Japan | `Asia/Tokyo` | JST |
| Australia East | `Australia/Sydney` | AEST/AEDT |
| UTC | `UTC` | UTC |

## List all available timezones

```bash
# List all timezone regions
ls /usr/share/zoneinfo

# List timezones in America
ls /usr/share/zoneinfo/America

# Find a timezone by city name
find /usr/share/zoneinfo -name "*Tokyo*" -o -name "*Paris*" 2>/dev/null
```

## Get UTC offset for a timezone

```bash
TZ="America/New_York" date "+%z"
# Output: -0500 (5 hours behind UTC)
```

## Tips

- Timezone IDs are case-sensitive: use `America/New_York`, not `america/new_york`
- DST is handled automatically based on the date
- Use `UTC` or `Etc/UTC` for coordinated universal time
- Airport codes don't work—use full timezone IDs
