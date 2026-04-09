---
description: Generate a conventional commit message from staged changes and apply it. Delegates to the write-commit agent.
agent: write-commit
---

Read `git diff --staged` and generate a conventional commit message.

!`git diff --staged`

Format: `<type>(<scope>): <subject>`

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`, `revert`
- Subject: imperative mood, lowercase, no period, max 72 chars
- Body (optional): explain *why*, not *what*; reference issue numbers if applicable
- One logical change per commit

Return only the commit message, ready to copy-paste into `git commit -m "..."`.
Do not run `git commit` — the user will do that.
