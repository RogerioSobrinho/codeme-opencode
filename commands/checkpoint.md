---
description: Save current progress — run verification gates, summarize state, identify next steps.
---

Run a checkpoint for the current work:

1. Run available verification gates:
   !`npm test 2>/dev/null || go test ./... 2>/dev/null || pytest 2>/dev/null || mvn test -q 2>/dev/null`

2. Show git status:
   !`git status --short`

3. Show what changed:
   !`git diff --stat HEAD 2>/dev/null | head -20`

4. Summarize:
   - What was completed in this session
   - What is currently in progress
   - What remains to do
   - Any open issues or TODOs added

5. Suggest next steps

This is a progress snapshot — do not make code changes.
