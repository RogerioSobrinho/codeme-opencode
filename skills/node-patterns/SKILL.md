---
name: node-patterns
description: Load when writing Node.js/Express/Fastify server code, or asked about middleware patterns, error handling, async patterns, or Node.js architecture.
---

# Node.js Patterns

## Architecture

```
src/
  routes/         # HTTP routing only — no business logic
  controllers/    # Request parsing, response shaping
  services/       # Business logic
  repositories/   # Database queries
  middleware/     # Cross-cutting: auth, logging, validation
  errors/         # Custom error classes
```

**Rule:** routes call controllers, controllers call services, services call repositories. No DB queries in routes or controllers.

## Custom Error Classes

```typescript
// src/errors/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}
```

## Global Error Handler

```typescript
// Express — place LAST after all routes
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const error = err instanceof AppError ? err : new AppError('Internal server error');
  logger.error({ err, path: req.path, method: req.method });
  res.status(error.statusCode).json({ error: error.message, code: error.code });
});

// Async wrapper — eliminates try/catch in every route
const asyncHandler = (fn: RequestHandler): RequestHandler =>
  (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Usage
router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await userService.findById(req.params.id);
  res.json(user);
}));
```

## Async Patterns

```typescript
// GOOD — async/await throughout
async function createOrder(dto: CreateOrderDto): Promise<Order> {
  const user = await userRepo.findById(dto.userId);
  if (!user) throw new NotFoundError('User');
  return orderRepo.create({ ...dto, createdAt: new Date() });
}

// Never mix callbacks and promises
// BAD
fs.readFile('file.txt', (err, data) => {
  somePromise().then(result => { /* ... */ });
});

// GOOD — use fs.promises
const data = await fs.promises.readFile('file.txt', 'utf-8');
```

## Environment Config

```typescript
// src/config.ts — validate all env vars at startup, fail fast
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

export const config = envSchema.parse(process.env);
// App crashes at startup if config is invalid — never silently use undefined
```

## Middleware Patterns

```typescript
// Authentication middleware
const authenticate: RequestHandler = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) throw new AppError('Unauthorized', 401);
  try {
    req.user = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    throw new AppError('Invalid token', 401);
  }
};

// Request validation with Zod
const validate = (schema: z.ZodSchema): RequestHandler => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) throw new ValidationError(result.error.message);
  req.body = result.data;
  next();
};
```

## Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    await db.end();
    process.exit(0);
  });
  // Force exit if cleanup takes too long
  setTimeout(() => process.exit(1), 10_000);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  process.exit(1); // fail loudly — never swallow
});
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Business logic in route handlers | Untestable, violates SRP | Move to service layer |
| `fs.readFileSync` in request handler | Blocks event loop | Use `fs.promises` |
| Unhandled promise rejections | Silent crash or zombie state | Global unhandledRejection handler |
| `process.env.VAR` scattered throughout | No validation, runtime surprises | Centralize in config.ts with Zod |
| Catching errors and swallowing them | Silent failures | Log and rethrow or respond with error |
| No timeout on external HTTP calls | Hangs indefinitely | Set timeout via AbortSignal |
