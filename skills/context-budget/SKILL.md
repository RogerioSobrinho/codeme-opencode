---
name: context-budget
description: Load when a session feels sluggish, output quality is degrading, you've added many skills/agents/MCPs, or you want to know how much context headroom remains.
---

# Context Budget

## Why It Matters

Every agent description, skill, rule file, and MCP server tool list consumes context on **every request**, before you write a single word. A bloated configuration silently degrades output quality.

---

## Inventory Phase

List and count all loaded components:

```bash
# Count agent files
ls ~/.config/opencode/agents/ | wc -l
wc -l ~/.config/opencode/agents/*.md

# Count skill files
ls ~/.config/opencode/skills/*/SKILL.md | wc -l
wc -l ~/.config/opencode/skills/*/SKILL.md

# Count rules
wc -l ~/.config/opencode/AGENTS.md

# Count MCP servers
cat ~/.config/opencode/opencode.json | grep -c '"command"'
```

---

## Classify Phase

For each component, classify as:

| Class            | Definition                                              | Action                    |
|------------------|---------------------------------------------------------|---------------------------|
| Always needed    | Used in >80% of sessions for this project               | Keep; trim to essentials  |
| Sometimes needed | Used when working on specific features                  | Keep; ensure description is tight |
| Rarely needed    | Used < 20% of sessions; loaded on demand               | Consider removing or lazy-loading |

---

## Token Estimation

**Rule of thumb**: word count × 1.3 ≈ tokens

| Component type          | Typical token cost         | Flag if over    |
|-------------------------|----------------------------|-----------------|
| Agent description       | 50–200 tokens each         | > 300 per agent |
| SKILL.md file (loaded)  | 500–1,500 tokens           | > 2,000 per skill |
| AGENTS.md / rules       | 200–2,000 tokens           | > 3,000 total   |
| MCP server tool list    | 100–500 tokens per server  | > 3 servers     |
| MCP server per tool     | 50–150 tokens per tool     | > 10 tools/server |

---

## Issue Detection

### Bloated agent descriptions
```
Problem: Description > 300 tokens with prose explanations.
Fix: Reduce to: what it does (1 sentence) + when to use it (1 sentence) + key tools.
```

### Heavy skills
```
Problem: SKILL.md > 2,000 tokens; loaded even when irrelevant.
Fix: Split into two focused skills; improve description trigger so it loads selectively.
```

### Redundant components
```
Problem: Two agents or skills cover the same domain.
Fix: Merge them; consolidate into one with a broader trigger.
```

### MCP over-subscription
```
Problem: 5+ MCP servers loaded; most tools never used.
Fix: MCP is the biggest lever — each server adds hundreds of tokens per tool.
     Remove servers not used in the last 2 weeks.
```

---

## Context Budget Report Format

```markdown
## Context Budget Report — [date]

### Configuration Inventory
| Component          | Count | Est. Tokens | Status  |
|--------------------|-------|-------------|---------|
| Agent files        | N     | ~X          | OK / ⚠️ |
| Skill files        | N     | ~X          | OK / ⚠️ |
| AGENTS.md          | 1     | ~X          | OK / ⚠️ |
| MCP servers        | N     | ~X          | OK / ⚠️ |
| **Total overhead** |       | **~X**      |         |

### Issues Found
- [Component]: [issue] → [recommended fix]

### Recommended Actions
1. [action]
2. [action]
```

---

## Best Practices

- **Run after any configuration change** — adding one MCP server can cost 1,000+ tokens.
- **Agent descriptions are always loaded** — keep them under 200 tokens; link to skill for details.
- **MCP is the biggest lever** — each tool in each server is injected into every request.
- **Skills are loaded selectively** — a good description trigger is more valuable than trimming content.
- **Prune quarterly** — components added for one task accumulate; review and remove.

---

## Anti-Patterns

| Anti-pattern                                | Cost                                          |
|---------------------------------------------|-----------------------------------------------|
| Verbose agent descriptions with prose       | Tokens wasted on every request                |
| All skills loaded unconditionally           | Kills context headroom for actual work        |
| MCP servers for features you tested once    | Constant token drain with no return           |
| Duplicate agents covering same domain       | Split context, split quality                  |
| Never reviewing/pruning configuration       | Slow degradation over months                  |
