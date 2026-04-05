---
description: Restructure code while preserving behavior. Maps blast radius, proposes 3 options, applies incrementally with test verification.
agent: refactor
---

Refactor: $ARGUMENTS

Steps:
1. Read and understand the target code first
2. Map the blast radius — which files and callers are affected
3. Check test coverage for the target code (add characterization tests if missing)
4. Propose 3 refactoring approaches with trade-offs (mark one RECOMMENDED)
5. Wait for confirmation before applying
6. Apply incrementally — verify tests pass after each step
7. Report: what changed, what tests verify correctness, any remaining debt

Rules:
- Never refactor and add new behavior in the same change
- If tests fail after any step, revert and diagnose before continuing
