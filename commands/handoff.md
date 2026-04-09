---
description: Produces a structured handoff document capturing what was done, decisions made, what was discarded, current state, and exact next steps. Run at the end of a work session to enable fast resumption later.
---

Produce a handoff document for this session. This is not a summary — it is a briefing that lets someone (or a future session) resume work in under 2 minutes without re-exploring.

Structure the document as follows:

---

# Handoff — [detect project name from package.json/pyproject.toml/go.mod or use directory name]

**Date:** [today's date and time]
**Branch:** [current git branch]
**Session goal:** [one sentence — what was being worked on]

## What was done

[Bullet list of concrete actions taken. Be specific: which files were modified, what was added/removed/fixed. Not "refactored auth" — "extracted JWT validation from UserController into JwtService, updated 4 call sites".]

## Decisions made

[Each decision that would not be obvious from reading the code:]
- **Decision:** [what was decided]
  **Reason:** [why — context that is not in the code]
  **Alternatives considered:** [what was rejected and why]

## What was explicitly discarded

[Approaches that were tried or considered and abandoned:]
- [Approach] — discarded because [reason]. Do not retry without [condition].

## Current state

**Working:** [what is confirmed working]
**Broken / incomplete:** [what is known to not work yet, with why]
**Open questions:** [unresolved issues or unknowns that affect next steps]

## Exact next steps

[Ordered list. Be precise enough that someone can start immediately:]
1. [Concrete action] in [file:line if applicable]
2. [Concrete action]
3. ...

## Context to re-read before resuming

[Files or sections that are essential to re-read before continuing — avoid reading the whole codebase again]
- `[file path]` — [why it matters]

---

After producing the document, save it to `.opencode/sessions/handoff-[YYYY-MM-DD].md` in the current project directory (use `!` to write the file).

Also run:
```
git status
git diff --stat HEAD
```
And append the output as a **"Git state"** section at the bottom of the document.
