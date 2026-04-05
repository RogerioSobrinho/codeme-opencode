---
name: search-first
description: Load before implementing any new class, service, or utility function — or when navigating a large codebase (50+ files). Applies the grep-before-write and grep-before-read rules. Especially relevant when the request involves "add a", "create a", "implement", "write a method for", "build a new", or when file reads are causing context overflow.
---

# Search First

Two rules. Both apply at all times.

---

## Rule 1 — Grep Before Write

> Before writing any new utility, service, class, or function — search the codebase for an existing one.

Writing duplicate code is never faster. The maintenance cost compounds immediately.

### 5-Layer Search Order

Search each layer before moving to the next. Stop at the first layer that satisfies the need.

```
1. CODEBASE          → already solved here?
2. INSTALLED DEPS    → already in package.json / requirements.txt / go.mod?
3. FRAMEWORK         → built into the framework being used?
4. STDLIB            → built into the language standard library?
5. EXTERNAL LIBRARY  → justified addition with cost/benefit check?
```

#### Layer 1 — Search the Codebase

```bash
grep -r "formatDate\|parseDate\|toISO" src --include="*.ts" -l
grep -r "slugify\|to_slug\|kebab" src -n
grep -r "class.*Repository\|class.*Service" src -l
grep -r "paginate\|cursor\|offset.*limit" src -n
grep -r "retry\|backoff\|exponential" src -n
```

#### Layer 2 — Check Installed Dependencies

```bash
# Node
cat package.json | grep -i "date\|format\|util\|string"

# Python
pip show [package] | grep -i location

# Go
cat go.mod
```

#### Layer 3 — Framework Built-ins

| Framework     | Common built-ins people re-implement                    |
|---------------|---------------------------------------------------------|
| NestJS        | `@nestjs/common` pipes, guards, interceptors            |
| Django        | `django.utils`, `django.contrib.auth`                   |
| Spring Boot   | `StringUtils`, `CollectionUtils`, `BeanUtils`           |
| Go stdlib     | `strings`, `strconv`, `time`, `net/http`                |
| React         | `useReducer`, `useCallback`, `Suspense`                 |

#### Layer 5 — External Library (Last Resort)

Before adding a dependency, verify:

- [ ] Actively maintained? (last commit < 6 months)
- [ ] No known CVEs? (`npm audit` / `pip-audit` / `govulncheck`)
- [ ] Bundle/binary size acceptable?
- [ ] License compatible?
- [ ] Solves the problem significantly better than 20 lines of stdlib code?

---

## Rule 2 — Grep Before Read

> Never read a file to find out what is in it. Search first, read only what you need.

### Three-Layer Expansion

**Layer 1 — Structural Reconnaissance (no file reads)**

```bash
ls -1 src/
find src -name "*.ts" | head -40
grep -r "export class" src --include="*.ts" -l
grep -r "app.listen\|createServer\|bootstrap" src -l
grep -r "@Controller\|router\." src -l
```

**Layer 2 — Targeted Content Search**

```bash
grep -r "createOrder" src --include="*.ts" -n
grep -r "class OrderService" src -n
grep -r "new OrderService\|inject.*OrderService" src -n
grep -r "describe.*OrderService\|test.*create_order" src -n
```

**Layer 3 — Full File Read (justified only)**

Read a full file only when:
- Layer 2 found the file and you need the surrounding implementation context.
- You are about to **edit** the file.
- The file is < 100 lines.

### Token Budget Guide

| Read scope                   | Approx. tokens | When justified                         |
|------------------------------|----------------|----------------------------------------|
| `grep` for a symbol          | ~20            | Always — start here                    |
| Single method (20–40 lines)  | ~200           | After grep confirms file + line number |
| Single class (100–200 lines) | ~800           | Before editing the class               |
| Full file (500+ lines)       | ~3,000+        | Rarely; only when full context needed  |
| Full package / directory     | ~10,000+       | Almost never; use grep instead         |

### Common Questions → Grep Patterns

| Question                                | Grep pattern                                           |
|-----------------------------------------|--------------------------------------------------------|
| Where is this function defined?         | `grep -r "function <name>\|def <name>" src -n`         |
| Where is this class used?               | `grep -r "new <ClassName>\|<ClassName>(" src -n`       |
| Where are routes defined?               | `grep -r "router\.\|@Get\|@Post\|app\.get" src -l`    |
| Where are env vars read?                | `grep -r "process\.env\|os\.environ\|viper\.Get" . -n` |
| Where is the DB connection initialised? | `grep -r "createConnection\|DataSource\|engine =" . -l`|
| Where are errors handled?               | `grep -r "catch\|except\|handleError" src -n`          |

---

## Stop Conditions

Stop expanding and start implementing when:

1. You have found the file and function you need to modify (or confirmed it doesn't exist).
2. You understand the input/output contract.
3. You know which tests cover it.

---

## Anti-Patterns

| Anti-pattern                              | Cost                                       |
|-------------------------------------------|--------------------------------------------|
| Writing a util without searching first    | Duplicate logic; maintenance debt          |
| Installing a dep for < 30 lines of code   | Unnecessary bloat and security surface     |
| Reading full files to find a function     | 10–50x more tokens than a targeted grep    |
| Reading the same file twice in one session| Duplicate context; prunable                |
| Exploring unrelated modules "just in case"| Context bloat with zero signal             |
| Using `ls` to find a specific function    | Wrong tool; use grep                       |
