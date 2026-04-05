---
name: verification-loop
description: Load when setting up quality gates, defining done criteria, running the full verification pipeline, or when asked "is this ready to merge", "verify this", "run the full check".
---

# Verification Loop

## Gate Sequence

```
1. COMPILE / TYPE-CHECK   → no build errors
2. UNIT TESTS             → all pass, coverage ≥ threshold
3. INTEGRATION TESTS      → all pass
4. COVERAGE GATE          → meets per-scope requirements
5. SECURITY SCAN          → no high/critical findings
```

**Never advance past a red gate.** Fix the current gate before proceeding.

---

## Per-Gate Criteria & Failure Actions

| Gate             | Pass Criteria                           | On Failure                                    |
|------------------|-----------------------------------------|-----------------------------------------------|
| Compile          | Zero errors, zero type errors           | Fix all errors before running any tests       |
| Unit tests       | 100% of tests pass                      | Fix failing tests; never skip or comment out  |
| Integration tests| 100% pass; no external state leakage    | Isolate and fix; check test ordering issues   |
| Coverage         | ≥80% general; 100% auth/payments/sec    | Add missing tests; do not lower thresholds    |
| Security scan    | No high/critical CVEs; no secrets       | Patch dependency or apply fix before merge    |

---

## Commands by Stack

### Node / TypeScript
```bash
# 1. Type-check
npx tsc --noEmit

# 2 & 3. Tests + coverage
npx jest --runInBand --coverage

# 4. Coverage gate (fails build if below threshold)
# Configure in jest.config.ts:
# coverageThreshold: { global: { lines: 80 } }

# 5. Security scan
npm audit --audit-level=high
npx snyk test          # if Snyk is configured
```

### Python
```bash
# 1. Type-check
mypy src --strict

# 2 & 3. Tests + coverage
pytest --cov=src --cov-fail-under=80 --cov-report=term-missing -x

# 5. Security scan
pip-audit
bandit -r src -ll
```

### Go
```bash
# 1. Compile
go build ./...

# 2 & 3. Tests + coverage
go test ./... -race -coverprofile=coverage.out
go tool cover -func=coverage.out | grep total

# 5. Security scan
govulncheck ./...
```

---

## Definition of Done Checklist

Before marking any task complete or opening a PR, confirm:

- [ ] All 5 gates pass locally
- [ ] PR has at least one approval
- [ ] No `TODO` / `FIXME` without a linked ticket
- [ ] Public API changes reflected in docs / OpenAPI spec
- [ ] No hardcoded secrets, credentials, or test API keys
- [ ] Environment variables documented in `.env.example`
- [ ] Migration files (if any) are reversible and tested
- [ ] Observability: new code paths have logs/metrics/traces where appropriate

---

## CI Integration Pattern

```yaml
# Enforce gate order in CI — each step must pass before next runs
jobs:
  verify:
    steps:
      - name: Type check
        run: npx tsc --noEmit
      - name: Unit + integration tests
        run: npx jest --coverage
      - name: Security audit
        run: npm audit --audit-level=high
```

---

## Rules

- A passing test suite with coverage below threshold is a **failing gate**.
- `--passWithNoTests` is forbidden in CI configurations.
- Security scan failures block merge even if all tests pass.
- The loop runs in order — skipping gates is not allowed under time pressure.
- If a gate is too slow, optimise it; do not skip it.
