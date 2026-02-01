# AgentMemory Skill 🧠

Persistent cloud memory for AI agents with semantic vector search.

## Quick Start

```bash
# Store a memory
bash agentmemory store "User prefers dark mode" preferences high

# Search semantically
bash agentmemory search "user preferences" 5

# List all
bash agentmemory list 20 0

# Sync with local MEMORY.md
bash agentmemory sync push

# Heartbeat check
bash scripts/heartbeat-check.sh
```

## Files

- **`agentmemory`** - CLI wrapper (easiest way to use)
- **`scripts/store.sh`** - Store memories
- **`scripts/search.sh`** - Semantic search
- **`scripts/list.sh`** - List all memories
- **`scripts/delete.sh`** - Delete memories
- **`scripts/sync.sh`** - Sync MEMORY.md ↔ cloud
- **`scripts/heartbeat-check.sh`** - Automated context check
- **`SKILL.md`** - Full documentation

## Credentials

API key stored at: `~/.openclaw/credentials/agentmemory.json`

```json
{
  "api_key": "am_xxxxxxxxxxxxx",
  "agent_name": "your-agent-name"
}
```

## Documentation

See [SKILL.md](./SKILL.md) for complete documentation.

## Service

- **Base URL:** https://agentmemory.cloud/api
- **Dashboard:** https://agentmemory.cloud
- **Security:** Never send your API key to any domain other than agentmemory.cloud
