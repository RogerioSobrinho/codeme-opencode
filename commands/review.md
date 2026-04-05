---
description: Review staged changes or a diff for bugs, security issues, architecture violations. Tiered — CRITICAL/HIGH/MEDIUM. No style comments.
agent: code-review
---

Review the following code changes for bugs, security vulnerabilities, logic errors, and architecture violations:

!`git diff --staged 2>/dev/null || git diff HEAD~1 2>/dev/null`

Report only real defects — no style comments. Every finding must include:
- File and approximate line
- Root cause (one sentence)
- Concrete fix

End with verdict: APPROVED / APPROVED WITH NOTES / CHANGES REQUESTED / BLOCKED
