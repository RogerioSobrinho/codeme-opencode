---
description: Implement a feature or fix using strict TDD — write failing test first, minimal code to pass, then refactor. 80%+ coverage required.
agent: tdd-guide
---

Apply strict TDD for: $ARGUMENTS

Follow RED → GREEN → REFACTOR:
1. Understand the domain — read existing code first
2. Scaffold the interface/contract (function signatures, types)
3. Write the failing test and run it to confirm it fails for the right reason
4. Write minimal code to make it pass
5. Run tests again to confirm GREEN
6. Refactor while keeping tests green
7. Verify coverage >= 80%

Never skip RED. Never write implementation before a failing test exists.
Never weaken assertions to make tests pass — fix the implementation.
