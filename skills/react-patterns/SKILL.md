---
name: react-patterns
description: Load when writing React components, reviewing React code, or asked about React hooks, state management, rendering optimization, or component patterns.
---

# React Patterns

## Component Patterns

### Presentational vs Container

```tsx
// Presentational — pure rendering, no data fetching
type UserCardProps = { name: string; email: string; onEdit: () => void };

function UserCard({ name, email, onEdit }: UserCardProps) {
  return (
    <div className="card">
      <h2>{name}</h2>
      <p>{email}</p>
      <button onClick={onEdit}>Edit</button>
    </div>
  );
}

// Container — data fetching, passes data down
function UserCardContainer({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId);
  if (isLoading) return <Spinner />;
  return <UserCard {...user} onEdit={() => openEditModal(userId)} />;
}
```

### Composition over inheritance

```tsx
// GOOD — compose via children/render props
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3>{title}</h3>{children}</div>;
}

// BAD — extending components
class SpecialPanel extends Panel { /* don't do this */ }
```

## State Management

| Scope | Tool |
|---|---|
| Single component | `useState` |
| Sibling components | Lift state to parent |
| Entire feature/page | `useReducer` + context |
| Cross-cutting (auth, theme) | Context + custom hook |
| Server state | React Query / SWR |

```tsx
// Lift state — share between siblings via parent
function Parent() {
  const [value, setValue] = useState('');
  return (
    <>
      <Input value={value} onChange={setValue} />
      <Preview value={value} />
    </>
  );
}
```

## Hook Patterns

```tsx
// Custom hook — encapsulate reusable logic
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// Stale closure prevention — use ref for callbacks in intervals/subscriptions
function useInterval(callback: () => void, delay: number) {
  const callbackRef = useRef(callback);
  useEffect(() => { callbackRef.current = callback; }, [callback]);
  useEffect(() => {
    const id = setInterval(() => callbackRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

### Hook rules
- Only call hooks at the top level — never inside loops, conditions, or nested functions
- Only call hooks from React functions or custom hooks
- Custom hooks must start with `use`

## Rendering Optimization

```tsx
// React.memo — only when props are stable (primitives or memoized references)
const UserRow = React.memo(function UserRow({ user, onSelect }: UserRowProps) {
  return <tr onClick={() => onSelect(user.id)}><td>{user.name}</td></tr>;
});

// useMemo — expensive calculations only
const sortedUsers = useMemo(
  () => [...users].sort((a, b) => a.name.localeCompare(b.name)),
  [users]
);

// useCallback — event handlers passed as props to memoized children
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []); // stable reference — no deps that change
```

## Error Handling

```tsx
// Error boundary — catch render errors
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error(error, info);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

// Suspense for async data
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <Suspense fallback={<Spinner />}>
        <UserList />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Prop drilling 3+ levels | Tight coupling, hard to refactor | Context or composition |
| `useEffect` to sync derived state | Causes extra renders | Derive during render |
| Inline object/array as prop | New reference every render, breaks memo | `useMemo` or move outside component |
| Missing `key` in lists | Incorrect reconciliation | Use stable unique ID, never index for dynamic lists |
| Hook inside condition | Violates hook rules, runtime error | Hoist condition inside hook |
| `useEffect` without cleanup | Memory leaks with subscriptions/timers | Return cleanup function |
