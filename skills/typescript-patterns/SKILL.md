---
name: typescript-patterns
description: Load when writing TypeScript code, reviewing TypeScript PRs, or asked about TypeScript conventions, strict mode, generics, type guards, or async patterns.
---

# TypeScript Patterns

## Type Safety Rules

### Strict Mode — always enabled

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### No `any` — use `unknown` for external data

```typescript
// BAD
function parse(data: any) { return data.name; }

// GOOD
function parse(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'name' in data) {
    return String((data as { name: unknown }).name);
  }
  throw new Error('Invalid data shape');
}
```

### Branded types for IDs — prevent mixing up IDs

```typescript
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

function createUserId(id: string): UserId {
  return id as UserId;
}

// Now UserId and OrderId are not assignable to each other
function getUser(id: UserId) { /* ... */ }
```

## Type Guard Patterns

```typescript
// Type predicate guard
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// Exhaustive check for discriminated unions
type Shape = { kind: 'circle'; radius: number } | { kind: 'rect'; w: number; h: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case 'circle': return Math.PI * shape.radius ** 2;
    case 'rect':   return shape.w * shape.h;
    default: {
      const _exhaustive: never = shape;
      throw new Error(`Unhandled: ${_exhaustive}`);
    }
  }
}
```

## Async Patterns

```typescript
// GOOD — async/await throughout
async function fetchUser(id: UserId): Promise<Result<User, Error>> {
  try {
    const res = await fetch(`/api/users/${id}`);
    if (!res.ok) return { ok: false, error: new Error(res.statusText) };
    const data: unknown = await res.json();
    if (!isUser(data)) return { ok: false, error: new Error('Invalid shape') };
    return { ok: true, value: data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

// Result type — explicit error handling without exceptions
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

**Never mix `.then()` and `await`:**
```typescript
// BAD
const data = await fetch('/api').then(r => r.json());

// GOOD
const res = await fetch('/api');
const data: unknown = await res.json();
```

## React Patterns (TypeScript)

```typescript
// Typed props with children
type CardProps = {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
};

// useEffect dependency array — all referenced values must be listed
useEffect(() => {
  doSomething(userId); // userId must be in deps
}, [userId]);

// useMemo and useCallback with explicit return types
const sorted = useMemo<User[]>(() => [...users].sort(byName), [users]);
const handleClick = useCallback<React.MouseEventHandler>((e) => {
  e.preventDefault();
  onSelect(item.id);
}, [item.id, onSelect]);
```

## Module Patterns

```typescript
// Barrel export — index.ts re-exports public API
// src/features/user/index.ts
export { UserCard } from './UserCard';
export { useUser } from './useUser';
export type { User } from './types';
// Do NOT export internal helpers

// Prevent circular imports — no feature imports from another feature directly
// Use a shared/ layer for cross-feature types
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `data as User` on external data | Unsafe cast, no runtime check | Use type guard or Zod |
| `value!` non-null assertion | Crashes at runtime if null | Check explicitly |
| `any` in exported functions | Infects callers | Use `unknown` + guard |
| `enum Direction {}` | Emits JS, tree-shaking issues | Use `'left' \| 'right'` union |
| `interface` for unions | Doesn't model variants | Use discriminated union |
| Catching and ignoring errors | Silent failures | Log or propagate |
