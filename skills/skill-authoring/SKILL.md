---
name: skill-authoring
description: Load when writing a new SKILL.md, updating an existing skill, or when asked "how do I write a skill", "how do I create a new skill for OpenCode".
---

# Skill Authoring

## OpenCode Skill Anatomy

A skill is a Markdown file with YAML frontmatter that OpenCode loads contextually.

```
skills/
  <name>/
    SKILL.md    ← one file per skill; name matches directory
```

### Frontmatter fields

```yaml
---
name: my-skill-name          # matches the directory name exactly
description: Load when ...   # the trigger condition (see below)
---
```

---

## Description Trigger Writing Guidelines

The `description` field determines when the skill is loaded. Write it as:

```
Load when <specific situation> [, <situation 2>], or when asked "<example prompt 1>", "<example prompt 2>".
```

**Rules**:
- Start with `Load when` — not "This skill", not "Use when".
- Be specific: name the task type, not just the domain.
- Include 2–4 literal prompt examples a user might type.
- Avoid overlap with other skill descriptions — each skill should have a unique trigger.

```yaml
# Good
description: Load when designing a new REST API, reviewing an API contract, or when asked "what status code should I use", "how should I version this API".

# Bad — too vague
description: Use for API things.

# Bad — no trigger conditions
description: REST API best practices and conventions.
```

---

## Content Principles

| Principle             | Rule                                                             |
|-----------------------|------------------------------------------------------------------|
| Rules > prose         | Use imperative rules, not explanations of why rules exist        |
| Tables for comparisons| Good/Bad, Before/After, Anti-pattern/Fix → always in a table    |
| Code examples required| Every pattern must have a concrete code example                  |
| Anti-patterns section | Mandatory in every skill; the most-read section                 |
| Max length            | ~250 lines; split into two skills if longer                      |
| No opinions           | Every rule must be actionable and observable                     |

---

## File Naming

```
skills/<name>/SKILL.md

✓  skills/api-design/SKILL.md
✓  skills/tdd-workflow/SKILL.md
✗  skills/api_design/SKILL.md   (underscores)
✗  skills/ApiDesign/SKILL.md    (PascalCase)
✗  skills/api/design.md         (wrong filename)
```

- Directory name = `name` in frontmatter = kebab-case.
- Always `SKILL.md` (uppercase), never `skill.md` or `README.md`.

---

## Version Management

| Action       | When                                      | How                                          |
|--------------|-------------------------------------------|----------------------------------------------|
| Update       | Adding new evidence, fixing examples      | Edit in place; content changes are implicit  |
| Deprecate    | A better skill supersedes this one        | Add `Status: Deprecated. Superseded by [x-skill].` at top of content |
| Delete       | Skill is actively harmful or totally wrong| Remove file; note removal in AGENTS.md       |

Never silently overwrite semantics — if the rule changes substantially, add a note at the top.

---

## Skill Skeleton

```markdown
---
name: <skill-name>
description: Load when <trigger conditions>, or when asked "<prompt example 1>", "<prompt example 2>".
---

# <Skill Title>

## <Core Concept or Rule Section>

[1–3 sentences max. Then rules or table.]

---

## <Pattern or How-To Section>

```[language]
// code example — required
```

---

## <When to Use vs. When Not To>

| Use when                  | Do not use when            |
|---------------------------|----------------------------|
| ...                       | ...                        |

---

## Anti-Patterns

| Anti-pattern              | Fix / What to do instead   |
|---------------------------|----------------------------|
| ...                       | ...                        |
```

---

## Quality Checklist

Before saving a new or updated skill:

- [ ] Frontmatter has both `name` and `description`.
- [ ] `description` starts with `Load when` and includes prompt examples.
- [ ] At least one code example.
- [ ] Anti-patterns section present with at least 3 entries.
- [ ] Under 250 lines.
- [ ] No duplicate coverage with an existing skill (check other SKILL.md files).
- [ ] `name` matches the directory name exactly.
