# OpenCode Global Configuration

This is the global agent context for `~/.config/opencode/`. It applies to every OpenCode session
on this machine, regardless of project. Project-specific context lives in the project's own `AGENTS.md`.

---

## Behavior

- Think before acting. Explore the codebase first, implement second.
- Make the minimal change that solves the problem. Do not refactor adjacent code unless asked.
- When uncertain about scope or intent, ask one focused question — do not guess.
- Never create documentation files unless explicitly requested.
- When told "yes", "do it", or "proceed" — execute immediately. Do not repeat the plan.

## Communication

- Responses are displayed in a monospace terminal. Use short paragraphs or bullet lists.
- Summarize what you did, not what you tried. Report blockers early.
- No praise, no affirmations, no "Great question!". Direct and objective only.

## Code Quality

- Every function does one thing. If it needs a comment to explain "what", split it.
- No magic numbers or strings — use named constants.
- No commented-out code. Delete it or keep it.
- Prefer explicit over implicit. Clarity beats cleverness.

## Error Handling

- All errors must be handled. No silent swallowing (`catch {}`).
- Error messages include context: what failed, why, what the caller can do.
- Never log and re-throw the same error. Choose one.

## Verification

- Always run tests after a change. A fix is not complete until the original failing case passes
  AND no regressions appear.
- If there are no tests for a path you modified, write one.

## Edit Safety

- Before editing any file: re-read it. After editing: read it again to verify coherence.
- On any rename or signature change: grep for all references — direct calls, re-exports,
  barrel files, dynamic imports, test mocks. Assume a plain grep missed something.
- Never delete a file without first verifying nothing imports or references it.

## Security

- No hardcoded secrets, tokens, or API keys in source code.
- All external input is untrusted until validated.
- Fail closed: when in doubt, deny access and log.

---

## Available Agents

Invoke with `@agent-name` or let the primary agent delegate automatically.

| Agent | Purpose |
|---|---|
| `planner` | Structured plan with 3 options. Writes zero code until confirmed. |
| `architect` | System design, ADR generation, trade-off analysis. |
| `orchestrator` | Decomposes complex tasks, dispatches subagents in parallel or sequence. |
| `security-auditor` | OWASP Top 10, CVE scan, auth/authz review, secrets exposure. |
| `new-feature` | Full feature lifecycle: explore → design → TDD → self-review. |
| `refactor` | Blast radius mapping, 3 options, incremental with test verification. |
| `tdd-guide` | Strict RED → GREEN → REFACTOR. 80%+ coverage enforced. |
| `code-review` | Bug, security, architecture review. CRITICAL / HIGH / MEDIUM tiered. |
| `pr-review` | PR review from git diff. Use with `/review` or `@pr-review`. |
| `typescript-reviewer` | TypeScript/React specialist. |
| `python-reviewer` | Python/FastAPI specialist. |
| `flutter-reviewer` | Flutter/Dart + Riverpod specialist. |
| `java-reviewer` | Java 21 / Spring Boot 3.x specialist. |
| `build-resolver` | Build failures across npm, pip, Maven, Gradle, Go. |
| `fix` | Diagnose and fix build/test/runtime failures. Max 3 attempts. |
| `explore` | Read-only codebase explorer. Fast. |
| `doc-writer` | README, JSDoc/TSDoc, OpenAPI, ADR, codemap. |
| `init-project` | Generates `AGENTS.md` + `.opencode/opencode.json` for any project. |
| `write-commit` | Conventional commit message from `git diff --staged`. |

## Slash Commands

```
/plan          — structured plan with 3 architectural options
/tdd           — strict TDD: RED → GREEN → REFACTOR
/review        — review staged changes (CRITICAL/HIGH/MEDIUM)
/fix           — diagnose and fix current failure
/secure        — full security audit
/refactor      — map blast radius, propose options, apply incrementally
/learn         — extract session patterns into a SKILL.md
/checkpoint    — verify + summarize progress + list next steps
/verify        — full pipeline: compile → test → coverage → security
/orchestrate   — multi-agent task decomposition and coordination
/init-project  — generate AGENTS.md + .opencode/opencode.json for current project
```

## Per-Project Setup

Run `/init-project` in any project to generate:
- `AGENTS.md` — project-specific context (stack, rules, gotchas, entry points)
- `.opencode/opencode.json` — project-level config overrides

Language-specific rules (`rules/typescript.md`, `rules/python.md`) are available but not
auto-loaded globally. Add them to your project's `opencode.json` `instructions` array when needed.
