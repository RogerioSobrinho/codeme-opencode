---
description: Scan the project and generate AGENTS.md + .opencode/opencode.json with project-specific context. Run once per project.
agent: init-project
---

Initialize OpenCode context for this project.

Scan the codebase and generate:
1. `AGENTS.md` — universal agent context (tech stack, architecture, absolute rules, known gotchas)
2. `.opencode/opencode.json` — project-specific config with relevant instructions

Read: package.json / pyproject.toml / pom.xml / go.mod, existing README, source structure, git history (last 20 commits), any existing AGENTS.md or CLAUDE.md.

Rules:
- Only write what the evidence supports — no assumptions
- At least 3 real conventions extracted from actual code
- If a section has no evidence, write: `TODO: not enough evidence — review manually`
- AGENTS.md should be concise — it's a quick-start brief, not documentation
