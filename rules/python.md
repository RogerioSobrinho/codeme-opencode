# Python Rules — Correctness and Idioms

Applied to all Python 3.10+ code.

## Type Annotations

- All function signatures must have type annotations (parameters and return type).
- No `Any` in Pydantic models or function signatures without justification.
- Use `X | None` (union syntax, Python 3.10+) over `Optional[X]`.
- Use `from __future__ import annotations` for forward references in older codebases.
- `mypy --strict` must pass. No `type: ignore` without a comment.

## Functions and Classes

- Functions do one thing. If you need a docstring paragraph to explain what, split it.
- Dataclasses or Pydantic models for structured data. No raw dicts as function arguments.
- `@dataclass(frozen=True)` for value objects. Immutability by default.
- `__slots__` for performance-sensitive classes instantiated frequently.
- `classmethod` for factory methods. `staticmethod` only when the function has no access to the class.

## Async (asyncio / FastAPI)

- Never call blocking I/O in an async function. Use `asyncio.to_thread` or `run_in_executor`.
- `await asyncio.gather()` for concurrent async tasks.
- Set timeouts on all awaitable I/O. Nothing waits forever.
- `async with` for async context managers (DB sessions, HTTP clients).
- Avoid mixing sync and async in the same layer.

## Error Handling

- Use specific exceptions, not bare `except:` or `except Exception:` without re-raising.
- Custom exceptions inherit from a project-level base exception.
- `raise ... from err` to chain exceptions and preserve context.
- Never swallow exceptions silently. Log at minimum.
- FastAPI: use `HTTPException` for client errors, middleware for unexpected server errors.

## Imports

- Import order (PEP 8): stdlib → third-party → local. Separated by blank lines.
- No wildcard imports (`from module import *`).
- Use absolute imports. Relative imports are allowed only within the same package.
- Lazy imports inside functions are allowed for optional heavy dependencies.

## Null Safety

- Return `T | None` and document it. Callers must handle `None`.
- Use `Optional` parameters sparingly. Prefer overloaded functions or `**kwargs` with defaults.
- Never return `None` to signal an error. Raise an exception or return a `Result` type.

## Testing (Python-specific)

- `pytest` as test runner. `unittest` is acceptable for legacy code.
- Fixtures for setup/teardown, not `setUp`/`tearDown` methods.
- `pytest.mark.asyncio` for async tests.
- `httpx.AsyncClient` for FastAPI endpoint testing (not `TestClient` in async contexts).
- `Testcontainers` for real DB integration tests.

## Packaging

- `pyproject.toml` as the single source of truth for metadata and dependencies.
- Pin direct dependencies. Lockfile (`poetry.lock` / `uv.lock`) committed to git.
- Virtual environment must not be committed. Add to `.gitignore`.
- Separate `dev` dependencies from production ones.

## Security (Python-specific)

- No f-string SQL queries. Use parameterized queries via SQLAlchemy or `psycopg`.
- No `eval()`, `exec()`, or `pickle.loads()` with untrusted data.
- `subprocess` calls must use a list of args, never a shell string.
- Validate and sanitize all user input before use in queries, commands, or templates.

## Tooling

- `ruff` for linting and formatting (replaces flake8 + black + isort).
- `mypy` for type checking.
- Pre-commit hooks: `ruff`, `mypy`, `pytest` (fast tests only).
