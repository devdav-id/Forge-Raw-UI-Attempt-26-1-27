# Multi-Agent Coordination

This document defines patterns for coordinating work across multiple agents, inspired by XAgents.

## Philosophy

Multi-agent coordination should be:
- **Explicit**: Rules declared in agent.json, not hidden logic
- **Minimal**: Don't add coordination complexity until needed
- **Traceable**: Every delegation logged and observable

---

## Configuration

Each agent declares coordination settings in `agent.json`:

```json
"coordination": {
  "canDelegate": true,
  "acceptsSubtasks": true,
  "rules": [
    {
      "condition": "...",
      "action": "...",
      "scope": "domain | global"
    }
  ]
}
```

### Fields

| Field | Description |
|-------|-------------|
| `canDelegate` | Whether this agent can delegate to other agents |
| `acceptsSubtasks` | Whether this agent can receive delegated work |
| `rules` | IF-THEN rules for coordination |

---

## IF-THEN Rules

Rules define agent behavior in specific conditions.

### Structure

```json
{
  "condition": "When this is true",
  "action": "Do this",
  "scope": "domain | global"
}
```

### Scope

**domain**: Rules that apply within this agent's operation
```json
{
  "condition": "User asks about dietary restrictions",
  "action": "Check preferences file before responding",
  "scope": "domain"
}
```

**global**: Rules that affect multi-agent coordination
```json
{
  "condition": "Recipe requires calendar blocking",
  "action": "Signal orchestrator to involve calendar agent",
  "scope": "global"
}
```

### Example Rules by Agent Type

**Cooking Agent:**
```json
{
  "condition": "Recipe requires calendar blocking",
  "action": "Signal orchestrator to involve calendar agent for scheduling",
  "scope": "global"
}
```

**Calendar Agent:**
```json
{
  "condition": "Research request is cooking-related",
  "action": "Signal that cooking agent may be better suited",
  "scope": "global"
}
```

**Strategy Agent:**
```json
{
  "condition": "User repeats same avoidance pattern 3+ times",
  "action": "Increase directness, reduce empathy, name pattern explicitly",
  "scope": "domain"
}
```

**Content Agent:**
```json
{
  "condition": "User provides feedback on style",
  "action": "Incorporate feedback and offer to update knowledge files",
  "scope": "domain"
}
```

---

## Task Graphs

For complex multi-agent operations, the orchestrator builds a task graph.

### When to Use

- Request involves 2+ agents
- Tasks have dependencies on each other
- Parallel execution is possible

### Structure

```json
{
  "graphId": "uuid",
  "conversationId": "uuid",
  "nodes": [
    {
      "taskId": "t1",
      "agent": "cooking-agent",
      "capability": "parse_recipe",
      "dependencies": [],
      "status": "completed"
    },
    {
      "taskId": "t2",
      "agent": "calendar-agent",
      "capability": "create_event",
      "dependencies": ["t1"],
      "status": "pending"
    }
  ],
  "edges": [
    { "from": "t1", "to": "t2" }
  ]
}
```

### Execution

1. Parse request into subtasks
2. Build dependency graph
3. Execute tasks with no pending dependencies
4. As tasks complete, execute newly-unblocked tasks
5. Aggregate results when all complete

### Parallelization

Tasks without dependencies can run in parallel:

```
       ┌─── task_a ───┐
start ─┤              ├─── task_c ─── end
       └─── task_b ───┘
```

task_a and task_b run in parallel; task_c waits for both.

---

## State Management

### Location

Runtime coordination state lives in a `state/` directory:

```
state/
├── active-graphs/          # Currently executing task graphs
│   └── {graphId}.json
├── pending-tasks/          # Tasks waiting for execution
│   └── {taskId}.json
└── signals/                # Inter-agent signals
    └── {signalId}.json
```

### Lifecycle

1. **Created**: When multi-agent request starts
2. **Updated**: As tasks execute and complete
3. **Cleared**: When request completes or fails

### Note

This folder should be gitignored — it's runtime state, not configuration.

---

## Signals

Agents can signal to each other without full task delegation.

### Use Cases

- "This request might be better for another agent"
- "I've completed my part, hand off to X"
- "I'm blocked, need human input"

### Signal Structure

```json
{
  "signalId": "uuid",
  "from": "cooking-agent",
  "to": "orchestrator",
  "type": "handoff_suggestion",
  "payload": {
    "suggestedAgent": "calendar-agent",
    "reason": "Recipe parsed, now needs calendar blocking"
  },
  "timestamp": "2025-01-05T10:30:00Z"
}
```

### Signal Types

| Type | Meaning |
|------|---------|
| `handoff_suggestion` | Suggest another agent |
| `task_complete` | Subtask finished |
| `blocked` | Waiting for something |
| `error` | Something went wrong |
| `escalate` | Need orchestrator attention |

---

## Orchestrator Patterns

### Sequential Delegation

One agent, then another:

```
User → Orchestrator → Agent A → (result) → Orchestrator → Agent B → (result) → User
```

### Parallel Delegation

Multiple agents simultaneously:

```
        ┌→ Agent A →┐
User → Orchestrator       Orchestrator → User
        └→ Agent B →┘
```

### Conditional Delegation

Based on first agent's result:

```
User → Orchestrator → Agent A → (result)
                            └→ If condition: Orchestrator → Agent B
```

---

## Best Practices

### Do

- Declare coordination rules explicitly in agent.json
- Use domain scope for within-agent logic
- Use global scope for cross-agent behavior
- Keep task graphs simple (minimize dependencies)
- Clean up state when requests complete

### Don't

- Hide coordination logic in CLAUDE.md
- Create circular dependencies in task graphs
- Over-use signals for simple handoffs
- Leave state files lingering
- Make every request a multi-agent operation

---

## Debugging

### Task Graph Issues

1. Check `state/active-graphs/` for stuck graphs
2. Look for tasks with "pending" status and completed dependencies
3. Verify agent is available and MCP connected

### Signal Issues

1. Check `state/signals/` for unprocessed signals
2. Verify target agent can receive the signal type
3. Look for timing issues in traces

### Common Problems

| Symptom | Likely Cause |
|---------|--------------|
| Task stuck pending | Dependency not completing |
| Circular delegation | Agents bouncing task back and forth |
| Missing result | Task graph not aggregating |
| Double execution | Task ID collision |
