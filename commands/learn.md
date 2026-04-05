---
description: Extract reusable patterns from current session into a skill file for future sessions.
---

Extract reusable patterns from this session and propose a new skill or update to an existing one.

Look for:
- Recurring patterns in the code we wrote or discussed
- Decisions made and their rationale (what was chosen and why)
- Mistakes corrected and what triggered them
- Architecture choices with clear trade-offs
- Stack-specific idioms or gotchas discovered

Format the output as a ready-to-save SKILL.md:

```markdown
---
name: <skill-name>
description: >
  Load when... [describe trigger conditions]
---

# <Title>

[Content: rules, patterns, examples, anti-patterns]
```

Suggest a directory name: `skills/<name>/SKILL.md`
