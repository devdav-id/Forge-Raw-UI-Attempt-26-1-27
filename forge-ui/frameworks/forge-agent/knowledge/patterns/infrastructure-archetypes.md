# Infrastructure Archetypes

This document describes common patterns for agent system architectures, from simple to complex.

---

## 1. Single-Domain Agent

The simplest architecture: one agent that handles one domain.

### When to Use

- Single focused domain (cooking, calendar, content)
- No need for routing or coordination
- User interacts directly with the agent

### Structure

```
my-agent/
├── agent.json          # Agent card
├── CLAUDE.md           # Instructions
├── knowledge/          # Domain knowledge
│   └── domain.md
└── .mcp.json           # If needs integrations
```

### Example: Recipe Agent

```json
{
  "name": "recipe-agent",
  "displayName": "Recipe Helper",
  "version": "1.0.0",
  "description": "Helps with recipes and cooking",
  "role": "Cooking Assistant",
  "context": "personal",
  "skills": [
    {
      "id": "parse-recipe",
      "name": "Parse Recipe",
      "description": "Extract recipe from URL or text",
      "triggers": ["this recipe", "parse"]
    }
  ],
  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md"
  }
}
```

### Invocation

Direct subprocess call:
```bash
claude -p "Parse this recipe: [url]" \
  --system-prompt "$(cat ./CLAUDE.md)"
```

---

## 2. Personal Assistant System

An orchestrator with multiple personal agents.

### When to Use

- User has multiple domains to manage
- Wants unified interface to multiple capabilities
- Needs context to flow across domains

### Structure

```
assistant-system/
├── CLAUDE.md                    # Orchestrator instructions
├── reference/
│   └── agent-registry.json      # Agent roster
├── shared/
│   └── context/
│       ├── user-profile.md      # Who the user is
│       └── preferences.md       # Cross-cutting preferences
└── agents/
    ├── cooking/
    │   ├── CLAUDE.md
    │   ├── agent.json
    │   └── knowledge/
    ├── calendar/
    │   ├── CLAUDE.md
    │   ├── agent.json
    │   ├── .mcp.json
    │   └── knowledge/
    └── content/
        ├── CLAUDE.md
        ├── agent.json
        └── knowledge/
```

### Key Characteristics

- **Orchestrator runs lean** — No MCPs, just routing
- **Agents run as subprocesses** — Each loads own context/tools
- **Shared context** — User profile accessible to orchestrator
- **Session persistence** — Agents remember within conversation

### Registry Example

```json
{
  "version": "3.0",
  "orchestrator": "assistant",
  "agents": {
    "cooking": {
      "location": { "type": "local", "path": "./agents/cooking" },
      "context": "personal",
      "displayName": "Chef",
      "signals": ["recipe", "cook", "dinner", "food"]
    },
    "calendar": {
      "location": { "type": "local", "path": "./agents/calendar" },
      "context": "personal",
      "displayName": "Calendar",
      "signals": ["calendar", "schedule", "meeting", "available"]
    },
    "content": {
      "location": { "type": "local", "path": "./agents/content" },
      "context": "personal",
      "displayName": "Writer",
      "signals": ["write", "draft", "post", "article"]
    }
  },
  "skillIndex": {
    "parse-recipe": "cooking",
    "view-calendar": "calendar",
    "draft-post": "content"
  }
}
```

---

## 3. Team Orchestrator

Multiple users share access to agents, with access control.

### When to Use

- Team needs shared agent capabilities
- Different users have different access levels
- Mix of personal and shared agents

### Structure

```
team-system/
├── orchestrator/
│   ├── CLAUDE.md
│   └── agent.json
├── reference/
│   └── agent-registry.json
├── shared/
│   └── context/
│       └── team-context.md
└── agents/
    ├── shared/                  # Anyone can use
    │   └── research/
    ├── work/                    # Team members only
    │   ├── project-manager/
    │   └── code-reviewer/
    └── external/                # Git-based agents
        └── forge/
```

### Context Filtering

Registry includes context for filtering:

```json
{
  "agents": {
    "research": {
      "context": "shared",
      "description": "Anyone can use"
    },
    "project-manager": {
      "context": "work",
      "description": "Team members only"
    },
    "personal-coach": {
      "context": "personal",
      "description": "Owner only"
    }
  }
}
```

The orchestrator (or UI layer) filters agents by context:
- Team interface shows `work` + `shared`
- Personal interface shows `personal` + `shared`

### External Agents

Team systems often include external agents:

```json
"forge": {
  "location": {
    "type": "git",
    "repo": "github.com/user/forge-agent",
    "localPath": "./agents/external/forge"
  },
  "context": "shared"
}
```

---

## 4. Hierarchical Multi-Agent System

Agents that can orchestrate their own sub-agents.

### When to Use

- Complex domains that benefit from specialization
- Sub-domains that naturally group together
- Need for nested delegation

### Structure

```
hierarchical-system/
├── orchestrator/                # Top-level orchestrator
│   └── CLAUDE.md
├── reference/
│   └── agent-registry.json
└── agents/
    ├── project-lead/            # Mid-level orchestrator
    │   ├── CLAUDE.md
    │   ├── agent.json
    │   └── sub-agents/
    │       ├── designer/
    │       └── developer/
    └── research-lead/           # Another mid-level orchestrator
        ├── CLAUDE.md
        ├── agent.json
        └── sub-agents/
            ├── analyst/
            └── writer/
```

### Coordination Rules

Mid-level orchestrators declare delegation capabilities:

```json
{
  "coordination": {
    "canDelegate": true,
    "acceptsSubtasks": true,
    "rules": [
      {
        "condition": "Design work requested",
        "action": "Delegate to designer sub-agent",
        "scope": "domain"
      }
    ]
  }
}
```

### Flow Example

```
User Request
└── Top Orchestrator
    └── Project Lead (mid-level)
        ├── Designer (leaf agent)
        └── Developer (leaf agent)
```

---

## 5. Hybrid Architecture

Combining multiple patterns based on need.

### Example: Personal + Work Hybrid

```
hybrid-system/
├── ada/                         # Personal orchestrator
│   └── CLAUDE.md
├── work-orchestrator/           # Work orchestrator
│   └── CLAUDE.md
├── reference/
│   ├── personal-registry.json
│   └── work-registry.json
├── shared/
│   └── context/
│       ├── user-profile.md
│       └── work-context.md
└── agents/
    ├── personal/                # Personal agents
    │   ├── cooking/
    │   └── calendar/
    ├── work/                    # Work agents
    │   ├── project-manager/
    │   └── reviewer/
    └── shared/                  # Both can use
        └── research/
```

### Shared Agents

Agents with `context: "shared"` appear in both registries:

```json
// personal-registry.json
"research": {
  "location": { "type": "local", "path": "./agents/shared/research" },
  "context": "shared"
}

// work-registry.json
"research": {
  "location": { "type": "local", "path": "./agents/shared/research" },
  "context": "shared"
}
```

---

## Choosing an Architecture

| Need | Architecture |
|------|--------------|
| One focused domain | Single-Domain Agent |
| Multiple personal domains | Personal Assistant System |
| Team access with control | Team Orchestrator |
| Complex nested domains | Hierarchical System |
| Multiple contexts | Hybrid Architecture |

### Start Simple

1. Begin with single-domain agents
2. Add orchestrator when you have 3+ agents
3. Add hierarchy only when domains are complex
4. Add team features when collaboration is needed

### Complexity Trade-offs

| Architecture | Complexity | Coordination | Use When |
|--------------|------------|--------------|----------|
| Single Agent | Low | None | One domain |
| Personal Assistant | Medium | Orchestrator | Multiple domains |
| Team | Medium-High | Orchestrator + Auth | Team access |
| Hierarchical | High | Multi-level | Nested specialization |

---

## Common Patterns Across Architectures

### Shared Context

All architectures benefit from shared context files:

```
shared/
└── context/
    ├── user-profile.md      # Who the user is
    └── preferences.md       # Cross-cutting preferences
```

### Agent Knowledge

Each agent has domain-specific knowledge:

```
agents/cooking/
└── knowledge/
    ├── dietary-preferences.md
    ├── favorite-recipes.md
    └── cooking-context.md
```

### External Agents

Any architecture can include external (git-based) agents:

```json
"location": {
  "type": "git",
  "repo": "github.com/user/agent",
  "localPath": "./agents/external/name"
}
```

### State Directory

Runtime state (gitignored):

```
state/
├── active-graphs/       # Multi-agent task graphs
├── pending-tasks/       # Queued tasks
└── signals/             # Inter-agent signals
```
