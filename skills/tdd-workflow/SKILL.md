---
name: tdd-workflow
description: Load when writing a new feature, fixing a bug, or refactoring code in any stack. Enforces the RED → GREEN → REFACTOR cycle with 80%+ coverage.
---

# TDD Workflow

## RED → GREEN → REFACTOR Cycle

```
RED    → Write a failing test that describes the desired behaviour.
GREEN  → Write the minimum code to make the test pass. No more.
REFACTOR → Clean up duplication, naming, structure — without changing behaviour.
```

Never write implementation code before a failing test exists.

---

## Coverage Requirements

| Scope                        | Minimum Coverage |
|------------------------------|-----------------|
| General application code     | 80%             |
| Auth / session / tokens      | 100%            |
| Payments / billing           | 100%            |
| Security-critical logic      | 100%            |
| Data migrations              | 90%             |

---

## TypeScript / Jest

### Naming convention
```
describe('<Unit>') > it('should <behaviour> when <condition>')
```

### Cycle example
```typescript
// RED — test first
it('should return 401 when token is expired', () => {
  const result = verifyToken('expired.token.here');
  expect(result.ok).toBe(false);
  expect(result.status).toBe(401);
});

// GREEN — minimum implementation
function verifyToken(token: string): { ok: boolean; status: number } {
  const decoded = jwt.verify(token, SECRET);  // throws if expired
  return { ok: true, status: 200 };
}

// REFACTOR — extract, rename, deduplicate
```

### Run coverage
```bash
npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'
```

---

## Python / pytest

### Naming convention
```
test_<unit>_<behaviour>_when_<condition>
```

### Cycle example
```python
# RED
def test_create_user_raises_when_email_already_exists(db):
    create_user(email="x@x.com")
    with pytest.raises(DuplicateEmailError):
        create_user(email="x@x.com")

# GREEN — minimum insert with unique constraint check
# REFACTOR — extract _user_exists helper
```

### Run coverage
```bash
pytest --cov=src --cov-fail-under=80 --cov-report=term-missing
```

---

## Go / testing

### Naming convention
```
TestUnitName_Behaviour_WhenCondition
```

### Cycle example
```go
// RED
func TestCreateOrder_ReturnsError_WhenStockIsZero(t *testing.T) {
    _, err := CreateOrder(productID, qty: 1, stock: 0)
    assert.ErrorIs(t, err, ErrOutOfStock)
}

// GREEN — minimum stock check in CreateOrder
// REFACTOR — table-driven tests, extract stock validator
```

### Table-driven tests (preferred in Go)
```go
tests := []struct {
    name    string
    stock   int
    wantErr error
}{
    {"zero stock", 0, ErrOutOfStock},
    {"positive stock", 5, nil},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) { ... })
}
```

### Run coverage
```bash
go test ./... -coverprofile=coverage.out && go tool cover -func=coverage.out
```

---

## Anti-Patterns

| Anti-pattern                          | Why it fails                                   |
|---------------------------------------|------------------------------------------------|
| Writing implementation before tests   | Tests become confirmatory, not exploratory     |
| Testing internal/private methods      | Couples tests to implementation details        |
| `time.Sleep` / `Thread.sleep` in tests| Flaky, slow; use fakes/mocks for time          |
| One giant test per function           | Obscures which behaviour failed                |
| Mocking everything                    | Tests don't reflect real integration behaviour |
| Skipping REFACTOR phase               | Accumulates technical debt inside tested code  |

---

## Rules

- The test file must exist and be RED before any implementation file is created or modified.
- A test that always passes is not a test — verify it fails first.
- If you can't write a test for a unit, the unit is probably too large: split it.
- Test behaviour, not implementation. Rename a variable → zero test changes.
- Flaky tests must be fixed before merging; never add `--ignore-flaky`.
