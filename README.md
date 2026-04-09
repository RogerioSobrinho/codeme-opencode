# codme-opencode

Global configuration installer for [OpenCode](https://opencode.ai) — ships 20 specialized agents, 16 slash commands, 29 skills, 35 plugins, and 7 rule sets, deployed to `~/.config/opencode/`.

Requires a **GitHub Copilot Pro+** subscription. All agents use the `github-copilot` provider.

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
| `agents/` | 20 specialized agents |
| `commands/` | 16 slash commands |
| `skills/` | 29 skill packs |
| `rules/` | 7 modular rule sets |
| `plugins/` | 35 quality-guard and automation plugins |

Company-specific skills (`company-*`) are never overwritten.

## Agents

| Agent | Model | Purpose |
|---|---|---|
| `planner` | claude-opus-4.6 | Requirements analysis, 3 architecture options, implementation plan. Writes no code. |
| `architect` | claude-opus-4.6 | System design, ADR generation, trade-off analysis |
| `security-auditor` | claude-opus-4.6 | OWASP Top 10, CVE scan, auth/authz, secrets exposure |
| `orchestrator` | claude-opus-4.6 | Multi-agent coordinator. Parallel + sequential subagent dispatch. |
| `new-feature` | gpt-5.3-codex | Full feature lifecycle: explore → design → TDD → review |
| `refactor` | gpt-5.3-codex | Blast radius mapping, 3 options, incremental with test verification |
| `typescript-reviewer` | gpt-5.3-codex | TypeScript/React specialist: `any` leaks, unsound assertions, hook violations |
| `python-reviewer` | gpt-5.3-codex | Python/FastAPI specialist: blocking I/O, missing types, injection vectors |
| `flutter-reviewer` | gpt-5.3-codex | Flutter/Dart+Riverpod specialist: BuildContext leaks, const, mounted guard |
| `java-reviewer` | gpt-5.3-codex | Java 21/Spring Boot 3.x specialist: @Transactional, N+1, entity exposure |
| `code-review` | claude-sonnet-4.6 | Bug, security, architecture review. Tiered CRITICAL/HIGH/MEDIUM. |
| `tdd-guide` | claude-sonnet-4.6 | Strict RED→GREEN→REFACTOR. TS, Python, Java, Go. |
| `pr-review` | claude-sonnet-4.6 | PR review from git diff. Async/CI-friendly. |
| `init-project` | gemini-2.5-pro | Generates `AGENTS.md` + `.opencode/opencode.json` for any project |
| `build-resolver` | grok-code-fast-1 | Build failures across npm, pip, Maven, Gradle, Go |
| `fix` | grok-code-fast-1 | Diagnose and fix build/test/runtime failures. Max 3 attempts. |
| `explore` | gpt-5.4-mini | Read-only codebase explorer |
| `doc-writer` | gpt-5.4-mini | README, JSDoc/TSDoc, OpenAPI, ADR, codemap |
| `librarian` | claude-sonnet-4.6 | Research specialist: fetches verified docs and OSS patterns via context7 and gh_grep |
| `write-commit` | gpt-5-mini | Conventional commit message from `git diff --staged`. |

## Model Strategy

All agents use the `github-copilot` provider, which routes through your Copilot Pro+ subscription. Models are assigned by task profile — no heavier model is used where a lighter one is sufficient.

| Tier | Model | Agents |
|---|---|---|
| **Opus** | `claude-opus-4.6` | planner, architect, security-auditor, orchestrator |
| **Sonnet** | `claude-sonnet-4.6` | code-review, tdd-guide, pr-review, librarian _(global default)_ |
| **Codex** | `gpt-5.3-codex` | new-feature, refactor, typescript-reviewer, python-reviewer, flutter-reviewer, java-reviewer |
| **Gemini** | `gemini-2.5-pro` | init-project |
| **Grok** | `grok-code-fast-1` | build-resolver, fix |
| **Mini** | `gpt-5.4-mini` | explore, doc-writer _(global small\_model)_ |
| **Mini** | `gpt-5-mini` | write-commit |

**Rationale by tier:**

- **Opus** — used only where deep reasoning, multi-step risk analysis, or security pattern recognition matters. The cost is justified by the criticality of the output (wrong architecture or missed vulnerability is expensive).
- **Codex** — code-generation and code-review tasks map directly to what codex models are trained for. 400K context window handles large file reviews comfortably.
- **Sonnet** — balanced default for qualitative tasks (review narrative, TDD guidance, PR feedback) where raw code generation speed is less important than reasoning quality.
- **Gemini 2.5 Pro** — `init-project` scans entire codebases before writing anything. Gemini's architecture handles broad multi-file reads well.
- **Grok** — `build-resolver` and `fix` are pattern-match-then-apply tasks (classify error → apply targeted fix). Grok Code Fast is purpose-built for this and avoids burning Opus/Sonnet tokens on mechanical work.
- **Mini** — `explore` is read-only, `doc-writer` is mechanical writing, `write-commit` generates a single line. No reasoning depth needed; cost savings are maximized here.

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
/commit        — generate conventional commit from staged changes
/clean-slop    — scan staged changes for AI slop patterns to remove
/review-work   — full review pipeline: code-review + security + language reviewer in parallel
/handoff       — structured handoff doc for fast session resumption
/standup       — daily standup summary from recent commits and changes
```

## Skills

29 skill packs covering: TDD workflow, verification loops, autonomous loops, multi-agent orchestration, strategic compact, context budget, API design, security review, debugging playbook, codebase onboarding, TypeScript/React/Node/Python/Spring Boot/Go/Flutter/Java/database/git/GitHub Actions/Docker/deployment/E2E testing patterns, architecture decision records, and more.

## Rules

Modular rule sets. The 5 universal rules (`core`, `engineering`, `security`, `testing`, `git`) are injected into every session via `instructions` in `opencode.json`. Language-specific rules (`typescript`, `python`) are available for project-level inclusion.

| File | Scope | Auto-loaded |
|---|---|---|
| `rules/core.md` | Universal: behavior, quality, error handling, verification | Yes |
| `rules/engineering.md` | Architecture, concurrency, API design, observability | Yes |
| `rules/security.md` | OWASP, auth, secrets, injection, HTTP headers | Yes |
| `rules/testing.md` | Test pyramid, coverage, naming, mocking, isolation | Yes |
| `rules/git.md` | Conventional commits, branching, PR hygiene | Yes |
| `rules/typescript.md` | Type safety, strict mode, async, React | Project-level |
| `rules/python.md` | Type hints, async, mypy, FastAPI, security | Project-level |

## Global Config

Key settings in `opencode.json` beyond agents:

| Field | Value | Purpose |
|---|---|---|
| `enabled_providers` | `["github-copilot"]` | Locks all model selection to Copilot Pro+; prevents accidental use of other authenticated providers |
| `instructions` | 5 rules files | Injects universal rules into every session automatically |
| `compaction` | `auto: true, prune: true, reserved: 10000` | Prevents context overflow on long sessions |
| `watcher.ignore` | `node_modules, dist, .git, build, target, .dart_tool` | Excludes generated/vendor directories from the file watcher |

Temperature is set per agent: `0.1` for analysis/review/deterministic tasks, `0.3` for generative/planning tasks.

`build-resolver`, `fix` have `steps: 10` to enforce a hard stop after 10 tool calls. `write-commit`, `build-resolver`, and `explore` are `hidden: true` so they do not clutter the `@` autocomplete — they are invoked by commands and other agents.

## Plugins

Quality-guard and automation plugins that run automatically during OpenCode sessions:

| Plugin | Trigger | What it does |
|---|---|---|
| `typescript-check.ts` | After `.ts`/`.tsx` edit | Runs `tsc --noEmit` on the nearest tsconfig |
| `lint-check.ts` | After JS/TS or Python edit | Runs ESLint or ruff; logs warnings |
| `pre-commit-guard.ts` | Before `git commit` | Blocks debug artifacts and secrets; warns on non-Conventional Commits |
| `bash-guard.ts` | Before any bash call | Blocks destructive `rm`, `DROP TABLE`, `git push --force`, `git reset --hard` |
| `todo-progress.ts` | On every TodoWrite update | Logs structured task progress (completed/in-progress/pending) |
| `compaction.ts` | Before context compaction | Replaces default prompt with a dense continuation brief |
| `shell-env.ts` | Before every bash call | Injects `PROJECT_ROOT`, `PACKAGE_MANAGER`, `PRIMARY_LANGUAGE` |
| `session-notify.ts` | `permission.asked` + `session.idle` | macOS desktop notification when approval needed or session finishes |
| `env-protection.ts` | Before `read`/`edit` | Blocks access to real `.env` files |
| `flutter-check.ts` | After `.dart` edit | Runs `flutter analyze` or `dart analyze` |
| `java-check.ts` | After `.java` edit | Runs `mvn compile`; logs errors only |
| `session-timer.ts` | `session.idle` | Logs elapsed time; flags sessions over 10 minutes |
| `diff-summary.ts` | `session.idle` | Logs `git diff --stat` summary of files changed this session |
| `file-backup.ts` | Before `write`/`edit` | Backs up files ≥50 lines to `.opencode/backups/` before overwriting; auto-prunes after 24h |
| `auto-branch.ts` | Session start + `git commit` | Warns when on a protected branch; blocks commits to `main`/`master`/`develop`/`staging`/`production` |
| `session-summary.ts` | `session.idle` | Writes a `.md` summary to `.opencode/sessions/` with changed files and pending todos |
| `stale-todo-guard.ts` | `session.idle` | Warns (log + macOS notification) if todos are still in-progress or pending when the agent stops |
| `error-rerun.ts` | After failed bash call | Detects transient errors (network, port, missing module, Docker, DB) and retries once after 1.5s |
| `smart-context.ts` | On assistant message | Auto-injects file contents when the agent references a path that exists on disk (≤300 lines) |
| `daily-digest.ts` | First `session.created` of the day | Logs today's commit count, active branches, and top changed files |
| `session-error-notify.ts` | `session.error` | macOS notification + TUI toast on session crashes (model timeout, server crash, invalid response) |
| `tui-toast.ts` | `session.idle`, `permission.asked`, `session.error`, `todo.updated` | Visual inline TUI toasts for attention events |
| `lsp-diagnostics.ts` | `lsp.client.diagnostics` | Injects LSP errors/warnings as silent context so the agent sees them without manual compiler runs |
| `permission-auto-approve.ts` | `permission.asked` | Auto-approves read-only tools (read, glob, grep); always prompts for bash, write, edit |
| `command-history.ts` | After bash calls | Appends every bash command (timestamp, exit code, output preview) to `.opencode/history/YYYY-MM-DD.log` |
| `doom-loop-notify.ts` | `permission.asked` (doom_loop) | Log + TUI toast + macOS notification when the agent enters a detected infinite tool loop |
| `file-watcher.ts` | `file.watcher.updated` | Detects external file changes (debounced 2s); injects a context hint for TypeScript/JS files modified outside the agent |
| `session-diff.ts` | `session.diff` | Structured diff log using the native platform event — superior to `diff-summary`'s manual git stat |
| `tui-prompt-shortcuts.ts` | `session.created` | Appends branch name and other context snippets to the TUI prompt automatically on session start |
| `context-window-monitor.ts` | `session.idle` | Warns at 70% context usage (toast) and at 85% injects a `/checkpoint` suggestion to avoid overflow |
| `directory-agents-injector.ts` | Before `read`/`edit` | Injects the nearest `AGENTS.md` up the directory tree as a system message for scoped agent context |
| `directory-readme-injector.ts` | Before `read`/`edit`/`write` | Injects the nearest `README.md` up the directory tree to give the agent module-level context |
| `preemptive-compaction.ts` | `session.idle` | Triggers context compaction at 78% usage — before the limit — so compaction happens at a clean boundary |
| `tool-output-truncator.ts` | After bash/grep/find | Caps large tool outputs before they reach context; appends `[truncated — N bytes omitted]` marker |
| `write-guard.ts` | Before `write`/`edit` | Injects the current file contents if the file hasn't been read this session, preventing silent overwrites |

All plugins respect a `OPENCODE_NO_<PLUGIN>=1` environment variable to disable them individually.

## MCPs

Configured in `opencode.json`:

| MCP | Type | Purpose |
|---|---|---|
| `sequential-thinking` | local | Structured multi-step reasoning |
| `memory` | local | Persistent memory across sessions (`~/.config/opencode/memory.jsonl`) |
| `context7` | remote | Up-to-date library documentation lookup |
| `gh_grep` | remote | GitHub code search across public repositories |

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
