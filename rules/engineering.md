# Engineering Rules — Software Design Principles

Applied to all implementation work. Complements core.md with design-level guidance.

## Architecture

- Separate concerns. Business logic must not live in HTTP handlers, CLI commands, or DB queries.
- Depend on abstractions (interfaces/protocols), not concrete implementations.
- New external dependencies require explicit justification. Prefer stdlib when reasonable.
- Circular dependencies are a design smell — break them at the boundary.
- Public API surface area should be as small as possible. Start private, expand when needed.

## Functions and Methods

- Max function length: ~50 lines before considering a split.
- Functions should have 1 level of abstraction. Mixing high-level orchestration with low-level details is a code smell.
- Avoid boolean parameters that flip behavior. Use two functions or an enum.
- Return early to reduce nesting. Guard clauses at the top, happy path at the bottom.
- Side effects must be explicit — pure functions preferred in domain logic.

## State Management

- Prefer immutability. Mutable state must be justified and clearly scoped.
- Shared mutable state across goroutines/threads requires explicit synchronization.
- Application state vs ephemeral state: keep them separate.

## Concurrency

- Prefer high-level abstractions (Promise.all, asyncio.gather, goroutines with channels) over manual thread management.
- Protect shared state. Race conditions are silent production bugs.
- Timeouts on all I/O operations. Nothing waits forever.
- Graceful shutdown: drain in-flight work before exit.

## Dependencies and I/O

- All I/O (network, disk, DB) belongs at the edge of the system — not in domain/business logic.
- Inject dependencies — do not instantiate them inside functions.
- DB queries must be paginated for collections that can grow unboundedly.
- Connection pools must be configured. Do not open unbounded connections.

## Observability

- Every significant operation should produce a structured log entry: what, who, outcome, duration.
- Metrics on critical paths: latency, error rate, throughput.
- Distributed tracing context (trace-id, span-id) must be propagated across service calls.
- Never log sensitive data (passwords, tokens, PII, card numbers).

## API Design

- REST: nouns in paths, HTTP verbs for actions. No verbs in paths (`/users`, not `/getUsers`).
- All APIs are versioned from day one. Breaking changes get a new version.
- Request and response schemas are documented. Use OpenAPI or equivalent.
- Pagination, filtering, and sorting are consistent across all collection endpoints.
- Idempotent operations use PUT/PATCH. Unsafe non-idempotent use POST.

## Refactoring

- Never refactor and add features in the same commit.
- Refactor only when tests are green. Refactoring with a failing test is risky.
- Boy Scout Rule: leave code slightly cleaner than you found it — but in proportion to the task.
