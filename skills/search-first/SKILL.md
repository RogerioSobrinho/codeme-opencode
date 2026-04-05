---
name: search-first
description: Load before implementing any new class, service, or utility function. Apply the grep-before-write rule. Especially relevant when the request involves "add a", "create a", "implement", "write a method for", "build a new".
---

# Search First

## The Grep-Before-Write Rule

> Before writing any new utility, service, class, or function — search the codebase for an existing one.

Writing duplicate code is never faster. The maintenance cost compounds immediately.

---

## 5-Layer Search Order

Search each layer before moving to the next. Stop at the first layer that satisfies the need.

```
1. CODEBASE          → already solved here?
2. INSTALLED DEPS    → already in package.json / requirements.txt / go.mod?
3. FRAMEWORK         → built into the framework being used?
4. STDLIB            → built into the language standard library?
5. EXTERNAL LIBRARY  → justified addition with cost/benefit check?
```

---

## Layer 1 — Search the Codebase

```bash
# Search for similar functionality by keyword
grep -r "formatDate\|parseDate\|toISO" src --include="*.ts" -l
grep -r "slugify\|to_slug\|kebab" src -n
grep -r "class.*Repository\|class.*Service" src -l

# Search for the concept (not just the exact name)
grep -r "paginate\|cursor\|offset.*limit" src -n
grep -r "retry\|backoff\|exponential" src -n
```

---

## Layer 2 — Check Installed Dependencies

```bash
# Node
cat package.json | grep -i "date\|format\|util\|string"
node -e "const x = require('lodash'); console.log(Object.keys(x))"

# Python
pip show [package] | grep -i location
python -c "import [package]; help([package])"

# Go
cat go.mod
go doc [package]
```

---

## Layer 3 — Framework Built-ins

Check the framework docs or source before installing a new library:

| Framework / stack | Common built-ins people re-implement        |
|-------------------|---------------------------------------------|
| NestJS            | `@nestjs/common` pipes, guards, interceptors |
| Django            | `django.utils`, `django.contrib.auth`       |
| Spring Boot       | `StringUtils`, `CollectionUtils`, `BeanUtils`|
| Go stdlib         | `strings`, `strconv`, `time`, `net/http`    |
| React             | `useReducer`, `useCallback`, `Suspense`     |

---

## Layer 4 — Standard Library

```bash
# Node
node -e "const fs = require('fs'); console.log(Object.keys(fs))"
node -e "const crypto = require('crypto'); console.log(crypto.randomUUID())"

# Python
python -c "import datetime; help(datetime.datetime)"

# Go
go doc strings
go doc crypto/rand
```

---

## Layer 5 — External Library (Last Resort)

Before adding a dependency, verify:

- [ ] Is it actively maintained? (last commit < 6 months)
- [ ] Does it have security vulnerabilities? (`npm audit` / `pip-audit` / `govulncheck`)
- [ ] Is the bundle/binary size acceptable?
- [ ] Is the license compatible?
- [ ] Does it solve the problem significantly better than writing 20 lines of code?

If adding the dep passes the checklist, document the decision in an ADR.

---

## Anti-Patterns Hall of Shame

| What was written          | What should have been used                              |
|---------------------------|---------------------------------------------------------|
| Custom `deepEqual()`      | `assert.deepStrictEqual` (Node) / `==` with `reflect.DeepEqual` (Go) |
| Custom `generateUUID()`   | `crypto.randomUUID()` (Node) / `uuid.New()` (Go)       |
| Custom `retry()` loop     | `tenacity` (Python) / existing retry util in the repo   |
| Custom `slugify()`        | `slugify` package already in package.json               |
| Custom `formatCurrency()` | `Intl.NumberFormat` (JS stdlib)                         |
| Custom JWT parser         | Already-installed `jsonwebtoken` or `jose`              |
| Custom `groupBy()`        | `Array.prototype.reduce` / `_.groupBy` already imported |
| Custom HTTP client        | `fetch` (Node 18+) / `requests` (Python) / `net/http` (Go) |

---

## Quick Decision Rule

```
Ask: "Can I write this in < 20 lines with no edge cases?"
  YES → write it inline if truly trivial; otherwise search layers 1–4 first.
  NO  → this is non-trivial; you almost certainly shouldn't write it from scratch.
```

---

## Rules

- Never duplicate a function that already exists in the same codebase.
- Never install a new dependency to replace < 30 lines of stdlib code.
- If Layer 1 returns a match, read it before concluding it doesn't fit — it usually does.
- Wrapper functions that add zero behaviour are not a justification to duplicate logic.
