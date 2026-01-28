# Agent-to-Agent Protocol (A2A)

This document defines conventions for agent interoperability and federation.

## Overview

The A2A protocol enables:
- **Discovery**: Agents declare their skills and capabilities
- **Federation**: Agents can live anywhere (local, git repos, remote)
- **Communication**: Standardized task request/response format
- **Dependencies**: Explicit MCP and agent dependencies
- **Coordination**: Rules for multi-agent workflows

---

## Federated Architecture

Agent systems work best as **federated orchestrators**. Agents are self-contained, portable, and can live anywhere:

| Location Type | Example | Use Case |
|--------------|---------|----------|
| `local` | `./agents/basil` | Agents in the same repo |
| `git` | `github.com/user/agent` | External agent repos |

### Key Principles

1. **Agents are the atomic unit** — Self-contained, independently useful
2. **Orchestrators are trained routers** — Orchestration skill, not agent containers
3. **Registry enables discovery** — Agents declare location, skills, signals
4. **Lazy invocation** — Agents spin up only when needed

### Agent Structure

Every agent (local or external) follows this structure:

```
agent-name/
├── agent.json          # Self-describing card (A2A-aligned)
├── CLAUDE.md           # System prompt / instructions
├── knowledge/          # Persistent context (optional)
│   └── *.md
├── .mcp.json           # MCP config (optional)
└── README.md           # Human documentation (optional)
```

---

## Agent Cards (agent.json)

Every agent MUST have an `agent.json` file in their directory.

### Required Fields

```json
{
  "name": "agent-id",           // Lowercase, no spaces
  "version": "1.0.0",           // Semantic versioning
  "description": "..."          // Brief description
}
```

### Core Fields

```json
{
  "displayName": "Human Name",  // For display
  "role": "Agent's Role",       // e.g., "Sous Chef"
  "personality": "...",         // Brief personality description
  "signals": [...],             // Routing keywords
  "skills": [...],              // A2A-aligned skills (preferred)
  "capabilities": [...],        // Legacy capability format
  "context": "personal",        // personal | work | shared
  "invocation": {...},          // How to invoke this agent
  "provider": {...},            // Who maintains this agent
  "dependencies": {...},        // MCPs, agents, knowledge
  "observability": {...},       // OTel config
  "coordination": {...},        // Multi-agent rules
  "metadata": {...}             // Author, dates, tags
}
```

### Full Schema

See `schemas/agent.schema.json` for complete specification.

---

## Skills (A2A-Aligned)

Skills are the preferred way to declare what an agent can do. They align with Google's A2A protocol and enable skill-based routing.

### Structure

```json
{
  "skills": [
    {
      "id": "parse-recipe",
      "name": "Parse Recipe",
      "description": "Extract structured recipe from URL or text",
      "triggers": ["this recipe", "pinterest", "recipe from"]
    },
    {
      "id": "suggest-meal",
      "name": "Suggest Meal",
      "description": "Suggest meals based on preferences or constraints",
      "triggers": ["what should I cook", "dinner ideas"]
    }
  ]
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Kebab-case identifier (e.g., `parse-recipe`) |
| `name` | No | Human-readable name |
| `description` | Yes | What this skill does |
| `triggers` | No | Phrases that invoke this skill |

### Skills vs Capabilities

| Aspect | Skills | Capabilities |
|--------|--------|--------------|
| Format | A2A-aligned | Legacy format |
| Routing | Via triggers + skillIndex | Via signals only |
| Schemas | Optional | Recommended |
| Use | Preferred for new agents | Backward compatibility |

For new agents, use `skills`. Existing agents can keep `capabilities` — both are supported.

---

## Context Classification

The `context` field declares who can use this agent:

| Context | Description | Example |
|---------|-------------|---------|
| `personal` | Individual user only | Personal assistant agents |
| `work` | Team/organization | Work team agents |
| `shared` | Anyone / any orchestrator | Utility agents |

```json
{
  "context": "personal"
}
```

This enables:
- Filtering agents by context (e.g., team UI shows only `work` + `shared`)
- Different access patterns per context
- Clear ownership boundaries

---

## Invocation

The `invocation` block makes agents self-describing for portability:

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

### Fields

| Field | Description |
|-------|-------------|
| `type` | How to invoke: `claude-subprocess`, `http`, `grpc` |
| `systemPrompt` | Relative path to system prompt file |
| `mcpConfig` | Relative path to MCP config (if any) |
| `knowledgePath` | Relative path to knowledge directory |

**Note:** Paths are relative to the agent's root directory. This makes agents fully portable — move them anywhere and invocation still works.

### Invocation Types

| Type | Description | Status |
|------|-------------|--------|
| `claude-subprocess` | Claude CLI subprocess | Implemented |
| `http` | HTTP API endpoint | Future |
| `grpc` | gRPC endpoint | Future |

---

## Provider

The `provider` block identifies who maintains the agent (A2A standard):

```json
{
  "provider": {
    "name": "Your Name",
    "contact": "email@example.com"
  }
}
```

Useful for:
- External agents from different sources
- Accountability for agent behavior
- Contact for issues or updates

---

## Signals

Signals are keywords that trigger routing to an agent.

### Guidelines

- Include common variations ("todo", "task", "reminder")
- Include domain-specific terms ("recipe", "pinterest.com")
- Lowercase, can include spaces for phrases ("should i")
- Ordered by specificity (more specific first)

### Example

```json
"signals": [
  "pinterest.com",      // Very specific
  "recipe",             // Domain-specific
  "cook",               // Action word
  "dinner",             // Context word
  "food"                // General category
]
```

### Signals vs Skill Triggers

| Aspect | Signals | Skill Triggers |
|--------|---------|----------------|
| Scope | Agent-level routing | Skill-level routing |
| Granularity | "Route to this agent" | "Use this specific skill" |
| Location | `agent.json` and registry | `skills[].triggers` |

Both work together — signals for agent selection, triggers for skill matching.

---

## Capabilities (Legacy)

Capabilities define what an agent can do with full input/output schemas.

### Structure

```json
{
  "name": "parse_recipe",
  "description": "What it does",
  "inputSchema": {
    "type": "object",
    "required": ["url"],
    "properties": {
      "url": { "type": "string" }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "ingredients": { "type": "array" }
    }
  }
}
```

### Naming Conventions

- Use `snake_case` for capability names
- Be specific: `parse_recipe` not `process`
- Match the action: `create_event`, `view_calendar`, `draft_post`

---

## Dependencies

### MCP Dependencies

Declare which MCP servers an agent needs:

```json
"dependencies": {
  "mcps": [
    {
      "name": "google-calendar",
      "required": true,
      "capabilities": ["view_calendar", "create_event"]
    },
    {
      "name": "notion",
      "required": false,
      "capabilities": ["draft_post"]
    }
  ]
}
```

**Fields:**
- `name`: MCP server name as in `.mcp.json`
- `required`: If true, agent cannot function without it
- `capabilities`: Which agent capabilities need this MCP

This enables **lazy loading** — only connect MCPs when needed.

### Agent Dependencies

Declare which other agents this one may call:

```json
"dependencies": {
  "agents": ["agent-a", "agent-b"]
}
```

### Knowledge Dependencies

Declare required knowledge files:

```json
"dependencies": {
  "knowledge": [
    "knowledge/domain-context.md",
    "knowledge/preferences.md"
  ]
}
```

---

## Registry

The registry enables agent discovery and routing. See `schemas/registry.schema.json` for full schema.

### Structure

```json
{
  "version": "3.0",
  "orchestrator": "my-orchestrator",

  "agents": {
    "agent-name": {
      "location": { "type": "local", "path": "./agents/agent-name" },
      "context": "personal",
      "displayName": "Agent Name",
      "role": "Role Description",
      "description": "What it does...",
      "signals": ["keyword1", "keyword2"],
      "skills": [...],
      "mcps": [...]
    }
  },

  "skillIndex": {
    "skill-id-1": "agent-name",
    "skill-id-2": "agent-name"
  },

  "routing": {
    "defaultAgent": null,
    "switchCommands": ["talk to", "switch to"],
    "multiAgentTriggers": ["and also", "then"]
  }
}
```

### Agent Locations

```json
// Local agent
"location": {
  "type": "local",
  "path": "./agents/agent-name"
}

// Git-based agent
"location": {
  "type": "git",
  "repo": "github.com/user/agent-repo",
  "branch": "main",
  "localPath": "./agents/external/agent-name"
}
```

### Skill Index

The `skillIndex` maps skill IDs to agents for fast routing:

```json
"skillIndex": {
  "parse-recipe": "cooking-agent",
  "suggest-meal": "cooking-agent",
  "view-calendar": "calendar-agent"
}
```

This enables direct skill-based routing without scanning all agents.

---

## Adding a New Agent

### Local Agent

1. Create `agents/[name]/` directory
2. Add `CLAUDE.md` with instructions
3. Add `agent.json` following this protocol
4. Add `.mcp.json` if agent needs integrations
5. Add to registry
6. Update orchestrator routing if needed

### External Agent (Git-Based)

External agents live in their own repos and get cloned into `agents/external/`.

**1. Create the agent repo:**
```
my-agent/
├── agent.json          # Must include invocation block
├── CLAUDE.md           # System prompt
├── knowledge/          # Generic knowledge (no personal data)
└── README.md           # Setup instructions
```

**2. Add to registry:**
```json
"myagent": {
  "location": {
    "type": "git",
    "repo": "github.com/user/my-agent",
    "branch": "main",
    "localPath": "./agents/external/myagent"
  },
  "context": "shared",
  "displayName": "My Agent",
  "description": "...",
  "signals": [...],
  "skills": [...],
  "mcps": []
}
```

**3. First use flow:**
- Orchestrator sees `location.type: "git"`
- Checks if `localPath` exists
- If not: `git clone {repo} {localPath}`
- If exists: optionally `git pull` to update
- Run subprocess using the local clone

**4. Security considerations:**
- Never commit secrets to agent repos
- MCP tokens stay in local environment variables
- Personal knowledge files stay local (not in shared agent repos)
- `.mcp.json` contains structure only, not credentials

---

## Versioning

### Agent Versions

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking capability changes
- **MINOR**: New capabilities (backward compatible)
- **PATCH**: Bug fixes, documentation

### Registry Version

The registry has its own version. Current recommended: `3.0`

| Version | Changes |
|---------|---------|
| 1.0 | Basic agent listing |
| 2.0 | Added signals, personality |
| 3.0 | Federation support (locations, skills, skillIndex) |

---

## Best Practices

### Do

- Use `skills` for new agents (A2A-aligned)
- Include `invocation` block for portability
- Set `context` to enable proper access control
- Define all dependencies explicitly
- Use descriptive signals and triggers
- Include observability config

### Don't

- Skip the agent.json — it's required
- Use vague signals that match too broadly
- Assume MCPs are always connected
- Forget to add to registry
- Hardcode paths (use relative paths in invocation)
