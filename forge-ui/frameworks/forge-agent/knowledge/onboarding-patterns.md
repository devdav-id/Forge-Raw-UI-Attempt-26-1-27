# Onboarding External Projects

This document describes how Forge brings external agent projects up to standards.

## Philosophy

1. **Respect existing patterns** — Don't tear down what works
2. **Incremental adoption** — Start with one agent, validate, then expand
3. **Document deviations** — Some projects need variations; that's okay if documented
4. **Value immediately** — Each step should provide value, not just "prepare for later"

## Two Types of Onboarding

| Type | What | When |
|------|------|------|
| **Analyze & Apply** | Bring an existing project up to standards | Project already exists, needs standardization |
| **Extract & Publish** | Move an agent to its own repo for sharing | Agent should be portable/shareable |

---

## Onboarding Process

### Phase 1: Analysis

1. **Clone/copy the project to a working directory**
   ```bash
   cd ./projects
   git clone <repo-url>
   ```

2. **Map the territory**
   - How many agents exist?
   - What are their responsibilities?
   - How do they communicate?
   - What MCPs/integrations are used?
   - What's the folder structure?

3. **Identify the orchestrator**
   - Is there a central router/orchestrator?
   - Or is it peer-to-peer?
   - This affects coordination patterns

4. **Document current state**
   Create a brief assessment:
   ```markdown
   # [Project] Assessment

   ## Agents
   - Agent A: Does X
   - Agent B: Does Y

   ## Current Patterns
   - Communication: [ad-hoc | structured | none]
   - Observability: [none | basic logging | traces]
   - Error handling: [varies | consistent | none]

   ## Gaps
   - No agent cards
   - No task format
   - etc.
   ```

### Phase 2: Reference Implementation

Pick ONE agent to standardize first. Prefer:
- The orchestrator (if exists) — sets the pattern for routing
- The simplest agent — lowest risk, quickest validation
- The most-used agent — highest value if it works

For this agent:

1. **Create agent.json**
   - Follow `./schemas/agent.schema.json`
   - Define skills based on what it already does
   - Declare existing dependencies

2. **Update/create CLAUDE.md**
   - May already exist in some form
   - Ensure identity, capabilities, examples sections
   - Match capabilities to agent.json

3. **Add observability config**
   - Even without a trace backend
   - Sets up the instrumentation pattern

4. **Test it works**
   - Run the agent
   - Verify nothing broke
   - Check that new structure is usable

### Phase 3: Rollout

Once reference agent is validated:

1. **Create agent.json for remaining agents**
   - Use reference as template
   - Adjust capabilities, signals, dependencies

2. **Standardize task format** (if agents communicate)
   - May require code changes
   - Start with one integration path
   - Validate before expanding

3. **Add coordination rules** (if multi-agent)
   - Document existing coordination patterns
   - Express as IF-THEN rules
   - Add to agent.json

4. **Set up routing** (if orchestrator pattern)
   - Create/update agent registry
   - Add routing signals
   - Test routing works

### Phase 4: Documentation

1. **Update project README**
   - Note that it follows these standards
   - Link to standards docs if public
   - Document any project-specific variations

2. **Create project-specific notes**
   - Why certain decisions were made
   - What's different from baseline
   - Known limitations

---

## Common Patterns

### Project has no orchestrator

Create a lightweight one:
```markdown
# Orchestrator CLAUDE.md

You coordinate between [Agent A], [Agent B], and [Agent C].

Route based on these signals:
- [signals for A] → Agent A
- [signals for B] → Agent B
- [signals for C] → Agent C
```

### Project uses different MCP structure

Document in project's own `.mcp.json` or equivalent:
```json
{
  "note": "This project uses X instead of Y because...",
  "mcpServers": {...}
}
```

### Project has more complex task flow

Coordination may be overkill. Options:
1. Simple sequential delegation
2. Parallel fan-out with aggregation
3. Full task graphs (only if actually needed)

### Project has existing observability

Integrate, don't replace:
- Map existing spans to standard naming conventions
- Add missing attributes
- Document the mapping

---

## What NOT to Do

- **Don't force identical structure** — `agents/[name]/` is a pattern, not a requirement
- **Don't add unused standards** — If project doesn't do multi-agent, skip coordination rules
- **Don't break working code** — Standards should enhance, not disrupt
- **Don't merge into parent repo** — Projects stay in their own git history
- **Don't over-document** — Just enough to understand deviations

---

## Checklist

### Before starting
- [ ] Project available in working directory
- [ ] Initial analysis complete
- [ ] Reference agent identified

### Per agent
- [ ] agent.json created and valid
- [ ] CLAUDE.md updated/created
- [ ] Observability config present
- [ ] Tested and working

### Project-wide
- [ ] All agents have agent.json
- [ ] Task format standardized (if applicable)
- [ ] Coordination rules defined (if multi-agent)
- [ ] Agent registry created (if orchestrated)
- [ ] Documentation updated

### Completion
- [ ] Project-specific notes documented
- [ ] Deviations from standards explained
- [ ] Project team (if any) briefed on patterns

---

## Extracting an Agent to Its Own Repo

When an agent should become external/shareable:

### Phase 1: Prepare for Extraction

1. **Verify agent.json has required fields**
   - `context: "shared"` (or appropriate)
   - `invocation` block with relative paths
   - `provider` block
   - `skills` array

2. **Audit knowledge files**
   - Remove any personal data
   - Keep only generic domain knowledge
   - Personal preferences stay in original system

3. **Create README.md**
   - Installation instructions
   - Skill documentation
   - Requirements and setup

### Phase 2: Create Repository

1. **Create new repo**
   ```bash
   gh repo create agent-name --public
   # or --private
   ```

2. **Copy agent files**
   ```
   original-location/
   ├── agent.json     → repo root
   ├── CLAUDE.md      → repo root
   ├── knowledge/     → repo root
   └── README.md      → repo root (new)
   ```

3. **Initial commit**
   ```bash
   git add .
   git commit -m "Initial agent structure"
   git push origin main
   ```

### Phase 3: Update Consumer Registry

1. **Change location type in registry**
   ```json
   "agent-name": {
     "location": {
       "type": "git",
       "repo": "github.com/user/agent-name",
       "branch": "main",
       "localPath": "./agents/external/agent-name"
     },
     "context": "shared",
     ...
   }
   ```

2. **Remove from original location**
   - Delete original directory
   - The clone will go to `agents/external/`

### Phase 4: Verify

1. **Test fresh clone**
   ```bash
   rm -rf ./agents/external/agent-name
   # Trigger delegation — should clone automatically
   ```

2. **Verify subprocess works**
   - System prompt loads correctly
   - Knowledge files accessible
   - Agent responds as expected

### Extraction Checklist

- [ ] agent.json has context, skills, invocation, provider
- [ ] Knowledge files contain no personal data
- [ ] README.md with installation instructions
- [ ] New repo created and pushed
- [ ] Registry updated with git location
- [ ] Original agent directory removed
- [ ] Fresh clone tested
- [ ] Delegation works end-to-end
