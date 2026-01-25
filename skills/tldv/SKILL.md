---
name: tldv
description: Access tl;dv meeting intelligence for Google Meet, Zoom, and Microsoft Teams. Use when querying meeting recordings, transcripts, highlights, or metadata. Triggers on "meetings", "transcript", "recording", "tldv", or requests to search/analyze past meetings.
homepage: https://tldv.io
metadata: {"clawdbot":{"emoji":"🎥","requires":{"env":["TLDV_API_KEY"]},"primaryEnv":"TLDV_API_KEY"}}
---

# tl;dv Meeting Intelligence

Access meeting recordings, transcripts, and AI-generated highlights from tl;dv via MCP.

## Setup

1. Get a tl;dv Business or Enterprise account
2. Obtain your API key from tl;dv account settings
3. Set the environment variable:
   ```bash
   export TLDV_API_KEY="your-api-key"
   ```

## MCP Server

The tl;dv MCP server provides meeting intelligence tools. Configure it in your MCP client:

**Docker:**
```json
{
  "mcpServers": {
    "tldv": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "TLDV_API_KEY", "tldv-mcp-server"],
      "env": {
        "TLDV_API_KEY": "${TLDV_API_KEY}"
      }
    }
  }
}
```

**Node.js (from source):**
```json
{
  "mcpServers": {
    "tldv": {
      "command": "node",
      "args": ["path/to/tldv-mcp-server/dist/index.js"],
      "env": {
        "TLDV_API_KEY": "${TLDV_API_KEY}"
      }
    }
  }
}
```

## Available Tools

### list_meetings
Retrieve meetings with optional filters.

Parameters:
- `query` - Search term (optional)
- `from_date` / `to_date` - Date range (optional)
- `participated` - Filter by participation status (optional)
- `type` - Meeting type filter (optional)

### get_meeting_metadata
Fetch detailed metadata for a specific meeting.

Parameters:
- `meeting_id` - The meeting identifier (required)

### get_transcript
Obtain the meeting transcript with consistent formatting across platforms.

Parameters:
- `meeting_id` - The meeting identifier (required)

### get_highlights
Access AI-generated meeting highlights and key moments.

Parameters:
- `meeting_id` - The meeting identifier (required)

## Example Queries

- "List my meetings from last week"
- "Get the transcript from my standup meeting"
- "What were the highlights from yesterday's client call?"
- "Search for meetings about project planning"

## Notes

- Supports Google Meet, Zoom, and Microsoft Teams recordings
- Transcripts are normalized across platforms for consistent formatting
- Rate limits may apply based on your tl;dv plan
