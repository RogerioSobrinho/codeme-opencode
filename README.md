# codme-opencode

Global configuration installer for [OpenCode](https://opencode.ai) — ships 17 specialized agents, 11 slash commands, 28 skills, and 7 rule sets, deployed to `~/.config/opencode/`.

## Install

**Remote (one-liner):**
```bash
curl -fsSL https://raw.githubusercontent.com/RogerioSobrinho/codme-opencode/main/install.sh | bash
```

**Local (from cloned repo):**
```bash
git clone https://github.com/RogerioSobrinho/codme-opencode.git
cd codme-opencode
./install.sh
```

Safe to re-run at any time — idempotent. Only updates files that have changed.

## What Gets Installed

Deploys to `~/.config/opencode/`:

| Path | Contents |
|---|---|
| `opencode.json` | Global config: model, MCPs, agent definitions, permissions |
| `AGENTS.md` | Universal agent context template |
| `agents/` | 17 specialized agents |
| `commands/` | 11 slash commands |
| `skills/` | 28 skill packs |
| `rules/` | 7 modular rule sets |

Company-specific skills (`company-*`) are never overwritten.

## Agents

| Agent | Purpose |
|---|---|
| `planner` | Requirements analysis, 3 architecture options, implementation plan. Writes no code. |
| `architect` | System design, ADR generation, trade-off analysis |
| `new-feature` | Full feature lifecycle: explore → design → TDD → review |
| `code-review` | Bug, security, architecture review. Tiered CRITICAL/HIGH/MEDIUM. |
| `security-auditor` | OWASP Top 10, CVE scan, auth/authz, secrets exposure |
| `tdd-guide` | Strict RED→GREEN→REFACTOR. TS, Python, Java, Go. |
| `build-resolver` | Build failures across npm, pip, Maven, Gradle, Go |
| `refactor` | Blast radius mapping, 3 options, incremental with test verification |
| `doc-writer` | README, JSDoc/TSDoc, OpenAPI, ADR, codemap |
| `explore` | Read-only codebase explorer |
| `fix` | Diagnose and fix build/test/runtime failures. Max 3 attempts. |
| `pr-review` | PR review from git diff. Async/CI-friendly. |
| `orchestrator` | Multi-agent coordinator. Parallel + sequential subagent dispatch. |
| `typescript-reviewer` | TypeScript/React specialist: `any` leaks, unsound assertions, hook violations |
| `python-reviewer` | Python/FastAPI specialist: blocking I/O, missing types, injection vectors |
| `init-project` | Generates `AGENTS.md` + `.opencode/opencode.json` for any project |
| `write-commit` | Conventional commit message from `git diff --staged`. Haiku model. |

## Slash Commands

```
/plan          — structured implementation plan with 3 options
/tdd           — strict TDD: RED → GREEN → REFACTOR
/review        — review staged changes (CRITICAL/HIGH/MEDIUM)
/fix           — diagnose and fix current failure
/secure        — full security audit
/refactor      — map blast radius, propose options, apply incrementally
/learn         — extract session patterns to a SKILL.md
/checkpoint    — progress snapshot: verify + summarize + next steps
/verify        — full pipeline: compile → test → coverage → security
/orchestrate   — multi-agent task decomposition and coordination
/init-project  — generate AGENTS.md + .opencode/opencode.json
```

## Skills

28 skill packs covering: TDD workflow, verification loops, autonomous loops, multi-agent orchestration, strategic compact, context budget, API design, security review, debugging playbook, codebase onboarding, TypeScript/React/Node/Python/Spring Boot/Go/database/git/GitHub Actions/Docker/deployment/E2E testing patterns, architecture decision records, and more.

## Rules

Modular rule sets loaded by agents:

| File | Scope |
|---|---|
| `rules/core.md` | Universal: behavior, quality, error handling, verification |
| `rules/engineering.md` | Architecture, concurrency, API design, observability |
| `rules/security.md` | OWASP, auth, secrets, injection, HTTP headers |
| `rules/testing.md` | Test pyramid, coverage, naming, mocking, isolation |
| `rules/typescript.md` | Type safety, strict mode, async, React |
| `rules/python.md` | Type hints, async, mypy, FastAPI, security |
| `rules/git.md` | Conventional commits, branching, PR hygiene |

## MCPs

Configured in `opencode.json`:

- **sequential-thinking** — structured multi-step reasoning
- **memory** — persistent memory across sessions (`~/.config/opencode/memory.jsonl`)

## Per-Project Config

Run `/init-project` (or the `init-project` agent) in any project to generate:
- `AGENTS.md` — project-specific agent context (tech stack, rules, gotchas)
- `.opencode/opencode.json` — project-level overrides

## Company Skills

Add private, project-specific, or company-specific skills without them being overwritten on updates:

```
~/.config/opencode/skills/company-{name}-{topic}/SKILL.md
```

The installer never touches any directory matching `company-*`.
