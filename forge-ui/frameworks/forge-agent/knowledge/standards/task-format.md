# Task Format

This document defines the standardized task request/response format for inter-agent communication.

## Overview

Inter-agent communication uses a standardized task format that enables:
- **Tracing**: Full observability across agent boundaries
- **Error handling**: Consistent error structure
- **Coordination**: Multi-agent workflow support
- **Artifacts**: Structured outputs

---

## Task Request

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "parse_recipe",
  "payload": {
    "url": "https://example.com/recipe"
  },
  "context": {
    "conversationId": "...",
    "parentTaskId": "...",
    "user": "user-id",
    "timestamp": "2025-01-05T10:30:00Z",
    "priority": "normal"
  },
  "routing": {
    "source": "orchestrator",
    "target": "cooking-agent",
    "delegationChain": ["orchestrator"]
  },
  "observability": {
    "traceId": "...",
    "spanId": "..."
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique task identifier (UUID recommended) |
| `type` | string | Task type matching agent capability name |
| `payload` | object | Task-specific input data |

### Context Block

| Field | Type | Description |
|-------|------|-------------|
| `conversationId` | string | ID linking related tasks in a conversation |
| `parentTaskId` | string | ID of parent task if this is a subtask |
| `user` | string | User identifier |
| `timestamp` | string | ISO-8601 timestamp |
| `priority` | string | `low`, `normal`, `high`, `urgent` |

### Routing Block

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Agent that initiated this task |
| `target` | string | Agent this task is assigned to |
| `delegationChain` | array | Chain of agents that have handled this task |

### Observability Block

| Field | Type | Description |
|-------|------|-------------|
| `traceId` | string | OpenTelemetry trace ID |
| `spanId` | string | OpenTelemetry span ID |
| `baggage` | object | Additional trace context |

---

## Task Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "result": {
    "title": "Thai Basil Chicken",
    "ingredients": [...],
    "instructions": [...]
  },
  "metadata": {
    "startedAt": "2025-01-05T10:30:00Z",
    "completedAt": "2025-01-05T10:30:02Z",
    "duration_ms": 2000,
    "agent": "cooking-agent"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Task ID this response is for |
| `status` | string | Current task status |

### Status Values

| Status | Meaning |
|--------|---------|
| `pending` | Task received, not started |
| `in_progress` | Task being processed |
| `completed` | Task finished successfully |
| `failed` | Task encountered error |
| `cancelled` | Task was cancelled |
| `input_required` | Task needs user input to proceed |

### Result Block

Present when `status` is `completed`. Contains task-specific output data matching the capability's output schema.

### Error Block

Present when `status` is `failed`:

```json
{
  "error": {
    "code": "MCP_NOT_CONNECTED",
    "message": "The Notion MCP is not connected",
    "details": {
      "mcp": "notion",
      "requiredBy": "content-agent"
    },
    "recoverable": true
  }
}
```

See `error-contracts.md` for standard error codes.

### Metadata Block

| Field | Type | Description |
|-------|------|-------------|
| `startedAt` | string | ISO-8601 timestamp when processing began |
| `completedAt` | string | ISO-8601 timestamp when processing finished |
| `duration_ms` | integer | Task duration in milliseconds |
| `agent` | string | Agent that processed this task |
| `retryCount` | integer | Number of retry attempts |

### Artifacts Block

For tasks that produce files or structured outputs:

```json
{
  "artifacts": [
    {
      "name": "draft.md",
      "type": "text/markdown",
      "content": "# Draft\n\nContent here..."
    },
    {
      "name": "data.json",
      "type": "application/json",
      "content": "{\"key\": \"value\"}"
    }
  ]
}
```

---

## Full Schema

See `schemas/task.schema.json` for the complete JSON Schema specification.

---

## Usage Patterns

### Simple Request/Response

```
Orchestrator                    Agent
    |                              |
    |------ Task Request --------->|
    |                              |
    |<----- Task Response ---------|
    |                              |
```

### Async/Polling Pattern

```
Orchestrator                    Agent
    |                              |
    |------ Task Request --------->|
    |<-- Response (pending) -------|
    |                              |
    |------ Status Check --------->|
    |<-- Response (in_progress) ---|
    |                              |
    |------ Status Check --------->|
    |<-- Response (completed) -----|
    |                              |
```

### Input Required Pattern

```
Orchestrator                    Agent
    |                              |
    |------ Task Request --------->|
    |<-- Response (input_required)-|
    |                              |
    |-- Task Update (with input)-->|
    |<-- Response (completed) -----|
    |                              |
```

---

## Best Practices

### Do

- Always include a unique task ID
- Propagate observability context through the chain
- Include meaningful metadata for debugging
- Use standard error codes when failing

### Don't

- Reuse task IDs across different requests
- Drop observability context during delegation
- Return results without setting status to `completed`
- Forget to include error details when failing
