# Subagent Task Template

Use `sessions_spawn` to delegate parallel work.

## Model Selection (APEX 6.3)

| Task Type | Model | Why |
|-----------|-------|-----|
| Coding/debugging | `dev` | Fastest (1400ms), best SWE-bench |
| Research/analysis | `kimi` | 256K context, native Agent Swarm |
| Quality gate | `deep` | Best reasoning depth |
| Simple tasks | `dev` | Speed wins |

## Required Format

```
sessions_spawn(
  task: """
  FIRST: Read apex-vault/APEX_COMPACT.md and follow APEX v6.3.3 protocols.
  
  TASK: [Your actual task description here]
  """,
  label: "[task-label]",
  model: "dev",  // or "kimi"/"deep" based on task type
  runTimeoutSeconds: 300
)
```

## Rules

- **MANDATORY:** Every task MUST start with the APEX loading instruction
- **MANDATORY:** Select model based on task type (see table above)
- Max 4 concurrent subagents
- Devstral-2 (`dev`) has no thinking - use explicit checkpoints
- Subagents cannot access: cron, gateway, protected files
- Results announce back to main session

## When to Use

| Use Case | Model |
|----------|-------|
| Parallel research | `kimi` |
| Long-running summarization | `kimi` |
| Coding/implementation | `dev` |
| Code review | `deep` |
| Simple triage | `dev` |
| Overnight builds | `dev` |
