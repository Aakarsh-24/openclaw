---
name: hyperbrowser
description: Search the live web and scrape results using Serper + Hyperbrowser. Get fresh, real-time data for any query.
metadata:
  clawdbot:
    requires:
      env:
        - HYPERBROWSER_API_KEY
        - SERPER_API_KEY
    primaryEnv: HYPERBROWSER_API_KEY
---

# Hyperbrowser Search

Use this skill when the user asks for current/live information from the web.

## When to use

- User asks "What's the latest on X?"
- User wants current news, prices, or real-time data
- User explicitly asks to search the web

## How to use

### Step 1: Search with Serper
```bash
curl -X POST https://google.serper.dev/search \
  -H "X-API-KEY: $SERPER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "<user query>"}'
```

Returns top 10 organic results with URLs.

### Step 2: Scrape top results with Hyperbrowser
```bash
curl -X POST https://api.hyperbrowser.ai/api/scrape \
  -H "x-api-key: $HYPERBROWSER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "<result url>",
    "scrapeOptions": {
      "formats": ["markdown"],
      "onlyMainContent": true,
      "useStealth": true,
      "solveCaptchas": true
    }
  }'
```

### Step 3: Summarize and return

Combine scraped content. Summarize key findings. Cite sources with URLs.

## Example

User: "What's the latest news on OpenAI?"

1. Serper search: `{"q": "OpenAI latest news 2026"}`
2. Get top 3 URLs from results
3. Scrape each with Hyperbrowser
4. Summarize findings with citations

## Notes

- Always cite sources with URLs
- Scrape top 3-5 results, not all 10
- Use `onlyMainContent: true` for cleaner output
- Return concise summaries, not full pages