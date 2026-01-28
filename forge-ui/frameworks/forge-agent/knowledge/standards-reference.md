# Standards Reference

Quick reference index to Forge's internalized standards. For full details, see the files in `./standards/`.

## Core Principle

These standards are **guidelines for interoperability**, not heavy infrastructure. They should be:
- Easy to implement
- Portable across projects
- Incrementally adoptable
- Valuable immediately

If a standard requires complex setup before providing value, it's too heavy.

---

## Standards Index

| Standard | File | Purpose |
|----------|------|---------|
| A2A Protocol | `./standards/agent-protocol.md` | Agent cards, skills, federation |
| Task Format | `./standards/task-format.md` | Request/response structure |
| Observability | `./standards/observability.md` | OpenTelemetry patterns |
| Coordination | `./standards/coordination.md` | Multi-agent workflows |
| Error Contracts | `./standards/error-contracts.md` | Error handling |
| Subprocess Delegation | `./standards/subprocess-delegation.md` | Invocation patterns |

## Schemas Index

| Schema | File | Purpose |
|--------|------|---------|
| Agent Card | `./schemas/agent.schema.json` | agent.json validation |
| Task | `./schemas/task.schema.json` | Task request/response |
| Registry | `./schemas/registry.schema.json` | Agent registry |

## Patterns Index

| Pattern | File | Purpose |
|---------|------|---------|
| Orchestrator Patterns | `./patterns/orchestrator-patterns.md` | Building orchestrators |
| Infrastructure Archetypes | `./patterns/infrastructure-archetypes.md` | System architecture examples |

---

## Quick Reference

### Agent Card (agent.json)

Required fields:
```json
{
  "name": "agent-id",
  "version": "1.0.0",
  "description": "What this agent does"
}
```

Core fields for A2A compliance:
```json
{
  "displayName": "Human Name",
  "role": "Agent Role",
  "context": "personal | work | shared",
  "skills": [...],
  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md"
  },
  "provider": { "name": "Author" }
}
```

Full spec: `./standards/agent-protocol.md`

### Skills Array

```json
{
  "skills": [
    {
      "id": "skill-id",
      "name": "Skill Name",
      "description": "What it does",
      "triggers": ["phrase 1", "phrase 2"]
    }
  ]
}
```

### Context Classification

| Context | Who Uses |
|---------|----------|
| `personal` | Individual user only |
| `work` | Team/organization |
| `shared` | Anyone |

### Invocation Block

Makes agents self-describing and portable:
```json
{
  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md",
    "mcpConfig": "./.mcp.json",
    "knowledgePath": "./knowledge"
  }
}
```

### Task Request

```json
{
  "id": "uuid",
  "type": "capability_name",
  "payload": { /* input */ },
  "context": { "user": "...", "timestamp": "..." },
  "routing": { "source": "...", "target": "..." }
}
```

Full spec: `./standards/task-format.md`

### Task Response

```json
{
  "id": "task-id",
  "status": "completed | failed | pending | in_progress",
  "result": { /* output */ },
  "error": { "code": "...", "message": "...", "recoverable": true }
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| `INVALID_INPUT` | Bad request payload |
| `MCP_NOT_CONNECTED` | MCP not available |
| `AGENT_NOT_FOUND` | Target agent doesn't exist |
| `CAPABILITY_NOT_FOUND` | Agent lacks capability |
| `TIMEOUT` | Operation timed out |

Full list: `./standards/error-contracts.md`

### Span Naming

Pattern: `{agent}.{operation}`

Examples: `cooking.parse_recipe`, `calendar.create_event`

Full spec: `./standards/observability.md`

### IF-THEN Rules

```json
{
  "coordination": {
    "rules": [
      {
        "condition": "When this is true",
        "action": "Do this",
        "scope": "domain | global"
      }
    ]
  }
}
```

Full spec: `./standards/coordination.md`

---

## Agent Directory Structure

```
agent-name/
├── agent.json          # A2A agent card
├── CLAUDE.md           # System prompt
├── knowledge/          # Domain knowledge
│   └── *.md
├── .mcp.json           # MCP config (if needed)
└── README.md           # Human docs (optional)
```

## Registry Structure

```json
{
  "version": "3.0",
  "orchestrator": "name",
  "agents": {
    "agent-name": {
      "location": { "type": "local", "path": "./agents/name" },
      "context": "personal",
      "displayName": "Name",
      "signals": [...],
      "skills": [...]
    }
  },
  "skillIndex": {
    "skill-id": "agent-name"
  }
}
```

---

## Validation Checklist

When validating an agent:

### Required
- [ ] Has `agent.json` with name, version, description
- [ ] Has `CLAUDE.md` with identity, capabilities, examples
- [ ] Has `context` field set (personal/work/shared)
- [ ] Has `skills` array with A2A-aligned entries
- [ ] Has `invocation` block (required for external agents)

### If Applicable
- [ ] Has `provider` block (especially for shared agents)
- [ ] MCP dependencies declared if agent uses MCPs
- [ ] Observability config present
- [ ] Coordination rules defined if multi-agent
- [ ] All skills in agent.json match CLAUDE.md capabilities

### For External Agents
- [ ] Invocation block has all required paths
- [ ] No personal data in knowledge files
- [ ] README.md with setup instructions
