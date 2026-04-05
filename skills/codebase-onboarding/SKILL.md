---
name: codebase-onboarding
description: Load when starting work on an unfamiliar codebase, when the AGENTS.md is missing or outdated, when asked "understand this codebase", "onboard me to this project", "what is this codebase about".
---

# Codebase Onboarding

## Onboarding Sequence (5 Steps)

Complete all 5 steps before writing or modifying any code.

---

### Step 1 — Identity & Stack

```bash
# What language(s) and runtime?
ls package.json requirements.txt go.mod pom.xml Cargo.toml 2>/dev/null

# What framework?
cat package.json | grep -E '"express|fastify|nestjs|next|nuxt|react|vue"'
grep -r "from django\|import flask\|gin\.\|echo\." . --include="*.py" --include="*.go" -l | head -5

# What Node/Python/Go version?
cat .nvmrc .node-version .python-version go.mod 2>/dev/null | head -5

# What test framework?
grep -E '"jest|vitest|mocha|pytest|testing"' package.json go.mod 2>/dev/null
```

---

### Step 2 — Architecture

```bash
# Top-level structure
ls -1 src/ app/ cmd/ internal/ pkg/ 2>/dev/null

# Entry points
grep -r "app.listen\|createServer\|func main\|if __name__" . -l --include="*.ts" --include="*.go" --include="*.py"

# Module / layer boundaries
grep -r "@Module\|@Controller\|@Injectable\|Router\|Blueprint" . -l --include="*.ts" --include="*.py" | head -10

# Database / ORM
grep -r "TypeORM\|Prisma\|Sequelize\|SQLAlchemy\|GORM" . -l | head -5
```

---

### Step 3 — Key Flows

```bash
# How does a request flow through the system?
grep -r "@Get\|@Post\|router\.\|app\.get\|app\.post" . -n --include="*.ts" --include="*.py" | head -20

# How is auth handled?
grep -r "middleware\|guard\|jwt\|session\|passport" . -l --include="*.ts" --include="*.py" | head -5

# Where does data leave the system?
grep -r "\.save\|\.create\|\.insert\|\.update\|session\.add" . -l | head -5
```

---

### Step 4 — Testing Patterns

```bash
# What is the test structure?
find . -name "*.test.ts" -o -name "*.spec.ts" -o -name "test_*.py" | head -10

# How are mocks/fakes done?
grep -r "jest\.mock\|@MockBean\|MagicMock\|gomock" . -l | head -5

# What is the test coverage target?
cat jest.config.ts jest.config.js setup.cfg pytest.ini 2>/dev/null | grep -E "threshold|--cov-fail"
```

---

### Step 5 — Recent History

```bash
# What changed recently?
git log --oneline -20

# What are the active branches?
git branch -a | head -10

# Any open TODOs or known issues?
grep -r "TODO\|FIXME\|HACK\|XXX" src --include="*.ts" --include="*.py" --include="*.go" -n | head -20
```

---

## Codemap Output Format

After completing the 5 steps, produce a codemap:

```markdown
## Codemap: [Project Name]

**Stack**: [language + version] + [framework] + [DB/ORM]
**Entry points**: [file:line for main/bootstrap]
**Architecture**: [2–3 sentence description of layer structure]
**Key flows**:
  - HTTP request: [entry → middleware → handler → service → repository]
  - Auth: [how tokens are issued and validated]
**Test setup**: [framework, coverage target, mock strategy]
**Recent activity**: [top 3 areas of recent change from git log]
**Known gotchas**: [anything surprising discovered during onboarding]
```

---

## What to Write in AGENTS.md

After onboarding, document these sections:

```markdown
## Tech Stack
[Language, framework, DB, test framework — one line each]

## Architecture
[One paragraph: how the system is layered and how requests flow]

## Absolute Rules
- [Non-negotiable rule discovered from code or git history]
- ...

## Known Gotchas
- [Surprising behaviour, workaround applied, or constraint to be aware of]
- ...

## Entry Points
- `path/to/main.ts:12` — HTTP server bootstrap
- `path/to/worker.ts:5` — background job runner
```

---

## Minimum Evidence Threshold

**Do not write conventions you haven't seen in actual code.**

Before documenting any convention, verify it appears in ≥ 3 real files.

```bash
# Confirm a pattern exists before documenting it
grep -r "pattern you think you saw" src --include="*.ts" -n
# Must return ≥ 3 matches from different files
```

---

## Project-Specific opencode.json Template

```json
{
  "model": "claude-opus-4-5",
  "rules": ["AGENTS.md"],
  "skills": {
    "tdd-workflow": true,
    "verification-loop": true,
    "search-first": true
  }
}
```

---

## Common Onboarding Pitfalls

| Pitfall                                     | Fix                                                       |
|---------------------------------------------|-----------------------------------------------------------|
| Writing AGENTS.md from file names alone     | Run all 5 steps; verify conventions in real code          |
| Assuming MVC because there are controllers  | Check if service layer exists; read one request flow end-to-end |
| Documenting a pattern seen once             | Require ≥ 3 occurrences before treating it as convention  |
| Skipping test step                          | Test structure is critical — it reveals architectural assumptions |
| Starting to implement before onboarding     | Always complete the sequence first; costs 10 min, saves hours |
