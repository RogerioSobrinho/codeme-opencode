---
name: continuous-learning
description: Load when capturing a new architectural decision, documenting a discovered pattern after solving a complex problem, applying the three-time-rule, or at the end of a session to preserve reusable solutions.
---

# Continuous Learning

## The Instinct System

An **instinct** is a heuristic derived from repeated evidence. It has a confidence score and must earn promotion before influencing decisions.

### Instinct Template

```markdown
## Instinct: [short name]

**Statement**: [One sentence: "When X, always/never Y"]
**Confidence**: [1–5]
**Evidence**:
  - Context 1: [project/date/outcome]
  - Context 2: [project/date/outcome]
  - Context 3: [project/date/outcome]
**Promotion threshold**: ≥4 confidence in ≥3 distinct contexts
**Decay rule**: If counter-evidence appears in 2+ contexts, reduce confidence by 1.
```

### Confidence Scale

| Score | Meaning                                         |
|-------|-------------------------------------------------|
| 1     | Single observation; do not act on it alone      |
| 2     | Seen twice; plausible but unconfirmed           |
| 3     | Consistent pattern; apply with caution          |
| 4     | Strong evidence; apply by default               |
| 5     | Invariant; apply always unless explicitly overridden |

---

## Three-Time Rule

> If you solve the same class of problem for the third time, promote the solution to a **pattern**.

1st time: solve it ad-hoc.
2nd time: note the recurrence.
3rd time: write the pattern, add to skills or AGENTS.md.

---

## Pattern Template

```markdown
## Pattern: [Name]

**Problem**: [What situation triggers this pattern]
**Solution**: [What to do — concrete steps or code]
**When to use**: [Conditions that make this pattern appropriate]
**When NOT to use**: [Conditions that make this pattern wrong]
**Example**:
```[language]
// concrete code example
```
**First seen**: [project/date]
**Confirmed in**: [project/date], [project/date]
```

---

## Anti-Pattern Template

```markdown
## Anti-Pattern: [Name]

**What it looks like**: [code or description]
**Why it fails**: [concrete consequence]
**What to do instead**: [pattern name or description]
**First seen**: [project/date]
```

---

## End-of-Session Review Protocol

At the end of each significant session, answer these 4 questions:

1. **What did I solve that I've solved before?** → candidate for pattern promotion.
2. **What assumption turned out to be wrong?** → add to constraints / anti-patterns.
3. **What would have saved me 30+ minutes?** → document as a gotcha in AGENTS.md.
4. **What decision should never be revisited?** → write an ADR.

---

## ADR Template (Architecture Decision Record)

```markdown
## ADR-[NNN]: [Title]

**Date**: [YYYY-MM-DD]
**Status**: Accepted | Superseded by ADR-NNN | Deprecated

### Context
[What situation forced this decision]

### Decision
[What was decided — one clear statement]

### Rationale
[Why this option over alternatives]

### Consequences
**Positive**: [benefits]
**Negative**: [trade-offs accepted]

### Alternatives Considered
- [Option A]: rejected because [reason]
- [Option B]: rejected because [reason]
```

---

## Skill Evolution Process

| Action       | When to apply                                       | How                                           |
|--------------|-----------------------------------------------------|-----------------------------------------------|
| **Update**   | Pattern has new evidence or better examples         | Edit the SKILL.md; add to Evidence list       |
| **Deprecate**| Pattern is superseded by a better approach          | Add `Supersedes: [old skill]` to new SKILL.md; mark old skill with `Status: Deprecated` |
| **Delete**   | Pattern is actively harmful and no longer relevant  | Remove file; document removal in AGENTS.md    |

**Never silently overwrite** a pattern — version changes must be traceable.
