# TypeScript Rules — Type Safety and Correctness

Applied to all TypeScript and JavaScript (with JSDoc types) code.

## Type System

- `strict: true` in tsconfig. Non-negotiable.
- No `any`. Use `unknown` for truly unknown types, then narrow.
- No type assertions (`as Foo`) without a guard or documented justification.
- No `@ts-ignore` or `@ts-expect-error` without a comment explaining why.
- Prefer `interface` for object shapes that may be extended; `type` for unions, intersections, and aliases.
- Enums are banned — use `const` objects with `as const` and derive the type.
- Avoid `!` non-null assertion. Handle the null case explicitly.

## Functions

- All function parameters and return types must be explicitly typed.
- Async functions must return `Promise<T>` with a concrete `T`, not `Promise<any>`.
- Callbacks that can throw must be wrapped in try/catch or return `Result<T, E>`.
- Prefer `readonly` parameters for objects you do not mutate.

## Null Safety

- Never assume an optional value is present. Check with `?.` or explicit guard.
- `nullish coalescing` (`??`) over `||` when the value could be `0` or `''`.
- Functions that can fail return `T | null` or a `Result` type — never `undefined` for "not found".

## Async / Await

- Always `await` Promises. Floating promises are silent failures.
- `Promise.all` for independent concurrent tasks. `Promise.allSettled` when partial failures are acceptable.
- Never mix `.then().catch()` chains with `async/await` in the same function.
- `async` in a loop body (forEach) does not work as expected — use `for...of` with `await`.

## Imports and Modules

- Use ES module imports (`import`/`export`). No `require()` in TypeScript files.
- No default exports for utilities or services (named exports are easier to refactor).
- Barrel files (`index.ts`) are allowed for public API, not for internal modules.
- Import order: 1) node builtins, 2) external packages, 3) internal aliases, 4) relative paths.

## Classes and OOP

- Prefer composition over inheritance. More than 2 levels of inheritance is a smell.
- Constructor injection only. No property injection or service locator.
- `private` by default, `public` only when intentional.
- Avoid `abstract` classes when an interface + factory function achieves the same thing.

## React (when applicable)

- Functional components only. No class components.
- Props must be typed with explicit interfaces — no `React.FC` (it infers `children`).
- `useEffect` dependencies array must be complete. No suppressions.
- No direct DOM manipulation. Use refs only when unavoidable.
- State colocation: keep state as close to where it's used as possible.
- No prop drilling past 2 levels — use context or state management.

## Error Handling

- `catch (e)` blocks: always type-check before using `e`. Use `e instanceof Error`.
- Wrap third-party calls that can throw in a boundary with a typed error.
- Never swallow errors silently. Log or propagate.

## Tooling

- `eslint` with `@typescript-eslint` rules enabled.
- `prettier` for formatting — not a subject for review comments.
- `tsc --noEmit` must pass in CI as a type-check gate.
