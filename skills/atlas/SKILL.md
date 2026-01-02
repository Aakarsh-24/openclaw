---
name: atlas
description: Query the user's ATLAS personal knowledge base for search, concepts, insights, actions, and stats.
homepage: https://github.com/filipdam/atlas
metadata: {"clawdis":{"emoji":"🧠"}}
---

# ATLAS Knowledge Base

ATLAS is the user's personal knowledge management system. You have direct access via the `atlas_query` tool.

## Available Actions

| Action | Description | Required Params |
|--------|-------------|-----------------|
| `search` | Semantic search across all knowledge | `query` |
| `concept` | Get details about a specific concept | `concept_name` or `query` |
| `insights` | Get curated insights | `query` (optional topic filter) |
| `actions` | Get pending action items | none |
| `stats` | Get knowledge base overview | none |

## When to Use

- User asks "What do I know about X?" → `atlas_query({ action: "search", query: "X" })`
- User asks for their tasks/actions → `atlas_query({ action: "actions" })`
- User asks about a specific concept → `atlas_query({ action: "concept", concept_name: "concept-name" })`
- User wants insights on a topic → `atlas_query({ action: "insights", query: "topic" })`
- User wants an overview → `atlas_query({ action: "stats" })`

## Example Usage

Search for knowledge:
```
atlas_query({ action: "search", query: "machine learning transformers", limit: 5 })
```

Get concept details:
```
atlas_query({ action: "concept", concept_name: "attention-mechanism" })
```

Get all insights (no filter):
```
atlas_query({ action: "insights", limit: 10 })
```

Get insights on a topic:
```
atlas_query({ action: "insights", query: "productivity", limit: 5 })
```

Get pending actions:
```
atlas_query({ action: "actions" })
```

Get knowledge base stats:
```
atlas_query({ action: "stats" })
```

## Notes

- ATLAS must be running locally (`atlas serve` on port 8888 by default)
- Results are returned as JSON; summarize for the user
- The knowledge base contains notes, bookmarks, insights, and action items from various sources
- Use semantic search for broad queries; use concept lookup for specific known concepts
