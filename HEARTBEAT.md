# HEARTBEAT.md

## Keep this file empty (or with only comments) to skip heartbeat API calls

## Add tasks below when you want the agent to check something periodically

## Heartbeat Checklist

### System Health
- Check RAM usage. If over 90%, send an alert via Telegram

### AgentMemory Cloud Sync (every session start)
1. Search AgentMemory for context relevant to current active projects
2. Store any new important information discovered during recent sessions
3. Update outdated memories if information has changed
4. Check for high-importance memories added in the last 24 hours

**Quick commands:**
```bash
# Search for current context
bash skills/agentmemory/agentmemory search "current projects" 5

# Store new facts
bash skills/agentmemory/agentmemory store "New fact discovered" category importance

# Sync local MEMORY.md to cloud
bash skills/agentmemory/agentmemory sync push
```
