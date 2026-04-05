---
name: multiagent-orchestration
description: Load when decomposing a complex task for multiple agents, when asked "orchestrate this", "run multiple agents", "parallelize this work", or when using the orchestrator agent.
---

# Multi-Agent Orchestration

## When to Use Subagents vs. Sequential Execution

| Scenario                                              | Pattern              |
|-------------------------------------------------------|----------------------|
| Independent subtasks with no shared output            | Parallel subagents   |
| Task B depends on Task A's output                     | Sequential           |
| Single coherent task with no natural split point      | No subagents needed  |
| Subtask requires a different tool set or permission   | Subagent with scope  |
| Synthesis / decision requires full context            | Orchestrator only    |

---

## Orchestration Plan Format

Before spawning agents, write an explicit plan:

```yaml
orchestration:
  goal: "Migrate auth module to JWT RS256"
  phases:
    - phase: 1
      mode: parallel
      agents:
        - id: agent-test-audit
          task: "Read existing auth tests and list coverage gaps"
        - id: agent-dep-check
          task: "Check installed JWT libraries and their versions"

    - phase: 2
      mode: sequential
      depends_on: [agent-test-audit, agent-dep-check]
      agents:
        - id: agent-impl
          task: "Implement RS256 token signing using findings from phase 1"

    - phase: 3
      mode: sequential
      depends_on: [agent-impl]
      agents:
        - id: agent-verify
          task: "Run full verification loop and report gate results"
```

---

## Parallel Phase Rules

- All agents in a parallel phase must be launched in the **same message** (single tool call block).
- Each agent receives its own scoped prompt — do not share mutable state.
- Merge outputs only after all agents in the phase complete.

---

## Agent Selection Guide

| Task type                          | Agent to use                        |
|------------------------------------|-------------------------------------|
| Read and analyse codebase          | Subagent with read-only tools       |
| Write / edit files                 | Subagent with file write tools      |
| Run tests / shell commands         | Subagent with bash tool             |
| Security audit                     | Subagent with security-review skill |
| Synthesise results, make decisions | Orchestrator (primary agent)        |

---

## Context Passing Between Agents

Include in each subagent prompt:

1. The **specific goal** of that agent (one sentence).
2. **Input artifacts**: file paths, function names, or structured output from prior phase.
3. **Output format**: what the orchestrator expects back (list, JSON, file path, summary).
4. **Constraints**: files to not touch, assumptions to hold.

```
Prompt template:
"You are working on [goal].
Input: [artifact or finding from phase N].
Output: [expected format].
Constraints: [do not modify X, assume Y is correct].
"
```

---

## Synthesis Pattern

After parallel agents complete, the orchestrator:

1. Collects all agent outputs.
2. Identifies conflicts (same file edited differently, contradictory findings).
3. Resolves conflicts using explicit priority rules (see below).
4. Produces a unified result.

---

## Conflict Resolution

| Conflict type                        | Resolution rule                                      |
|--------------------------------------|------------------------------------------------------|
| Two agents edited the same file      | Re-run the second agent with the first agent's output as input |
| Contradictory findings               | Orchestrator investigates directly before proceeding |
| One agent failed, others succeeded   | Stop the phase; do not merge partial results         |

---

## Anti-Patterns

| Anti-pattern                                   | Consequence                                    |
|------------------------------------------------|------------------------------------------------|
| Spawning agents without a dependency map       | Race conditions, conflicting edits             |
| Giving agents overlapping file scope           | Merge conflicts, inconsistent state            |
| Not collecting all agent outputs before merging| Synthesising incomplete information            |
| Using subagents for trivial single-file tasks  | Overhead without benefit                       |
| Orchestrator making implementation decisions   | Bypasses subagent findings; defeats the purpose|
