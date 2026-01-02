# ATLAS Bridge Integration Guide

This document describes how to prepare ATLAS for the Phase 2 Event Bridge integration with Clawdis.

## Overview

The ATLAS-Clawdis integration has two paths:

| Path | Direction | Status | Description |
|------|-----------|--------|-------------|
| **Pull** | Clawdis → ATLAS | **Implemented** | `atlas_query` tool calls ATLAS REST API |
| **Push** | ATLAS → Clawdis | **Pending** | ATLAS triggers send webhooks to Clawdis |

## Phase 1: Pull Path (Complete)

Clawdis now has an `atlas_query` tool that calls:

```
ATLAS API (http://localhost:8888)
├── POST /api/search          → Semantic search
├── GET  /api/graph/concept/X → Concept details
├── GET  /api/search/insights → Curated insights
├── GET  /api/actions         → Pending actions
└── GET  /api/overview        → Knowledge base stats
```

**No changes required in ATLAS for Phase 1.**

---

## Phase 2: Push Path (ATLAS Team Preparation)

### Goal

Configure ATLAS triggers to send webhooks to Clawdis when events occur:
- New insights generated
- New notes added
- New content ingested
- Agent work finished

### Clawdis Webhook Endpoint

```
POST http://localhost:18789/hooks/agent
Content-Type: application/json

{
  "prompt": "ATLAS notification: [event description]",
  "context": {
    "source": "atlas",
    "event_type": "insight_created",
    "data": { ... }
  }
}
```

### Required ATLAS Changes

#### 1. Add Clawdis Webhook URL Configuration

In `atlas/config.py` or environment:

```python
CLAWDIS_WEBHOOK_URL = os.getenv("CLAWDIS_WEBHOOK_URL", "http://localhost:18789/hooks/agent")
```

#### 2. Create Trigger Definitions

Create `atlas/triggers/clawdis_bridge.py` or add to existing triggers:

```python
from atlas.agents.triggers import TriggerDefinition, WebhookAction

CLAWDIS_TRIGGERS = [
    TriggerDefinition(
        name="clawdis_new_insight",
        event_type="insight_created",
        action=WebhookAction(
            url=CLAWDIS_WEBHOOK_URL,
            payload_template={
                "prompt": "ATLAS generated a new insight: {{ insight.title }}. Summary: {{ insight.summary }}",
                "context": {
                    "source": "atlas",
                    "event_type": "insight_created",
                    "insight_id": "{{ insight.id }}"
                }
            }
        )
    ),
    TriggerDefinition(
        name="clawdis_new_note",
        event_type="note_created",
        action=WebhookAction(
            url=CLAWDIS_WEBHOOK_URL,
            payload_template={
                "prompt": "New note added to ATLAS: {{ note.title }}",
                "context": {
                    "source": "atlas",
                    "event_type": "note_created",
                    "note_id": "{{ note.id }}"
                }
            }
        )
    ),
    TriggerDefinition(
        name="clawdis_content_ingested",
        event_type="content_ingested",
        action=WebhookAction(
            url=CLAWDIS_WEBHOOK_URL,
            payload_template={
                "prompt": "ATLAS ingested new content: {{ content.source }} ({{ content.item_count }} items)",
                "context": {
                    "source": "atlas",
                    "event_type": "content_ingested",
                    "content_source": "{{ content.source }}"
                }
            }
        )
    ),
    TriggerDefinition(
        name="clawdis_agent_finished",
        event_type="agent_task_completed",
        action=WebhookAction(
            url=CLAWDIS_WEBHOOK_URL,
            payload_template={
                "prompt": "ATLAS agent completed task: {{ task.name }}. Result: {{ task.summary }}",
                "context": {
                    "source": "atlas",
                    "event_type": "agent_task_completed",
                    "task_id": "{{ task.id }}"
                }
            }
        )
    ),
]
```

#### 3. Loop Prevention (Critical)

Add a guard to prevent feedback loops when Clawdis triggers ATLAS which triggers Clawdis:

```python
def should_fire_trigger(trigger: TriggerDefinition, context: dict) -> bool:
    # Prevent loops: don't fire if event originated from Clawdis
    if context.get("source") == "clawdis":
        return False
    return evaluate_condition(trigger, context)
```

#### 4. Register Triggers

In `atlas/agents/triggers.py` or startup:

```python
from atlas.triggers.clawdis_bridge import CLAWDIS_TRIGGERS

def register_triggers():
    for trigger in CLAWDIS_TRIGGERS:
        trigger_registry.register(trigger)
```

### Event Types to Emit

Ensure ATLAS emits these events (if not already):

| Event Type | When | Payload |
|------------|------|---------|
| `insight_created` | New insight generated | `{ insight: { id, title, summary } }` |
| `note_created` | New note added | `{ note: { id, title, source } }` |
| `content_ingested` | Batch content import | `{ content: { source, item_count } }` |
| `agent_task_completed` | Agent finishes work | `{ task: { id, name, summary, status } }` |

### Testing the Bridge

1. Start Clawdis gateway: `clawdis gateway`
2. Start ATLAS: `atlas serve`
3. Trigger an event in ATLAS (e.g., create a note)
4. Verify Clawdis receives the webhook and agent responds

### Environment Variables

```bash
# ATLAS side
export CLAWDIS_WEBHOOK_URL="http://localhost:18789/hooks/agent"

# Clawdis side (already configured)
export ATLAS_URL="http://localhost:8888"
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐       PULL (sync)        ┌──────────────────┐ │
│  │   Clawdis    │ ──────────────────────── │      ATLAS       │ │
│  │    Agent     │   atlas_query tool       │   REST API       │ │
│  │              │                          │   :8888          │ │
│  │  Gateway     │                          │                  │ │
│  │  :18789      │ ◀─────────────────────── │    Triggers      │ │
│  │              │       PUSH (async)       │                  │ │
│  │ /hooks/agent │    webhook events        │                  │ │
│  └──────────────┘                          └──────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Questions?

Contact the Clawdis team for webhook payload format requirements or integration support.
