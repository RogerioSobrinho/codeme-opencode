---
name: strategic-compact
description: Load when the session is running long (context approaching 50%), when the conversation is cycling through the same problems, before switching to a new major task, or when asked to "summarize where we are", "compact the context", "save our progress".
---

# Strategic Compact

## When to Compact

| Signal                                           | Action              |
|--------------------------------------------------|---------------------|
| Context usage > 50%                              | Compact now         |
| Conversation cycling through the same problem   | Compact + reframe   |
| Switching to a new major task or workstream      | Compact before switch|
| Session > 1 hour of continuous work             | Compact checkpoint  |
| Output quality degrading (repetition, hedging)  | Compact immediately |

---

## What to Preserve vs. Discard

| Preserve                                           | Discard                                      |
|----------------------------------------------------|----------------------------------------------|
| Decisions made and their rationale                 | Step-by-step reasoning that led to decisions |
| Files created or significantly modified            | Exploratory reads that produced no findings  |
| Open questions blocking progress                   | Resolved questions and their full discussion |
| Constraints discovered (framework limits, bugs)    | Background context that was not acted on     |
| Errors seen and the exact fix applied              | Failed attempts that were abandoned          |
| Current task state and next concrete step          | Chat pleasantries, confirmations             |

---

## Compact Template

Use this exact structure when producing a compact:

```markdown
## Session Compact — [date / task name]

### Decisions Made
- [Decision]: [one-sentence rationale]
- ...

### Files Created / Modified
- `path/to/file.ts` — [what changed and why]
- ...

### Open Questions
- [Question] — [who needs to answer / what is blocking]
- ...

### Current Task
[One paragraph: what we are building, where we are in the process]

### Next Step
[Exactly one concrete action to take when resuming]

### Constraints Discovered
- [Constraint]: [source / evidence]
- ...

### Errors Seen + Fixes
- [Error message or symptom] → [exact fix applied]
- ...
```

---

## How to Resume from a Compact

1. Paste the compact into a new session as the first message.
2. Add: "Resume from this compact. The next step is: [Next Step from compact]."
3. Do not re-explore areas already documented in the compact.
4. Update the compact after each major phase completes.

---

## Multi-Phase Feature Compact

For large features spanning multiple sessions, maintain a rolling compact:

```markdown
## Feature: [Name] — Rolling Compact

### Phase 1: [Name] — COMPLETE
[Summary of what was built and key decisions]

### Phase 2: [Name] — IN PROGRESS
[Current state, open questions, next step]

### Phase 3: [Name] — PLANNED
[Known requirements, dependencies on Phase 2]
```

---

## Anti-Patterns

| Anti-pattern                         | Problem                                               |
|--------------------------------------|-------------------------------------------------------|
| Preserving full code diffs           | Wastes context; use file paths + descriptions instead |
| Preserving exploratory reasoning     | Fills context with non-actionable content             |
| Omitting errors and fixes            | Next session repeats the same mistakes                |
| No "Next Step" in compact            | Session restart requires full re-orientation          |
| Compacting too late (>80% context)   | Quality already degraded before compact runs          |
| Single compact for 3+ unrelated tasks| Conflates context; split by task                      |
