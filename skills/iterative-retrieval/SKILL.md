---
name: iterative-retrieval
description: Load when navigating a large codebase (50+ files), when file reads are causing context overflow, or when exploration is slow and unfocused.
---

# Iterative Retrieval

## Core Principle: Grep Before Read

**Never read a file to find out what is in it. Search first, read only what you need.**

---

## Three-Layer Expansion

### Layer 1 — Structural Reconnaissance (no file reads)

```bash
# Understand the top-level shape
ls -1 src/
find src -name "*.ts" | head -40         # file inventory
grep -r "export class" src --include="*.ts" -l  # class locations
grep -r "export function" src --include="*.ts" -l

# Find entry points
grep -r "app.listen\|createServer\|bootstrap" src -l
grep -r "@Controller\|router\." src -l
```

### Layer 2 — Targeted Content Search

```bash
# Find the exact symbol
grep -r "createOrder" src --include="*.ts" -n
grep -r "class OrderService" src -n
grep -r "def create_order" src --include="*.py" -n

# Find usages
grep -r "new OrderService\|inject.*OrderService" src -n

# Find tests for a unit
grep -r "describe.*OrderService\|test.*create_order" src -n
```

### Layer 3 — Full File Read (justified only)

Read a full file only when:
- Layer 2 found the file and you need the surrounding implementation context.
- You are about to **edit** the file.
- The file is < 100 lines.

---

## Token Budget Guide

| Read scope                  | Approx. tokens | When justified                         |
|-----------------------------|----------------|----------------------------------------|
| `grep` for a symbol         | ~20            | Always — start here                    |
| Single method (20–40 lines) | ~200           | After grep confirms file + line number |
| Single class (100–200 lines)| ~800           | Before editing the class               |
| Full file (500+ lines)      | ~3,000+        | Rarely; only when full context needed  |
| Full package / directory    | ~10,000+       | Almost never; use grep instead         |

---

## Question-to-Grep-Pattern Table

| Question                                  | Grep pattern                                         |
|-------------------------------------------|------------------------------------------------------|
| Where is this function defined?           | `grep -r "function <name>\|def <name>" src -n`       |
| Where is this class used?                 | `grep -r "new <ClassName>\|<ClassName>(" src -n`     |
| Where are routes defined?                 | `grep -r "router\.\|@Get\|@Post\|app\.get" src -l`  |
| Where are env vars read?                  | `grep -r "process\.env\|os\.environ\|viper\.Get" . -n` |
| Where is the DB connection initialised?   | `grep -r "createConnection\|DataSource\|engine =" . -l` |
| Where are migrations?                     | `find . -path "*/migrations/*.ts" -o -path "*/migrations/*.py"` |
| Where are errors handled?                 | `grep -r "catch\|except\|handleError" src -n`        |

---

## Context Pruning Checklist

When context is filling up mid-exploration:

- [ ] Drop any file reads that produced no useful findings.
- [ ] Collapse repeated grep results to just file paths + line numbers.
- [ ] Keep only the methods you are actively editing, not full files.
- [ ] Replace explored-but-unchanged files with a one-line summary.

---

## Stop Conditions

Stop expanding and start implementing when:

1. You have found the file and function you need to modify.
2. You understand the input/output contract of the unit under change.
3. You know which tests cover it.

Do not continue exploring after these three conditions are met.

---

## Anti-Patterns

| Anti-pattern                                  | Cost                                      |
|-----------------------------------------------|-------------------------------------------|
| Reading full files to find a function         | 10–50x more tokens than a targeted grep   |
| Reading the same file twice in one session    | Duplicate context; prunable               |
| Exploring unrelated modules "just in case"    | Context bloat with zero signal            |
| Using `ls` to find a specific function        | Wrong tool; use grep                      |
| Reading test files before source files        | Inverted; read source first               |
