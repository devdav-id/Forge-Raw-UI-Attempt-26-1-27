# Forge - Agent Infrastructure Builder

Forge is a developer agent that builds other agents. It contains complete, internalized standards for creating interoperable agent systems — from simple single-purpose agents to full multi-agent orchestration systems.

## What Forge Does

| Capability | Description |
|------------|-------------|
| **Create Sub-Agents** | Build specialized agents for specific domains (cooking, calendar, content, etc.) |
| **Create Orchestrators** | Build routing agents that coordinate multiple sub-agents |
| **Scaffold Complete Systems** | Create full agent infrastructures from scratch |
| **Apply Standards** | Bring existing projects up to interoperability standards |
| **Debug Infrastructure** | Troubleshoot agent coordination and delegation issues |

## Quick Start

Forge runs as a Claude subprocess:

```bash
claude -p "Help me create an agent for managing my reading list" \
  --system-prompt "$(cat CLAUDE.md)"
```

Or with an orchestrator that knows about Forge, just ask it to delegate.

---

## The Philosophy

### Core Principles

1. **Agents are the atomic unit** — Self-contained, independently useful
2. **Orchestrators are routers** — They coordinate, not contain
3. **Standards enable federation** — Common contracts let agents work anywhere
4. **Incremental complexity** — Start simple, add structure as needed

### What Makes Agents Interoperable

Every agent Forge creates is:

- **Self-contained** — Everything needed is in one directory
- **Self-describing** — `agent.json` declares capabilities, dependencies, how to invoke
- **Portable** — Move anywhere, works the same
- **Discoverable** — Any orchestrator can find and call them

---

## Standards Overview

Forge contains complete standards documentation. Here's what they cover:

### Agent-to-Agent Protocol (A2A)

**File:** `knowledge/standards/agent-protocol.md`

Every agent has an `agent.json` card that declares:

```json
{
  "name": "my-agent",
  "version": "1.0.0",
  "description": "What this agent does",
  "context": "personal | work | shared",
  "skills": [
    {
      "id": "do-something",
      "description": "Performs a specific task",
      "triggers": ["do something", "help me with"]
    }
  ],
  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md"
  }
}
```

**Key concepts:**
- **Skills** — What the agent can do, with trigger phrases for routing
- **Context** — Who can use it (`personal`, `work`, `shared`)
- **Invocation** — How to call it (makes agents portable)
- **Signals** — Keywords that route requests to this agent

### Task Format

**File:** `knowledge/standards/task-format.md`

How agents communicate:

```json
{
  "id": "unique-task-id",
  "type": "capability_name",
  "payload": { },
  "status": "pending | in_progress | completed | failed"
}
```

### Subprocess Delegation

**File:** `knowledge/standards/subprocess-delegation.md`

How orchestrators call agents:

```bash
# First call (new session)
claude -p "task" --session-id "uuid" --system-prompt "$(cat agent/CLAUDE.md)"

# Follow-up calls (maintains context)
claude -p "follow-up" --resume "uuid" --system-prompt "$(cat agent/CLAUDE.md)"
```

The orchestrator tracks session IDs to maintain conversation context with each agent.

### Other Standards

| Standard | File | Purpose |
|----------|------|---------|
| Observability | `knowledge/standards/observability.md` | OpenTelemetry tracing patterns |
| Coordination | `knowledge/standards/coordination.md` | Multi-agent workflows, IF-THEN rules |
| Error Contracts | `knowledge/standards/error-contracts.md` | Standard error codes and recovery |

---

## Architecture Patterns

**File:** `knowledge/patterns/infrastructure-archetypes.md`

### 1. Single-Domain Agent

Simplest pattern — one agent, one domain:

```
my-agent/
├── agent.json
├── CLAUDE.md
└── knowledge/
```

### 2. Personal Assistant System

Orchestrator with multiple personal agents:

```
my-assistant/
├── CLAUDE.md                    # Orchestrator
├── reference/
│   └── agent-registry.json      # Agent roster
├── shared/context/
│   ├── user-profile.md
│   └── preferences.md
└── agents/
    ├── cooking/
    ├── calendar/
    └── content/
```

### 3. Team Orchestrator

Multiple users, access control by context:

```
team-system/
├── orchestrator/
├── reference/
│   └── agent-registry.json
└── agents/
    ├── shared/          # Anyone can use
    ├── work/            # Team members only
    └── external/        # Git-based agents
```

### 4. Hierarchical System

Agents that orchestrate their own sub-agents — for complex domains.

---

## File Structure

```
forge/
├── README.md                           # You are here
├── CLAUDE.md                           # Forge's instructions (for AI)
├── agent.json                          # Forge's self-describing card
│
└── knowledge/
    ├── standards-reference.md          # Quick reference index
    ├── onboarding-patterns.md          # Bringing projects up to standards
    ├── project-templates.md            # Ready-to-use templates
    │
    ├── standards/                      # Full specifications
    │   ├── agent-protocol.md           # A2A protocol, agent cards
    │   ├── task-format.md              # Request/response structure
    │   ├── observability.md            # OpenTelemetry patterns
    │   ├── coordination.md             # Multi-agent workflows
    │   ├── error-contracts.md          # Error handling
    │   └── subprocess-delegation.md    # Invocation patterns
    │
    ├── schemas/                        # JSON schemas for validation
    │   ├── agent.schema.json
    │   ├── task.schema.json
    │   └── registry.schema.json
    │
    └── patterns/                       # Architecture guidance
        ├── orchestrator-patterns.md    # How to build orchestrators
        └── infrastructure-archetypes.md # System architecture examples
```

---

## Using Forge

### Create a Sub-Agent

Ask Forge to create a specialized agent:

```
You: I need an agent to help with meal planning

Forge: Got it. Let me sketch this out:
- Domain: Meal planning, recipes, grocery lists
- Skills: Plan weekly meals, generate grocery list, suggest recipes

Before I create the structure:
1. Where do you want to store meal plans?
2. Any dietary restrictions to track?
3. Integration with calendar for scheduling?
```

### Create an Orchestrator

Ask Forge to build a routing layer:

```
You: I want a personal assistant with cooking and calendar agents

Forge: I'll scaffold a personal assistant system:

├── CLAUDE.md              # Orchestrator
├── reference/
│   └── agent-registry.json
├── shared/context/
└── agents/
    ├── cooking/
    └── calendar/

Do you want me to:
1. Create the full scaffold now?
2. Start with orchestrator + one agent?
```

### Apply Standards to Existing Project

Bring an existing project up to standards:

```
You: I have an agent project that needs standardization

Forge: Let me analyze what's there...

Current state:
- 3 agents with instruction files
- No agent.json cards
- Ad-hoc communication

Recommended migration:
1. Add agent.json to main orchestrator
2. Add agent.json to sub-agents
3. Standardize task format
4. Add observability config
```

---

## Key Concepts Reference

### Context Classification

| Context | Who Can Use |
|---------|-------------|
| `personal` | Individual user only |
| `work` | Team/organization |
| `shared` | Anyone (like Forge itself) |

### Skills vs Signals

- **Skills** — Specific capabilities with trigger phrases
- **Signals** — Keywords that route to an agent

Skills enable precise routing ("use the parse-recipe skill"). Signals enable fuzzy routing ("anything about cooking goes to cooking agent").

### Agent Registry

Orchestrators use a registry to discover agents:

```json
{
  "version": "3.0",
  "orchestrator": "my-assistant",
  "agents": {
    "cooking": {
      "location": { "type": "local", "path": "./agents/cooking" },
      "signals": ["recipe", "cook", "dinner"],
      "skills": [...]
    }
  },
  "skillIndex": {
    "parse-recipe": "cooking"
  }
}
```

### External Agents

Agents can live in separate git repos:

```json
{
  "location": {
    "type": "git",
    "repo": "github.com/user/agent-repo",
    "localPath": "./agents/external/agent-name"
  }
}
```

---

## Templates

`knowledge/project-templates.md` contains ready-to-use templates:

1. **Simple Domain Agent** — Single-purpose agent
2. **MCP-Dependent Agent** — Agent with integrations
3. **Orchestrator Agent** — Routes to sub-agents
4. **Content Creation Agent** — Drafts and revisions
5. **External/Shared Agent** — Git-based, portable
6. **Complete System Scaffold** — Full infrastructure

---

## Why These Standards?

| Standard | Why It Matters |
|----------|----------------|
| **A2A Protocol** | Agents need self-describing cards for any orchestrator to discover them |
| **Task Format** | Consistent request/response enables agent interoperability |
| **Observability** | Distributed agents need consistent tracing across boundaries |
| **Coordination** | Cross-repo agents need explicit handoff rules |
| **Error Contracts** | Standardized errors essential when agents come from different sources |

---

## License

MIT

## Author

Jacob Brain
