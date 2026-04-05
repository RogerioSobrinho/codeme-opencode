---
name: python-patterns
description: Load when writing Python code, reviewing Python PRs, or asked about Python conventions, async patterns, FastAPI, SQLAlchemy, or type hints.
---

# Python Patterns

## Type Hints

All public functions must have full type annotations. Use `from __future__ import annotations` for forward references.

```python
from __future__ import annotations
from typing import Optional, Sequence
from pydantic import BaseModel

# GOOD — annotated, explicit
def get_user(user_id: int) -> Optional[User]:
    ...

# BAD — no annotations
def get_user(user_id):
    ...

# Pydantic for all external/untrusted data
class CreateUserRequest(BaseModel):
    name: str
    email: str
    age: int

    model_config = {"str_strip_whitespace": True}
```

## Async Patterns

```python
import asyncio
import httpx

# GOOD — async for all I/O-bound operations
async def fetch_user(user_id: int) -> User:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"/users/{user_id}")
        response.raise_for_status()
        return User.model_validate(response.json())

# Parallel I/O — asyncio.gather instead of sequential awaits
async def fetch_many(ids: list[int]) -> list[User]:
    return await asyncio.gather(*[fetch_user(i) for i in ids])

# NEVER block in async — use run_in_executor for CPU-bound work
import io
async def process_image(data: bytes) -> bytes:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_process, data)
```

## FastAPI Patterns

```python
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

app = FastAPI()

# Dependency injection — reusable, testable
async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session

# Request and response models separate from ORM models
class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    model_config = {"from_attributes": True}

@app.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    bg: BackgroundTasks = BackgroundTasks(),
) -> UserResponse:
    user = await user_service.create(db, body)
    bg.add_task(send_welcome_email, user.email)
    return UserResponse.model_validate(user)

# Global exception handler
@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})
```

## SQLAlchemy Patterns

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# GOOD — async session with context manager
async def get_by_id(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()

# Eager load to avoid N+1
from sqlalchemy.orm import selectinload

async def get_users_with_orders(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).options(selectinload(User.orders))
    )
    return list(result.scalars().all())
```

## Error Handling

```python
# Custom exception hierarchy
class AppError(Exception):
    def __init__(self, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code

class NotFoundError(AppError):
    def __init__(self, resource: str) -> None:
        super().__init__(f"{resource} not found", status_code=404)

class ValidationError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)

# NEVER bare except
# BAD
try:
    result = do_thing()
except:       # catches SystemExit, KeyboardInterrupt
    pass

# GOOD
try:
    result = do_thing()
except ValueError as e:
    raise ValidationError(str(e)) from e
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `time.sleep()` in `async def` | Blocks event loop | `await asyncio.sleep()` |
| `def func(items=[])` mutable default | Shared across calls | `def func(items=None): items = items or []` |
| Bare `except:` | Catches `SystemExit` | Always specify exception type |
| Global state (`module_level_list = []`) | Race conditions, test pollution | Dependency-inject state |
| `f"SELECT ... WHERE id={id}"` | SQL injection | Use parameterized queries |
| Sync ORM calls in async FastAPI | Blocks event loop | Use async SQLAlchemy |
