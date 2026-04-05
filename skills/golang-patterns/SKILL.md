---
name: golang-patterns
description: Load when writing Go code, reviewing Go PRs, or asked about Go conventions, error handling, interfaces, concurrency, or project structure.
---

# Go Patterns

## Error Handling — Errors Are Values

```go
// Always check errors — never ignore with _
result, err := doSomething()
if err != nil {
    return fmt.Errorf("doSomething failed: %w", err) // wrap with context
}

// Sentinel errors — for comparison at call sites
var (
    ErrNotFound   = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
)

// Check sentinel errors with errors.Is (works through wrapping)
if errors.Is(err, ErrNotFound) {
    // handle not found
}

// Custom error types for structured info
type ValidationError struct {
    Field   string
    Message string
}
func (e *ValidationError) Error() string {
    return fmt.Sprintf("validation error on %s: %s", e.Field, e.Message)
}

var ve *ValidationError
if errors.As(err, &ve) {
    fmt.Println(ve.Field)
}
```

## Interfaces — Accept Interfaces, Return Structs

```go
// Define interface in the CONSUMER package, not the producer
// consumer/service.go
type UserStore interface {
    FindByID(ctx context.Context, id string) (*User, error)
    Save(ctx context.Context, user *User) error
}

type UserService struct {
    store UserStore // depends on interface, not concrete type
}

// Producer returns concrete type — callers decide if they need the interface
func NewPostgresUserStore(db *sql.DB) *PostgresUserStore {
    return &PostgresUserStore{db: db}
}
```

## Concurrency

```go
// Goroutines for I/O parallelism
func fetchAll(ctx context.Context, ids []string) ([]User, error) {
    var wg sync.WaitGroup
    results := make([]User, len(ids))
    errs := make([]error, len(ids))

    for i, id := range ids {
        wg.Add(1)
        go func(idx int, userID string) {
            defer wg.Done()
            results[idx], errs[idx] = fetchUser(ctx, userID)
        }(i, id)
    }
    wg.Wait()
    return results, errors.Join(errs...)
}

// Context for cancellation — always propagate
func (s *Service) Process(ctx context.Context, id string) error {
    user, err := s.store.FindByID(ctx, id) // ctx passed through
    if err != nil {
        return fmt.Errorf("finding user %s: %w", id, err)
    }
    _ = user
    return nil
}

// Channel for coordination — signal completion, pipeline stages
done := make(chan struct{})
go func() {
    defer close(done)
    doWork()
}()
select {
case <-done:
    // completed
case <-ctx.Done():
    return ctx.Err() // cancelled
}
```

## Project Structure

```
myapp/
  cmd/
    server/main.go      # main package — wire everything together
    worker/main.go
  internal/             # private — not importable by external packages
    user/
      service.go
      repository.go
      handler.go
  pkg/                  # reusable — safe for external import
    pagination/
    apierror/
  go.mod
  go.sum
```

## Testing — Table-Driven

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 1, 2, 3},
        {"negative", -1, -2, -3},
        {"zero", 0, 5, 5},
    }

    for _, tc := range tests {
        t.Run(tc.name, func(t *testing.T) {
            got := Add(tc.a, tc.b)
            if got != tc.expected {
                t.Errorf("Add(%d, %d) = %d, want %d", tc.a, tc.b, got, tc.expected)
            }
        })
    }
}

// Test helper — call t.Helper() to improve error location reporting
func requireNoError(t *testing.T, err error) {
    t.Helper()
    if err != nil {
        t.Fatalf("unexpected error: %v", err)
    }
}

// HTTP handler testing
func TestHandler(t *testing.T) {
    req := httptest.NewRequest(http.MethodGet, "/users/1", nil)
    rec := httptest.NewRecorder()
    handler.ServeHTTP(rec, req)
    if rec.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", rec.Code)
    }
}
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `panic` for recoverable errors | Crashes the process | Return `error` |
| Package-level `var state = map[...]...` | Race conditions, test pollution | Inject state via struct fields |
| `interface{}` / `any` in public API | Loses type safety | Use generics or concrete types |
| Goroutine without cancellation | Goroutine leak | Pass `context.Context`, select on `ctx.Done()` |
| Ignoring errors with `_` | Silent failures | Handle or explicitly document why ignored |
| Defining interface in producer package | Tight coupling | Interface in consumer package |
