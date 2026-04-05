---
name: debugging-playbook
description: Load when diagnosing bugs, mysterious failures, performance issues, or when asked to "debug this", "why is this failing", "what's wrong", or investigating an error.
---

# Debugging Playbook

## Process

1. **Read the full error message** — the answer is usually in the stack trace
2. **Reproduce the failure consistently** — a non-reproducible bug cannot be debugged
3. **Isolate: bisect to the smallest failing case**
4. **Form a hypothesis** — then test it, don't assume
5. **Fix the root cause**, not the symptom

## Step 1 — Read the Error

```
TypeError: Cannot read properties of undefined (reading 'id')
    at UserCard (UserCard.tsx:24:18)
    at renderWithHooks (react-dom.development.js:14985)
```

- Start at the **top of your own code** in the stack trace (not library internals)
- Line `UserCard.tsx:24` — go there first
- `undefined.id` means `user` is `undefined` — not that `id` is wrong

## Error Classification

| Type | Symptoms | Detection approach |
|---|---|---|
| Syntax error | Won't compile/start | Compiler output, linter |
| Runtime error | Crashes with exception | Stack trace, error logs |
| Logic error | Wrong output, no crash | Unit test the specific function |
| Async error | Intermittent, race condition | Add logging at each async boundary |
| Type error (TS) | `undefined is not...` | Check all nullable paths |

## Common Pitfalls by Stack

### TypeScript / Node
```typescript
// Missing await — common source of "undefined" bugs
const user = getUser(id);  // forgot await — user is Promise, not User
console.log(user.name);    // TypeError: cannot read 'name' of Promise {}

// Stale closure in React
function Timer() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      console.log(count); // always logs 0 — stale closure
      setCount(count + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // missing `count` dependency
}
```

### Python
```python
# Blocking I/O in async function — event loop stalls
async def handler():
    time.sleep(5)          # blocks the event loop
    await asyncio.sleep(5) # correct

# Mutable default argument — shared across calls
def add_item(item, lst=[]):  # lst is shared!
    lst.append(item)
    return lst
```

### Go
```go
// Goroutine leak — goroutine blocks forever
go func() {
    result := <-ch  // blocks forever if nobody sends
}()

// Nil pointer dereference
var user *User
fmt.Println(user.Name)  // panic: nil pointer dereference
// Always check: if user == nil { return ErrNotFound }
```

## Logging Strategy

```typescript
// Log at boundaries, not internals
// GOOD — log at service entry/exit and on errors
async function createOrder(dto: CreateOrderDto): Promise<Order> {
  logger.info({ dto }, 'creating order');
  try {
    const order = await orderRepo.create(dto);
    logger.info({ orderId: order.id }, 'order created');
    return order;
  } catch (err) {
    logger.error({ err, dto }, 'failed to create order');
    throw err;
  }
}

// Correlation IDs — trace a request across services
app.use((req, _res, next) => {
  req.correlationId = req.headers['x-correlation-id'] ?? crypto.randomUUID();
  logger.child({ correlationId: req.correlationId });
  next();
});
```

## Binary Search / Bisect Technique

```bash
# Git bisect — find the commit that introduced a bug
git bisect start
git bisect bad                      # current commit is broken
git bisect good v2.3.0              # last known good tag
# git checks out a midpoint commit
# test it, then:
git bisect good                     # or git bisect bad
# repeat until git identifies the culprit commit
git bisect reset
```

**Comment-out bisect:** comment half the code path, determine which half has the bug, repeat. Works when git bisect isn't applicable.

**Minimal reproduction:** strip the problem to the fewest lines that still reproduce it. Often, building the minimal case reveals the bug.

## When to Escalate

Escalate after 3 failed hypotheses, or immediately if:
- The root cause appears to be in infrastructure, database, or a third-party service
- It's a production incident affecting users
- The bug requires understanding of a system you don't own
- You've been stuck for more than 2 hours without progress

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Guessing without reading the error | Wastes time, may fix wrong thing | Read the full stack trace first |
| Adding `console.log` everywhere | Noisy, hard to clean up | Add targeted logs at boundaries; use debugger |
| Fixing symptoms not root cause | Bug recurs in different form | Ask "why" until you reach the root |
| Debugging in production | Risk of impact, hard to reproduce | Reproduce locally or in staging |
| Not checking return values / error codes | Silent failures masked | Always check errors |
