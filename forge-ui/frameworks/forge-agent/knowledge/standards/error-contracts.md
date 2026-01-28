# Error Contracts

This document defines error handling patterns for agent systems.

## Philosophy

Errors should be:
- **Structured**: Machine-readable for programmatic handling
- **Informative**: Human-readable for debugging
- **Actionable**: Clear on what went wrong and how to fix it
- **Recoverable**: Indicate whether retry is possible

---

## Error Structure

All errors follow this format:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable explanation",
  "details": {
    "key": "Additional context"
  },
  "recoverable": true
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Machine-readable error code |
| `message` | string | Yes | Human-readable explanation |
| `details` | object | No | Additional context |
| `recoverable` | boolean | Yes | Can the operation be retried? |

---

## Standard Error Codes

### Input Errors

| Code | Message | Recoverable |
|------|---------|-------------|
| `INVALID_INPUT` | Request payload doesn't match expected schema | Yes |
| `MISSING_REQUIRED_FIELD` | Required field is missing | Yes |
| `INVALID_FIELD_TYPE` | Field has wrong type | Yes |
| `INVALID_FIELD_VALUE` | Field value is not allowed | Yes |

### Agent Errors

| Code | Message | Recoverable |
|------|---------|-------------|
| `AGENT_NOT_FOUND` | Target agent doesn't exist | No |
| `CAPABILITY_NOT_FOUND` | Agent doesn't have requested capability | No |
| `AGENT_UNAVAILABLE` | Agent is not responding | Maybe |
| `AGENT_BUSY` | Agent is processing another request | Yes |

### MCP Errors

| Code | Message | Recoverable |
|------|---------|-------------|
| `MCP_NOT_CONNECTED` | Required MCP is not connected | Yes (run setup) |
| `MCP_AUTH_FAILED` | MCP authentication failed | Yes (re-auth) |
| `MCP_RATE_LIMITED` | MCP rate limit exceeded | Yes (wait) |
| `MCP_ERROR` | MCP returned an error | Maybe |

### Coordination Errors

| Code | Message | Recoverable |
|------|---------|-------------|
| `COORDINATION_FAILED` | Multi-agent workflow failed | Maybe |
| `TASK_GRAPH_CYCLE` | Circular dependency detected | No |
| `DELEGATION_FAILED` | Could not delegate to sub-agent | Maybe |
| `TIMEOUT` | Operation timed out | Yes |

### System Errors

| Code | Message | Recoverable |
|------|---------|-------------|
| `INTERNAL_ERROR` | Unexpected internal error | Maybe |
| `KNOWLEDGE_NOT_FOUND` | Required knowledge file missing | No |
| `RATE_LIMITED` | Too many requests | Yes (wait) |

---

## Task Response with Error

When a task fails, include the error in the response:

```json
{
  "id": "task-uuid",
  "status": "failed",
  "error": {
    "code": "MCP_NOT_CONNECTED",
    "message": "The Notion MCP is not connected. Run setup to configure.",
    "details": {
      "mcp": "notion",
      "requiredBy": "content-agent",
      "capability": "draft_post"
    },
    "recoverable": true
  },
  "metadata": {
    "startedAt": "2025-01-05T10:30:00Z",
    "completedAt": "2025-01-05T10:30:01Z",
    "duration_ms": 1000,
    "agent": "content-agent"
  }
}
```

---

## Error Handling Patterns

### At Agent Level

```
1. Attempt operation
2. If error:
   a. Wrap in standard error structure
   b. Add context to details
   c. Determine recoverability
   d. Return error in task response
```

### At Orchestrator Level

```
1. Receive error from sub-agent
2. Check recoverable flag
3. If recoverable and retries remaining:
   a. Wait (exponential backoff)
   b. Retry
4. If not recoverable or retries exhausted:
   a. Surface error to user
   b. Clean up partial state
```

### User-Facing

Transform technical errors into actionable messages:

| Code | User Message |
|------|--------------|
| `MCP_NOT_CONNECTED` | "I can't access [X] right now. Check the connection setup." |
| `AGENT_NOT_FOUND` | "I don't have an agent for that. Try asking a different way?" |
| `TIMEOUT` | "That's taking longer than expected. Want me to try again?" |

---

## Retry Policy

### Defaults

| Error Category | Retry | Max Attempts | Backoff |
|----------------|-------|--------------|---------|
| Input Errors | No | - | - |
| MCP Errors | Yes | 3 | Exponential |
| Coordination Errors | Maybe | 2 | Linear |
| System Errors | Yes | 3 | Exponential |

### Exponential Backoff

```
attempt 1: 1 second
attempt 2: 2 seconds
attempt 3: 4 seconds
```

### Configuration

Retry behavior can be customized per-task:

```json
{
  "id": "task-uuid",
  "type": "create_event",
  "payload": {...},
  "retryPolicy": {
    "maxAttempts": 5,
    "backoffType": "exponential",
    "initialDelay": 500
  }
}
```

---

## Fallback Behaviors

When an MCP isn't available, agents can define fallbacks:

### Graceful Degradation

```markdown
**Cooking Agent without Pinterest parser:**
- Ask user to paste recipe text directly
- Proceed with manual input

**Calendar Agent without Google Calendar:**
- Report availability check not possible
- Offer to create a reminder instead
```

### Declare in CLAUDE.md

```markdown
## Fallback Behaviors

If Google Calendar MCP is not connected:
1. Inform user that calendar access isn't available
2. Offer to help draft the event details for manual creation
3. Suggest checking connection status
```

---

## Observability

### Error Attributes

Add to spans when errors occur:

```json
{
  "error": true,
  "error.code": "MCP_NOT_CONNECTED",
  "error.message": "Required MCP is not connected",
  "error.recoverable": true
}
```

### Logging

Log errors with structure:

```json
{
  "level": "error",
  "timestamp": "2025-01-05T10:30:00Z",
  "agent": "content-agent",
  "taskId": "uuid",
  "error": {
    "code": "MCP_NOT_CONNECTED",
    "message": "..."
  }
}
```

---

## Best Practices

### Do

- Use standard error codes
- Include actionable details
- Set recoverable accurately
- Log all errors with context
- Provide user-friendly messages

### Don't

- Invent new codes for standard situations
- Swallow errors silently
- Retry non-recoverable errors
- Expose internal details to users
- Skip error attributes in traces
