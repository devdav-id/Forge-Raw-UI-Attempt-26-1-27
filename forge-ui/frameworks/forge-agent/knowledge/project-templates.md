# Project Templates

Quick-start templates for common agent patterns. All templates use v2.0 format with skills, context, and invocation.

---

## 1. Simple Domain Agent

An agent that handles one domain.

### agent.json

```json
{
  "name": "{{name}}",
  "displayName": "{{DisplayName}}",
  "version": "1.0.0",
  "description": "{{Brief description}}",
  "role": "{{Role}}",
  "personality": "{{Personality description}}",

  "context": "personal",

  "skills": [
    {
      "id": "{{primary-skill}}",
      "name": "{{Primary Skill Name}}",
      "description": "{{What it does}}",
      "triggers": ["{{trigger1}}", "{{trigger2}}"]
    }
  ],

  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md",
    "knowledgePath": "./knowledge"
  },

  "provider": {
    "name": "{{Your Name}}"
  },

  "signals": ["{{keyword1}}", "{{keyword2}}", "{{keyword3}}"],

  "dependencies": {
    "mcps": [],
    "agents": [],
    "knowledge": ["knowledge/{{domain}}.md"]
  },

  "observability": {
    "traceEnabled": true,
    "spanName": "{{name}}.operation",
    "attributes": {
      "agent.name": "{{name}}",
      "agent.role": "{{role}}"
    }
  },

  "coordination": {
    "canDelegate": false,
    "acceptsSubtasks": true,
    "rules": []
  },

  "metadata": {
    "author": "{{Your Name}}",
    "created": "{{date}}",
    "tags": ["{{tag1}}", "{{tag2}}"]
  }
}
```

### CLAUDE.md

```markdown
# {{DisplayName}} - {{Role}}

## Identity

You are **{{DisplayName}}**, {{role description}}.

## Role

{{Detailed role description}}

## Capabilities

### {{Primary Capability}}

{{Description of what this capability does}}

**Input**: {{What user provides}}
**Output**: {{What agent returns}}

## Personality

{{Personality description with examples}}

## Knowledge Files

- `knowledge/{{domain}}.md` — {{What this file contains}}

## Example Interactions

### {{Scenario 1}}

\`\`\`
User: {{Example input}}

{{DisplayName}}: {{Example output}}
\`\`\`

### {{Scenario 2}}

\`\`\`
User: {{Example input}}

{{DisplayName}}: {{Example output}}
\`\`\`
```

---

## 2. MCP-Dependent Agent

An agent that requires MCP connections.

### agent.json additions

```json
{
  "dependencies": {
    "mcps": [
      {
        "name": "{{mcp-name}}",
        "required": true,
        "capabilities": ["{{capability_that_needs_it}}"]
      }
    ]
  },
  "coordination": {
    "rules": [
      {
        "condition": "MCP {{mcp-name}} not connected",
        "action": "Guide user through setup before proceeding",
        "scope": "domain"
      }
    ]
  }
}
```

### CLAUDE.md additions

```markdown
## Dependencies

This agent requires the **{{MCP Name}}** MCP to be connected.

### Setup

1. Ensure `{{mcp-name}}` is configured in `.mcp.json`
2. Set required environment variables: `{{ENV_VAR}}`
3. Verify connection

### Fallback

If MCP is not available, {{describe fallback behavior or limitations}}.
```

---

## 3. Orchestrator Agent

An agent that routes to other agents.

### agent.json

```json
{
  "name": "{{orchestrator-name}}",
  "displayName": "{{Orchestrator Name}}",
  "version": "1.0.0",
  "description": "Routes requests to specialized agents",
  "role": "Orchestrator",
  "personality": "Efficient, helpful, knows where everything is",

  "context": "personal",

  "skills": [
    {
      "id": "route-request",
      "name": "Route Request",
      "description": "Analyze request and route to appropriate agent",
      "triggers": []
    },
    {
      "id": "multi-agent-task",
      "name": "Multi-Agent Task",
      "description": "Coordinate task across multiple agents",
      "triggers": []
    }
  ],

  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md",
    "knowledgePath": "./knowledge"
  },

  "provider": {
    "name": "{{Your Name}}"
  },

  "signals": [],

  "dependencies": {
    "mcps": [],
    "agents": ["{{agent1}}", "{{agent2}}", "{{agent3}}"],
    "knowledge": []
  },

  "observability": {
    "traceEnabled": true,
    "spanName": "{{orchestrator-name}}.route",
    "attributes": {
      "agent.name": "{{orchestrator-name}}",
      "agent.role": "orchestrator"
    }
  },

  "coordination": {
    "canDelegate": true,
    "acceptsSubtasks": false,
    "rules": [
      {
        "condition": "Request matches multiple agent signals",
        "action": "Create task sequence and execute",
        "scope": "global"
      },
      {
        "condition": "Agent returns error with recoverable=true",
        "action": "Retry once before reporting failure",
        "scope": "global"
      }
    ]
  }
}
```

### CLAUDE.md structure

```markdown
# {{Name}} - Orchestrator

## Identity

You are **{{Name}}**, the central orchestrator for {{system description}}.

## Startup

On the first message of any session:
1. Load context files:
   - `shared/context/user-profile.md`
   - `reference/agent-registry.json`
2. Respond to whatever was asked

## Sub-Agents

| Agent | Role | Signals |
|-------|------|---------|
| {{Agent1}} | {{Role1}} | {{signals}} |
| {{Agent2}} | {{Role2}} | {{signals}} |

## Routing Logic

### Single-Agent Routing

When a request clearly maps to one agent, delegate directly.

### Multi-Agent Routing

When multiple agents are needed:
1. Identify required agents
2. Determine execution order (parallel or sequential)
3. Execute and synthesize results

### No Routing Needed

Handle directly:
- General greetings
- Meta-questions about the system
- Requests that don't match any agent

## Agent Delegation

All agents run as subprocesses:

\`\`\`bash
# First call
claude -p "<task>" --session-id "<uuid>" --system-prompt "$(cat <path>/CLAUDE.md)"

# Subsequent calls
claude -p "<task>" --resume "<uuid>" --system-prompt "$(cat <path>/CLAUDE.md)"
\`\`\`

## Example Interactions

[Include examples of single-agent, multi-agent, and direct handling]
```

### Registry Template

```json
{
  "version": "3.0",
  "orchestrator": "{{orchestrator-name}}",

  "agents": {
    "{{agent1}}": {
      "location": { "type": "local", "path": "./agents/{{agent1}}" },
      "context": "personal",
      "displayName": "{{Agent1 Name}}",
      "role": "{{Role}}",
      "description": "{{Description}}",
      "signals": ["{{signal1}}", "{{signal2}}"],
      "skills": [...],
      "mcps": []
    }
  },

  "skillIndex": {
    "{{skill-id}}": "{{agent-name}}"
  },

  "routing": {
    "defaultAgent": null,
    "switchCommands": ["talk to", "switch to"],
    "multiAgentTriggers": ["and also", "then"]
  }
}
```

---

## 4. Content Creation Agent

Agent that produces drafts/content.

### Key patterns

```json
{
  "skills": [
    {
      "id": "create-draft",
      "name": "Create Draft",
      "description": "Create content draft with multiple options",
      "triggers": ["write", "draft", "create"]
    }
  ],
  "coordination": {
    "rules": [
      {
        "condition": "User requests content",
        "action": "Always provide 2-3 options with different angles",
        "scope": "domain"
      },
      {
        "condition": "User provides feedback on draft",
        "action": "Incorporate feedback and offer revised version",
        "scope": "domain"
      }
    ]
  }
}
```

### CLAUDE.md patterns

```markdown
## Output Format

Always provide options:

**Option A - {{Angle 1}}**
{{Draft}}

---

**Option B - {{Angle 2}}**
{{Draft}}

---

Which direction feels right?

## Voice Calibration

When user provides feedback ("too formal", "more punchy"):
1. Acknowledge the feedback
2. Offer revised version
3. Propose updating knowledge file if pattern should persist
```

---

## 5. External/Shared Agent (Git-Based)

An agent that lives in its own repo and can be used by any orchestrator.

### Repository Structure

```
my-agent/
├── agent.json          # MUST include invocation block
├── CLAUDE.md           # System prompt
├── knowledge/          # Generic knowledge only (no personal data!)
│   └── domain.md
└── README.md           # Setup instructions for users
```

### agent.json

```json
{
  "name": "{{name}}",
  "displayName": "{{DisplayName}}",
  "version": "1.0.0",
  "description": "{{Brief description}}",
  "role": "{{Role}}",
  "personality": "{{Personality description}}",

  "context": "shared",

  "skills": [
    {
      "id": "{{primary-skill}}",
      "name": "{{Primary Skill Name}}",
      "description": "{{What it does}}",
      "triggers": ["{{trigger1}}", "{{trigger2}}"]
    }
  ],

  "invocation": {
    "type": "claude-subprocess",
    "systemPrompt": "./CLAUDE.md",
    "knowledgePath": "./knowledge"
  },

  "provider": {
    "name": "{{author}}",
    "contact": "{{email or url}}"
  },

  "signals": ["{{keyword1}}", "{{keyword2}}"],

  "dependencies": {
    "mcps": [],
    "agents": [],
    "knowledge": []
  },

  "observability": {
    "traceEnabled": true,
    "spanName": "{{name}}.operation"
  },

  "coordination": {
    "canDelegate": false,
    "acceptsSubtasks": true
  }
}
```

### Registry Entry (in consumer's registry)

```json
"{{name}}": {
  "location": {
    "type": "git",
    "repo": "github.com/{{user}}/{{repo}}",
    "branch": "main",
    "localPath": "./agents/external/{{name}}"
  },
  "context": "shared",
  "displayName": "{{DisplayName}}",
  "role": "{{Role}}",
  "description": "{{Brief description}}",
  "signals": ["{{keyword1}}", "{{keyword2}}"],
  "skills": [...],
  "mcps": []
}
```

### README.md

```markdown
# {{DisplayName}}

{{Brief description}}

## Installation

Add to your `agent-registry.json`:

\`\`\`json
"{{name}}": {
  "location": {
    "type": "git",
    "repo": "github.com/{{user}}/{{repo}}",
    "branch": "main",
    "localPath": "./agents/external/{{name}}"
  },
  ...
}
\`\`\`

## Requirements

- Claude CLI
- {{Any other requirements}}

## Skills

| Skill | Description | Triggers |
|-------|-------------|----------|
| {{skill-id}} | {{What it does}} | "{{trigger1}}", "{{trigger2}}" |

## License

{{License}}
```

---

## 6. Complete System Scaffold

Template for scaffolding an entire agent system from scratch.

### Directory Structure

```
{{system-name}}/
├── CLAUDE.md                    # Orchestrator instructions
├── reference/
│   └── agent-registry.json      # Agent roster
├── shared/
│   ├── context/
│   │   ├── user-profile.md      # Who the user is
│   │   └── preferences.md       # Response preferences
│   └── state/                   # Runtime state (gitignored)
├── agents/
│   ├── {{agent1}}/
│   │   ├── CLAUDE.md
│   │   ├── agent.json
│   │   └── knowledge/
│   ├── {{agent2}}/
│   │   ├── CLAUDE.md
│   │   ├── agent.json
│   │   └── knowledge/
│   └── external/                # Git-based agents (gitignored)
└── .gitignore
```

### .gitignore

```
# Runtime state
shared/state/

# External agents (cloned from git)
agents/external/

# Environment
.env
*.local
```

### shared/context/user-profile.md

```markdown
# User Profile

## Overview

[Brief description of who uses this system]

## Preferences

[Key preferences that affect all agents]

## Current Focus

[What the user is currently working on]
```

### shared/context/preferences.md

```markdown
# Response Preferences

## Style

- [e.g., Direct and concise]
- [e.g., Structured when needed]

## Constraints

- [e.g., Time-sensitive schedule]
- [e.g., Specific formatting preferences]
```

---

## Using Templates

1. Copy the relevant template
2. Replace `{{placeholders}}` with actual values
3. Remove sections that don't apply
4. Add domain-specific content
5. Validate against schema
6. For external agents: create repo, add registry entry

### Placeholder Reference

| Placeholder | Description |
|-------------|-------------|
| `{{name}}` | Agent identifier (lowercase, no spaces) |
| `{{DisplayName}}` | Human-readable name |
| `{{Role}}` | Brief role description |
| `{{description}}` | What the agent does |
| `{{personality}}` | How the agent communicates |
| `{{trigger}}` | Phrases that invoke a skill |
| `{{signal}}` | Keywords for routing |
