---
name: autonomous-loops
description: Load when running multi-step tasks autonomously, orchestrating independent subtasks in parallel, or when asked "how do I run multiple agents in parallel", "how do I run this without approving every step".
---

# Autonomous Loops

## When to Run Autonomously vs. Stop for Confirmation

| Situation                                           | Action                          |
|-----------------------------------------------------|---------------------------------|
| All steps are reversible (add/edit code, run tests) | Proceed autonomously            |
| Destructive operation (drop table, delete files)    | Stop and confirm                |
| Ambiguous requirement mid-task                      | Stop and ask before continuing  |
| External side-effects (send email, deploy to prod)  | Stop and confirm                |
| >3 files to create that weren't discussed           | Stop and confirm scope          |

---

## Safety Checklist Before Autonomous Run

Before starting a multi-step autonomous sequence, verify:

- [ ] All steps are described and bounded (no open-ended "and whatever else is needed")
- [ ] No destructive operations in the plan
- [ ] Rollback path exists for each step
- [ ] Output of each step is verifiable (test pass, type check, etc.)
- [ ] External services are mocked or not called

---

## Parallelization Rules

Run subtasks in **parallel** only when they are truly independent:

```
PARALLEL  ✓  Write unit tests for module A   +  Write unit tests for module B
PARALLEL  ✓  Run linter                       +  Run type-checker
SEQUENTIAL ✓  Write code → Run tests → Fix failures
SEQUENTIAL ✓  Create migration → Run migration → Seed data
```

**Dependency check**: if task B reads output produced by task A, they are sequential.

---

## Pipeline Pattern (Sequential Phases)

Use phases when work naturally flows from one stage to the next:

```
Phase 1: EXPLORE   → read codebase, understand structure
Phase 2: PLAN      → list files to create/modify, confirm if uncertain
Phase 3: IMPLEMENT → write code, one logical unit at a time
Phase 4: VERIFY    → run full verification loop (see verification-loop skill)
Phase 5: REPORT    → summarise what changed and why
```

Each phase completes before the next begins.

---

## Verification Loop After Autonomous Work

After any autonomous implementation sequence, always run:

```bash
# 1. Compile / type-check
# 2. Unit tests
# 3. Integration tests (if applicable)
# 4. Coverage gate
# 5. Security scan (if auth/payments touched)
```

Do not report "done" until all gates pass.

---

## Autonomous Run Template

When starting a long autonomous task, state the plan explicitly:

```
Plan:
1. [step] — [why] — [reversible? yes/no]
2. [step] — [why] — [reversible? yes/no]
...
Parallel candidates: steps X and Y (no dependency between them)
Stop conditions: if [condition], pause and ask.
```

---

## Anti-Patterns

| Anti-pattern                                  | Consequence                                  |
|-----------------------------------------------|----------------------------------------------|
| Continuing after a failing test               | Compounds errors; later steps are invalid    |
| Parallelising dependent tasks                 | Race conditions, conflicting file edits      |
| No verification step at the end               | Broken code reported as done                 |
| Autonomous deploys without explicit approval  | Production incidents                         |
| Treating "do everything needed" as a mandate  | Scope creep; unexpected side effects         |
