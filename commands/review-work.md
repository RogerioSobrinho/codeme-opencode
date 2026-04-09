---
description: Full review pipeline — runs code-review, security-auditor, and the language-specific reviewer in parallel. Use before merging or when you need comprehensive coverage.
agent: orchestrator
---

Run a full review of the current staged changes using three reviewers in parallel.

## Staged diff

!`git diff --staged 2>/dev/null || git diff HEAD~1 2>/dev/null`

## Project language detection

!`ls package.json pyproject.toml pom.xml build.gradle pubspec.yaml 2>/dev/null | head -5`

## Instructions

Detect the primary language from the file list above, then launch the following three subagents **in parallel** using the Task tool:

1. **@code-review** — general bug, logic, and architecture review  
2. **@security-auditor** — OWASP Top 10, injection, secrets, auth/authz  
3. Language-specific reviewer (choose one based on detected language):
   - TypeScript/JavaScript → **@typescript-reviewer**
   - Python → **@python-reviewer**
   - Flutter/Dart → **@flutter-reviewer**
   - Java/Kotlin → **@java-reviewer**
   - Other → **@code-review** (skip language-specific, only two parallel agents)

Each subagent receives the full diff above. Use the same prompt for all three:

> Review this diff for defects. Report only real issues — no style comments. Every finding must include file, approximate line, root cause (one sentence), and a concrete fix. End with verdict: APPROVED / APPROVED WITH NOTES / CHANGES REQUESTED / BLOCKED.

After all three complete:

1. Merge findings by severity (CRITICAL → HIGH → MEDIUM)
2. Deduplicate identical findings across reviewers
3. Present a unified report with reviewer attribution
4. Give a final overall verdict (strictest verdict from all three wins)
