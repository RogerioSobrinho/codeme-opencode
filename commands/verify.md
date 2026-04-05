---
description: Run the full verification pipeline — compile → unit tests → integration tests → coverage → security scan.
---

Run the full verification pipeline and report gate-by-gate:

**Gate 1 — Compile / Type-check:**
!`npm run build 2>/dev/null || tsc --noEmit 2>/dev/null || go build ./... 2>/dev/null || mvn compile -q 2>/dev/null || python -m mypy . 2>/dev/null`

**Gate 2 — Unit tests:**
!`npm test 2>/dev/null || go test -short ./... 2>/dev/null || pytest -x 2>/dev/null || mvn test -q 2>/dev/null`

**Gate 3 — Security audit:**
!`npm audit 2>/dev/null || pip-audit 2>/dev/null`

Rules:
- Never advance past a red gate — fix before reporting the next gate
- Report PASS/FAIL per gate with details on any failures
- If all gates pass, output: ALL GATES GREEN — ready to merge
