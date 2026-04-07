# /standup — Daily Standup Summary

Generate a daily standup summary for the current project.

## Instructions

Run the following bash commands to gather today's data (use `git log --since=midnight`):

1. **Commits today** — `git log --since=midnight --oneline --no-merges`
2. **Files changed today** — `git log --since=midnight --name-only --format="" --no-merges | sort -u`
3. **Current branch** — `git rev-parse --abbrev-ref HEAD`
4. **Uncommitted changes** — `git diff --stat HEAD` (if any)
5. **Branches touched today** — `git log --since=midnight --format=%D --no-merges`

Then format the output as a standup message with this structure:

---

**Date:** <today's date, e.g. Mon Apr 06>
**Project:** <project name from directory or package.json>
**Branch:** <current branch>

**Done:**
- <each commit as a bullet, using the commit message — be concise>
- <if no commits: "No commits yet today">

**In Progress:**
- <any uncommitted changes or in-progress todos from the session — infer from git diff and context>
- <if nothing: omit this section>

**Next:**
- <logical next steps based on current state, recent commits, and any pending todos>

---

**Rules:**
- Keep bullets short (max 10 words each)
- Merge similar commits into one bullet if they're part of the same task
- If there are no commits today, still generate a useful summary based on the current branch and any uncommitted work
- Format must be copy-paste ready for Slack, Teams, or Linear
- Do not add any explanation before or after the standup block — output only the formatted standup
