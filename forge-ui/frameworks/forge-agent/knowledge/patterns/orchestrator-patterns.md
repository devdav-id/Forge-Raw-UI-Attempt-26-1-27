# Orchestrator Patterns

This document describes how to build orchestrator agents that route, delegate, and synthesize across sub-agents.

## What is an Orchestrator?

An orchestrator is a specialized agent that:
- **Routes** requests to the right sub-agent(s)
- **Delegates** work via subprocess calls
- **Synthesizes** responses from multiple agents
- **Maintains** conversation context and session state

Orchestrators don't do domain work themselves — they coordinate agents that do.

---

## Core Components

### 1. Agent Registry

The orchestrator needs to know what agents are available:

```json
{
  "version": "3.0",
  "orchestrator": "my-orchestrator",
  "agents": {
    "cooking-agent": {
      "location": { "type": "local", "path": "./agents/cooking" },
      "context": "personal",
      "displayName": "Chef",
      "signals": ["recipe", "cook", "dinner"],
      "skills": [...]
    }
  },
  "skillIndex": {
    "parse-recipe": "cooking-agent"
  }
}
```

### 2. Routing Logic

The orchestrator's CLAUDE.md defines how to match requests to agents:

```markdown
## Routing Logic

### Single-Agent Routing
When a request clearly maps to one agent, delegate to them:
- Recipe/cooking questions → Cooking Agent
- Calendar/scheduling → Calendar Agent
- Content/writing → Content Agent

### Multi-Agent Routing
When a request involves multiple domains:
1. Identify which agents are needed
2. Call each sequentially with appropriate context
3. Synthesize their outputs into a unified response

### No Routing Needed
Handle these yourself:
- General greetings and small talk
- Questions about how the system works
- Meta-questions about agents or capabilities
```

### 3. Subprocess Delegation

Orchestrators call agents via subprocess:

```bash
# First call to an agent (new session)
claude -p "<task>" \
  --session-id "<new-uuid>" \
  --system-prompt "$(cat ./agents/cooking/CLAUDE.md)"

# Subsequent calls (resume session)
claude -p "<task>" \
  --resume "<existing-uuid>" \
  --system-prompt "$(cat ./agents/cooking/CLAUDE.md)"
```

### 4. Session Tracking

Orchestrators track which session belongs to which agent:

```markdown
When delegating to an agent:
1. Check if you've already created a session for this agent
2. If yes → use `--resume` with that session ID
3. If no → generate new UUID, use `--session-id`, remember the mapping
```

---

## Orchestrator CLAUDE.md Structure

```markdown
# [Name] - Personal Orchestrator

## Identity

You are **[Name]**, [user]'s personal AI assistant and orchestrator. You manage a team
of specialized sub-agents, each with their own expertise. Your job is to understand
what [user] needs, route to the right agent(s), synthesize their outputs, and
maintain context across the system.

## Personality

[Brief personality description - warm but efficient, helpful without being sycophantic, etc.]

## Startup

On the first message of any session:
1. Load context files:
   - `shared/context/user-profile.md` — Who the user is
   - `shared/context/preferences.md` — How to respond
   - `reference/agent-registry.json` — Agent roster and routing info
2. Respond to whatever was asked

## Sub-Agents

| Name | Role | Key Skills |
|------|------|------------|
| **Agent A** | Role A | skill 1, skill 2 |
| **Agent B** | Role B | skill 3, skill 4 |

## Routing Logic

### Single-Agent Routing
When a request clearly maps to one agent, delegate to them:
- [signals for A] → Agent A
- [signals for B] → Agent B

### Multi-Agent Routing
When a request involves multiple domains:
1. Identify which agents are needed
2. Call each sequentially with appropriate context
3. Synthesize their outputs into a unified response

### No Routing Needed
Handle these yourself:
- General greetings and small talk
- Questions about how the system works
- Requests that don't fit any agent's specialty

## Agent Delegation

**All agents run as subprocesses.** Each agent:
- Receives their CLAUDE.md as system prompt
- Runs their own startup process
- Has access to their own MCP integrations (if configured)
- Runs as themselves — not you mimicking them

### Subprocess Command

**First delegation to an agent:**
\`\`\`bash
claude -p "<task prompt>" \
  --session-id "<new-uuid>" \
  --system-prompt "$(cat <agent-path>/CLAUDE.md)" \
  --mcp-config "<agent-path>/.mcp.json"  # if agent has MCP
\`\`\`

**Subsequent delegations to the same agent:**
\`\`\`bash
claude -p "<task prompt>" \
  --resume "<existing-uuid>" \
  --system-prompt "$(cat <agent-path>/CLAUDE.md)" \
  --mcp-config "<agent-path>/.mcp.json"  # if agent has MCP
\`\`\`

### Session Tracking
Track which session ID belongs to which agent within your conversation:
1. First call to an agent → Generate UUID, use --session-id, remember the mapping
2. Later calls to same agent → Use --resume with that UUID
3. Session scope → Tied to your conversation. New terminal = fresh sessions.

## Response Style

[Define how to respond - direct, structured, etc.]

## Example Interactions

### Simple Routing
\`\`\`
User: What's for dinner tonight?

Orchestrator: [Routes to Cooking Agent, responds directly]
Based on what's in your fridge, I'd suggest...
\`\`\`

### Multi-Agent
\`\`\`
User: I found a recipe and want to make it Wednesday night

Orchestrator: [Routes to Cooking Agent for recipe, then Calendar Agent for scheduling]
Got it — that's a 30-minute dish. I'll block 6:00-7:00 PM Wednesday for cooking.
\`\`\`
```

---

## Orchestrator agent.json

```json
{
  "name": "orchestrator-name",
  "displayName": "Orchestrator Name",
  "version": "1.0.0",
  "description": "Personal orchestrator that routes to specialized agents",
  "role": "Orchestrator",
  "personality": "Warm but efficient. Helpful without being sycophantic.",

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
    "name": "Your Name"
  },

  "dependencies": {
    "mcps": [],
    "agents": ["agent-a", "agent-b", "agent-c"],
    "knowledge": []
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

---

## Registry Management

### Creating the Registry

```json
{
  "version": "3.0",
  "orchestrator": "my-orchestrator",

  "agents": {
    "agent-name": {
      "location": { "type": "local", "path": "./agents/agent-name" },
      "context": "personal",
      "displayName": "Agent Name",
      "role": "Role",
      "description": "What it does",
      "signals": ["keyword1", "keyword2"],
      "skills": [...],
      "mcps": []
    }
  },

  "skillIndex": {
    "skill-id": "agent-name"
  },

  "routing": {
    "defaultAgent": null,
    "switchCommands": ["talk to", "switch to", "let me speak with"],
    "multiAgentTriggers": ["and also", "then", "after that"]
  }
}
```

### Adding New Agents

When adding a new agent to the registry:

1. Create the agent directory with CLAUDE.md and agent.json
2. Add entry to `agents` object with location, signals, skills
3. Add skill mappings to `skillIndex`
4. Update orchestrator's CLAUDE.md routing table

### External Agents

For agents from git repos:

```json
"external-agent": {
  "location": {
    "type": "git",
    "repo": "github.com/user/agent-repo",
    "localPath": "./agents/external/agent-name"
  },
  "context": "shared",
  ...
}
```

---

## Multi-Agent Synthesis

When a request requires multiple agents:

### Sequential Pattern

```
User: "Find a recipe and block time to cook it"

1. Route to Cooking Agent → Get recipe details (25 min cook time)
2. Route to Calendar Agent → Block 6:00-7:00 PM
3. Synthesize: "Got it — Thai Basil Chicken, 25 minutes. Blocked Wednesday 6-7 PM."
```

### Parallel Pattern

```
User: "What's on my calendar and what should I cook tonight?"

1. Route to Calendar Agent → Get today's events
2. Route to Cooking Agent → Get dinner suggestion
(These can run in parallel if supported)
3. Synthesize both results into one response
```

### Conditional Pattern

```
User: "Help me with this project"

1. Route to Strategy Agent → Get initial analysis
2. If analysis reveals technical work → Route to Developer Agent
3. Synthesize final response
```

---

## Error Handling

### Agent Errors

When an agent fails:

1. Check if error is recoverable
2. If recoverable and appropriate, retry once
3. If not recoverable, explain to user and suggest alternatives

### MCP Errors

When an agent's MCP isn't configured:

```markdown
I tried to check your calendar but the Google Calendar integration
isn't set up yet.

To enable it:
1. [Setup instructions]

Want me to help with something else, or set this up first?
```

### Missing Agents

When request doesn't match any agent:

```markdown
I don't have a specialized agent for that. Let me help you directly...
```

---

## Best Practices

### Do

- Run lean (no MCPs in orchestrator)
- Track session IDs for multi-turn agent conversations
- Briefly note which agent you're delegating to
- Synthesize multi-agent outputs into coherent responses
- Handle errors gracefully with alternatives

### Don't

- Try to do agents' work yourself
- Forget to pass system prompt on every subprocess call
- Lose session IDs between delegations
- Over-explain the delegation process to users
- Route everything — some things you handle directly
