# Testing Rules — Quality Assurance Standards

Applied to all test code. Universal across TypeScript, Python, Java, and Go.

## Philosophy

- Tests are first-class code. They are maintained, refactored, and reviewed like production code.
- A test that never fails is not a test — it is false confidence.
- Test behavior, not implementation. Tests should not break when you refactor internals.
- Write the test you wish existed, then make it pass (TDD).

## Test Pyramid

- **Unit tests** (majority): pure functions, domain logic, algorithms. Fast, no I/O.
- **Integration tests** (moderate): DB queries, external API calls, message queues. Use real adapters (Testcontainers, in-memory DBs).
- **E2E tests** (few): critical user journeys only. Slow — run in CI, not on every save.

## Coverage

- Target: 80%+ line coverage for business logic.
- Coverage is a floor, not a goal. 80% bad tests < 60% meaningful tests.
- Coverage gaps in domain logic, error paths, and edge cases are not acceptable.
- Exclude: generated code, migrations, config files, trivial getters.

## Naming Conventions

- Test names describe behavior, not implementation:
  - Good: `should return 404 when user is not found`
  - Bad: `testGetUser`, `userService_test_3`
- Use consistent format: `<unit>_<context>_<expected>` or `given <context> when <action> then <outcome>`.

## Test Structure

- **Arrange / Act / Assert** (AAA) pattern. One blank line between sections.
- One logical assertion per test. Multiple `expect` calls on the same result are fine.
- No shared mutable state between tests. Each test must be independent and order-agnostic.
- `beforeEach`/`setUp` for setup, `afterEach`/`tearDown` for cleanup. Never leave side effects.

## Mocking and Faking

- Mock at architectural boundaries: external services, DBs, clocks, file systems.
- Do not mock what you own (your own domain classes). Use real instances.
- Prefer fakes (in-memory implementations) over mocks for complex collaborators.
- Never mock the system under test.
- Mock responses must be realistic. Returning `{}` for a typed response teaches nothing.

## Test Data

- Use factories or builders, not hard-coded objects repeated across tests.
- Randomize IDs and timestamps in factories — tests that rely on fixed values are fragile.
- Sensitive-looking test data (passwords, tokens) must be clearly fake (`test-token-xyz`, `hashed:bcrypt:test`).

## Async Testing

- Always `await` async assertions. An un-awaited promise assertion always passes.
- Set explicit timeouts on async tests. Never let them hang indefinitely.
- For event-driven flows, use `waitFor` or polling patterns — do not sleep.

## Test Isolation

- Unit tests must not touch the network, file system, or real DB.
- Integration tests use ephemeral resources (Testcontainers, temp dirs, in-memory).
- E2E tests run against a dedicated test environment, never production.

## Red Flags in Tests

- `// TODO: add test` is a bug.
- Tests that always pass regardless of production code are not tests.
- Tests with `try/catch` that catch expected errors and do nothing are not tests.
- `time.Sleep` / `Thread.sleep` in tests is a race condition waiting to happen.
- Tests longer than 80 lines usually need to be split.
