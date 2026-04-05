---
name: subagent-patterns
description: Load when writing an agent that spawns subagents, implementing multi-agent workflows, or when asked "how do I use the Task tool", "how do I spawn subagents in OpenCode", "how do I write an orchestrator agent".
---

# Subagent Patterns

## OpenCode Subagent Mechanics

Subagents are invoked via the **Task tool**. The calling agent (orchestrator) passes a description and prompt; the subagent runs independently and returns its result.

### Agent modes

| Mode        | Meaning                                                      |
|-------------|--------------------------------------------------------------|
| `primary`   | Default; full tools; the top-level agent in a session        |
| `subagent`  | Spawned by another agent via Task tool; scoped to its prompt |
| `all`       | Agent loads in both primary and subagent contexts            |

Configure in agent frontmatter:
```yaml
---
name: my-agent
mode: subagent   # or primary, or all
---
```

---

## Task Tool Parameters

```
description: one-sentence label shown in orchestrator's tool use trace
prompt:       full instructions for the subagent
```

Example invocation:
```
Task tool call:
  description: "Audit auth module for security issues"
  prompt: |
    You are a security reviewer.
    Goal: Identify security vulnerabilities in src/auth/.
    Focus on: input validation, token storage, password hashing.
    Output format: markdown list of findings with file:line references.
    Do not modify any files.
```

---

## Parallel Subagents

Launch multiple subagents in a **single message** (one tool call block) when they are independent:

```
[Single message with multiple Task tool calls]:
  Task 1: "Audit auth module"       → prompt for auth review
  Task 2: "Audit payments module"   → prompt for payments review
  Task 3: "Check dependency CVEs"   → prompt for dep audit
```

Results arrive separately; orchestrator synthesises after all complete.

**Rule**: If Task B needs Task A's output, they are sequential — do not parallelise.

---

## Sequential Subagents

When phase N's output is input to phase N+1:

```
Phase 1: Task tool → agent-explore  → returns: file list + architecture summary
Phase 2: Task tool → agent-implement (receives phase 1 output in prompt)
Phase 3: Task tool → agent-verify   (receives phase 2 output in prompt)
```

Pass output explicitly in the next agent's prompt — do not assume shared state.

---

## Context Passing Between Agents

Include in every subagent prompt:

1. **Role**: one sentence describing who this agent is.
2. **Goal**: one sentence describing the specific deliverable.
3. **Input**: structured output or file paths from previous phase.
4. **Output format**: exactly what to return (list, JSON, markdown, file path).
5. **Constraints**: what not to touch, what to assume.

```markdown
You are a test writer.
Goal: Write unit tests for the UserService class.
Input: src/services/user.service.ts (already reviewed; no changes needed).
Output: A new file src/services/user.service.spec.ts with ≥90% coverage.
Constraints: Do not modify user.service.ts. Use Jest. Mock the DB layer.
```

---

## Permission Inheritance

- Subagents inherit the permission set of the session unless explicitly restricted.
- To restrict a subagent: scope its prompt to read-only instructions ("do not modify files").
- Subagents cannot escalate permissions beyond what the primary agent has.

---

## Result Synthesis

After collecting subagent outputs, the orchestrator should:

1. Confirm all subagents returned a result (not an error).
2. Identify conflicts between results (e.g., two agents modified the same file).
3. Merge or resolve before proceeding.
4. Never advance to the next phase with partial results.

---

## Anti-Patterns

| Anti-pattern                                    | Consequence                                        |
|-------------------------------------------------|----------------------------------------------------|
| Spawning a subagent for a trivial single-file task | Overhead; slower than direct execution         |
| Prompt without explicit output format           | Subagent returns unstructured output; hard to use  |
| Parallelising dependent tasks                   | Race conditions; second agent uses stale input     |
| Not checking subagent results before proceeding | Phase N+1 built on incomplete or failed N output   |
| Huge prompts with no clear goal statement       | Subagent loses focus; returns unfocused output     |
| Subagent modifying files outside its scope      | Unexpected conflicts; breaks other subagents' work |
| Orchestrator re-implementing subagent logic     | Defeats purpose; adds duplication                  |
