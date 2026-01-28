# Subprocess Delegation Pattern

How orchestrators delegate to agents using subprocess invocation.

## Overview

To minimize token usage, orchestrators run lean (no MCPs). When routing to any agent, the orchestrator spawns a subprocess. The agent loads their own context, knowledge, and tools.

```
Orchestrator (lean, no MCPs)
  │
  └─► All agents: Subprocess delegation
```

## Core Principle

**All agents run as subprocesses.** Each agent:
- Receives their CLAUDE.md as system prompt
- Self-loads their own knowledge files
- Has access to their own MCP tools (if configured)
- Runs as themselves — not the orchestrator mimicking them

The orchestrator's job is routing and synthesis, not doing the agents' work.

## Subprocess Command Pattern

**With MCP tools** (if agent has `.mcp.json`):
```bash
claude -p "<task prompt>" \
  --mcp-config "<agent-path>/.mcp.json" \
  --system-prompt "$(cat <agent-path>/CLAUDE.md)"
```

**Without MCP tools** (if agent has no `.mcp.json`):
```bash
claude -p "<task prompt>" \
  --system-prompt "$(cat <agent-path>/CLAUDE.md)"
```

### Parameters

- `-p`: Print mode - returns result and exits
- `--mcp-config`: Path to agent's MCP config file (only if agent has one)
- `--system-prompt`: Agent's CLAUDE.md content

### Agent Startup

Each agent defines their own startup process in their CLAUDE.md — what knowledge, resources, or templates they need to load. The orchestrator doesn't prescribe this; the agent knows what they need for their role.

## Delegation Flow

### 1. Route Detection
Orchestrator identifies which agent should handle the request.

### 2. Subprocess Execution
Orchestrator spawns the agent with their system prompt (and MCP config if they have one):

```bash
# Agent with MCP
claude -p "Draft a post about AI implementation failures. Keep it punchy, 150 words max." \
  --mcp-config "./agents/content-agent/.mcp.json" \
  --system-prompt "$(cat ./agents/content-agent/CLAUDE.md)"

# Agent without MCP
claude -p "What's the best approach for this decision?" \
  --system-prompt "$(cat ./agents/strategy-agent/CLAUDE.md)"
```

The agent runs their startup process (loading knowledge/resources per their CLAUDE.md), then handles the task.

### 3. Response Integration
Orchestrator receives the subprocess output and presents it to the user, noting which agent contributed.

## Session Persistence

When an orchestrator delegates to an agent multiple times within the same conversation, the agent retains context from earlier exchanges. This enables coherent multi-turn interactions without re-explaining everything.

### How It Works

1. **Claude CLI handles storage** — Conversation transcripts are saved to disk automatically by the CLI
2. **Orchestrator tracks session IDs** — Remembers which UUID belongs to which agent
3. **Subprocesses are stateless** — Each call starts a fresh process, but `--resume` loads previous history

```
Orchestrator's Conversation
│
├─► First call to Strategy Agent
│   claude -p "..." --session-id "abc-123" ...
│   [Claude saves transcript to disk]
│   [Orchestrator remembers: strategy-agent = abc-123]
│
├─► Later call to Strategy Agent
│   claude -p "..." --resume "abc-123" ...
│   [Claude loads previous transcript]
│   [Strategy Agent has full context of earlier exchange]
│
└─► Call to Content Agent (different agent)
    claude -p "..." --session-id "def-456" ...
    [Separate session]
```

### Session Scope

- **Boundary**: Orchestrator's conversation session
- **Within session**: Agent sessions persist across multiple delegations
- **New orchestrator session**: All agent sessions start fresh

This means if you close the terminal and start a new conversation, all agents start with clean slates. But within a single session, agents remember prior context.

### Command Patterns

**First delegation to an agent:**
```bash
# Generate a new UUID for this agent
claude -p "<task>" \
  --session-id "<new-uuid>" \
  --system-prompt "$(cat <agent-path>/CLAUDE.md)" \
  --mcp-config "<agent-path>/.mcp.json"  # if agent has MCP
```

**Subsequent delegations to the same agent:**
```bash
# Reuse the existing session ID
claude -p "<task>" \
  --resume "<existing-uuid>" \
  --system-prompt "$(cat <agent-path>/CLAUDE.md)" \
  --mcp-config "<agent-path>/.mcp.json"  # if agent has MCP
```

**Important**: System prompt and MCP config must be passed on every call — only conversation history persists via the session ID.

### Orchestrator's Session Tracking

The orchestrator tracks active sessions in conversation context. When delegating:

1. Check if a session already exists for this agent (look in conversation history)
2. If yes → use `--resume` with that session ID
3. If no → generate new UUID, use `--session-id`, remember the mapping

No external state file needed — conversation history is the source of truth.

## Example: Routing to Content Agent

**User request:**
> Help me write a LinkedIn post about why most AI projects fail

**Orchestrator's subprocess call:**
```bash
claude -p "Draft a LinkedIn post about why most AI projects fail. Offer 2-3 angle options." \
  --mcp-config "./agents/content-agent/.mcp.json" \
  --system-prompt "$(cat ./agents/content-agent/CLAUDE.md)"
```

**Orchestrator's response to user:**
> Pulling in the content agent for this —
>
> [Agent's draft options]

## Example: Routing to Calendar Agent

**User request:**
> What's on my calendar tomorrow?

**Orchestrator's subprocess call:**
```bash
claude -p "Show the calendar for tomorrow. Include event times, durations, and note any significant gaps." \
  --mcp-config "./agents/calendar-agent/.mcp.json" \
  --system-prompt "$(cat ./agents/calendar-agent/CLAUDE.md)"
```

## Handling Missing MCPs

If a subprocess fails because an MCP isn't configured (e.g., missing token):

1. Orchestrator catches the error
2. Explains what's missing
3. Provides setup instructions
4. Offers alternatives if available

```
Orchestrator: I tried to access your Notion but the integration
isn't set up yet.

To enable it:
1. Get your token from notion.so/my-integrations
2. Set NOTION_TOKEN in your environment
3. The next call will pick it up automatically

Want me to draft without that source, or set this up first?
```

## Performance Considerations

### Token Savings
- Orchestrator's main session: minimal tokens (no MCP schemas loaded)
- Subprocess: Only loads needed MCPs for that specific task
- Most conversations that don't need MCPs = significant savings

### Trade-offs
- Each subprocess is a new API call
- Slightly more latency for MCP-dependent requests
- Session persistence requires tracking UUIDs (handled in conversation context)

### When Orchestrator Handles Directly (No Subprocess)
- General greetings and small talk
- Questions about how the system works
- Meta-questions about agents or capabilities
- Requests that don't fit any agent's specialty

## File Structure

```
agents/<agent>/
├── CLAUDE.md              # Agent instructions (includes startup process)
├── .mcp.json              # MCP config (if agent has integrations)
├── agent.json             # Agent card (capabilities, dependencies)
├── knowledge/             # Agent-specific knowledge files
└── ...                    # Other resources the agent needs
```

## Configuration

### Running Orchestrator Lean

Start Claude Code without any MCPs:
```bash
claude --strict-mcp-config
```

Or create an empty root `.mcp.json`:
```json
{
  "mcpServers": {}
}
```

### Agent MCP Configs

Agents with integrations have their own `.mcp.json`. Check each agent's folder to see if they have one.
