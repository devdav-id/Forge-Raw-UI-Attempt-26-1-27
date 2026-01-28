# Observability Standards

This document defines OpenTelemetry conventions for agent systems.

## Philosophy

Instrument early, even without a backend. The patterns matter more than the infrastructure.

**Benefits:**
- Debug complex multi-agent workflows
- Understand where time is spent
- Track error patterns
- Correlate across agent boundaries

---

## Configuration

Each agent declares observability settings in `agent.json`:

```json
"observability": {
  "traceEnabled": true,
  "spanName": "agent-name.operation",
  "attributes": {
    "agent.name": "agent-name",
    "agent.role": "role_description"
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `traceEnabled` | Whether to emit traces (default: true) |
| `spanName` | Default span name pattern |
| `attributes` | Default attributes for all spans |

---

## Span Naming

### Convention

```
{agent}.{operation}
```

### Examples

| Agent | Operation | Span Name |
|-------|-----------|-----------|
| orchestrator | Routing | `orchestrator.route` |
| cooking-agent | Parse recipe | `cooking-agent.parse_recipe` |
| calendar-agent | Create event | `calendar-agent.create_event` |
| content-agent | Draft post | `content-agent.draft_post` |

### Orchestration Spans

For multi-agent workflows:

```
orchestrator.route
├── orchestrator.delegate
│   └── cooking-agent.parse_recipe
└── orchestrator.delegate
    └── calendar-agent.create_event
```

---

## Attributes

### Required Attributes

Every span MUST include:

```json
{
  "agent.name": "agent-name",
  "agent.role": "role_description"
}
```

### Task Attributes

When processing a task:

```json
{
  "task.id": "550e8400-...",
  "task.type": "parse_recipe",
  "task.priority": "normal"
}
```

### User Context

When user context is available:

```json
{
  "user.id": "user-identifier",
  "conversation.id": "..."
}
```

### Error Attributes

When an error occurs:

```json
{
  "error": true,
  "error.code": "MCP_NOT_CONNECTED",
  "error.message": "Required MCP is not connected",
  "error.recoverable": true
}
```

---

## Context Propagation

### Task Requests

Task requests carry trace context:

```json
{
  "observability": {
    "traceId": "0af7651916cd43dd8448eb211c80319c",
    "spanId": "b7ad6b7169203331",
    "baggage": {
      "user.id": "user-identifier"
    }
  }
}
```

### Processing Flow

When an agent receives a task:

1. Extract trace context from `observability` block
2. Create child span under that context
3. Add agent-specific attributes
4. Include context in any downstream requests
5. Complete span when task finishes

### Example Flow

```
User Request
└── orchestrator.route (traceId: abc, spanId: 001)
    └── orchestrator.delegate (spanId: 002, parentSpan: 001)
        └── cooking-agent.parse_recipe (spanId: 003, parentSpan: 002)
            └── cooking-agent.fetch_url (spanId: 004, parentSpan: 003)
```

---

## Events

### Span Events

Log significant events within a span:

```json
{
  "name": "mcp_connected",
  "timestamp": "2025-01-05T10:30:00Z",
  "attributes": {
    "mcp.name": "notion"
  }
}
```

### Common Events

| Event | When |
|-------|------|
| `mcp_connected` | MCP successfully connected |
| `mcp_failed` | MCP connection failed |
| `capability_invoked` | Agent capability called |
| `delegation_started` | Delegating to sub-agent |
| `delegation_completed` | Sub-agent returned |
| `knowledge_loaded` | Knowledge file loaded |

---

## Metrics

### Suggested Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `agent.tasks.total` | Counter | Total tasks processed |
| `agent.tasks.duration` | Histogram | Task duration in ms |
| `agent.tasks.errors` | Counter | Failed tasks |
| `agent.delegations` | Counter | Delegations to sub-agents |

### Labels

```
agent="cooking-agent"
task_type="parse_recipe"
status="completed"
```

---

## Implementation

### Without Backend

Even without shipping to Jaeger/Zipkin, you can:

1. Log spans to console in development
2. Track parent-child relationships manually
3. Use trace IDs for log correlation

### With Backend

When ready to ship traces:

1. Configure exporter (OTLP, Jaeger, etc.)
2. Set endpoint in environment
3. Enable sampling if needed

### Configuration

Environment variables:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_SERVICE_NAME=my-agent-system
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # 10% sampling
```

---

## Best Practices

### Do

- Create spans for every agent operation
- Include agent.name and task.id in all spans
- Propagate context through task requests
- Log errors with error.* attributes
- Use consistent span naming

### Don't

- Create spans for trivial operations
- Include sensitive data in attributes
- Skip context propagation (breaks traces)
- Use inconsistent naming patterns
- Forget to end spans (causes leaks)

---

## Debugging Tips

### Trace a Request

1. Find the trace ID in logs
2. Search for all spans with that trace ID
3. Order by timestamp to see flow
4. Look for gaps or errors

### Common Issues

| Symptom | Likely Cause |
|---------|--------------|
| Broken trace | Context not propagated |
| Missing spans | Span not created or ended |
| Wrong parent | Incorrect spanId in propagation |
| No attributes | Forgot to add at span creation |
