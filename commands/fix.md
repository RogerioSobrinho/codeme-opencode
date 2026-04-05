---
description: Diagnose and fix the current build/test failure. Runs failing command, classifies root cause, applies surgical fix, re-verifies.
agent: fix
---

Diagnose and fix the current failure: $ARGUMENTS

Steps:
1. Run the failing command to capture the current error output
2. Classify failure type (compilation, dependency, test, runtime)
3. Apply surgical fix — touch only what is broken
4. Re-run to verify the fix worked
5. Explain what was wrong and why the fix resolves it

If still failing after 3 different approaches, explain root cause and ask for direction.
Never weaken test assertions to make tests pass.
