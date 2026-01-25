---
summary: "Perplexity Search API setup for web_search"
read_when:
  - You want to use Perplexity Search for web search
  - You need PERPLEXITY_API_KEY setup
---

# Perplexity Search API

Clawdbot uses Perplexity Search API for the `web_search` tool when `provider: "perplexity"` is set.
Perplexity Search returns structured results (title, URL, snippet) for fast research.

## Getting a Perplexity API key

1) Create a Perplexity account at https://www.perplexity.ai/settings/api
2) Generate an API key in the dashboard
3) Store the key in config (recommended) or set `PERPLEXITY_API_KEY` in the Gateway environment.

## Config example

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-..."
        }
      }
    }
  }
}
```

## Switching from Brave

```json5
{
  tools: {
    web: {
      search: {
        provider: "perplexity",
        perplexity: {
          apiKey: "pplx-..."
        }
      }
    }
  }
}
```

## Where to set the key (recommended)

**Recommended:** run `clawdbot configure --section web`. It stores the key in
`~/.clawdbot/clawdbot.json` under `tools.web.search.perplexity.apiKey`.

**Environment alternative:** set `PERPLEXITY_API_KEY` in the Gateway process
environment. For a gateway install, put it in `~/.clawdbot/.env` (or your
service environment). See [Env vars](/help/faq#how-does-clawdbot-load-environment-variables).

## Notes

- Perplexity Search API returns structured results (title, URL, snippet) similar to Brave Search
- Results are cached for 15 minutes by default (configurable via `cacheTtlMinutes`)
- Supports country-specific search via the `country` parameter
- Supports domain filtering (can be added as a future enhancement)

See [Web tools](/tools/web) for the full web_search configuration.
