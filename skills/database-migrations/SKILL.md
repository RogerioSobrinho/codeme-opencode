---
name: database-migrations
description: Load when writing database migrations, changing schema, adding/modifying tables, or asked about migration conventions, rollback strategies, or schema change safety.
---

# Database Migrations

## Migration Conventions

- Sequential versioning: `V001`, `V002`, `V003` — never `V001a` or re-use numbers
- **Never modify an existing migration** — if already run in any environment, create a new one
- Every migration must have a corresponding rollback (down migration)
- Migration file names: `V001__create_users_table.sql`, `V002__add_email_index.sql`
- Test both up and down migrations against a real database before merging

## Safe Schema Changes (Zero-Downtime)

### Adding a column

```sql
-- Step 1: Add nullable column (safe, backward-compatible)
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);

-- Step 2: Backfill existing rows (run as data migration, batch if large)
UPDATE users SET phone_number = '' WHERE phone_number IS NULL;

-- Step 3: Add NOT NULL constraint in a separate migration after backfill
ALTER TABLE users ALTER COLUMN phone_number SET NOT NULL;
```

### Adding an index

```sql
-- Use CONCURRENTLY — does not lock the table
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);
-- Note: CONCURRENTLY cannot run inside a transaction block
```

## Dangerous Operations

| Operation | Risk | Safe Alternative |
|---|---|---|
| `DROP TABLE` | Irreversible data loss | Rename first (`_deprecated`), drop after confirmed unused |
| `DROP COLUMN` | Irreversible data loss | Mark unused in code first, rename, then drop in later release |
| `NOT NULL` without default on populated table | Locks table | Add nullable → backfill → add constraint |
| `RENAME TABLE` / `RENAME COLUMN` | Breaks queries referencing old name | Add new column, migrate data, update code, drop old column |
| `ALTER COLUMN` type change | May lock or fail | Add new column with new type, migrate, swap |

## Data Migration vs Schema Migration

Keep them **separate**:

- **Schema migration**: structural changes (DDL) — `CREATE`, `ALTER`, `DROP`
- **Data migration**: data transformation (DML) — `UPDATE`, `INSERT`, `DELETE`

Run data migrations as background jobs for large tables to avoid timeouts and locks.

```sql
-- BAD: DDL + DML in same migration
ALTER TABLE orders ADD COLUMN total_cents INT;
UPDATE orders SET total_cents = total * 100;  -- could lock for hours on large tables

-- GOOD: separate migrations
-- V010__add_total_cents.sql
ALTER TABLE orders ADD COLUMN total_cents INT;

-- V011__backfill_total_cents.sql (run as batched job or separate process)
-- Handled by application code in batches of 1000
```

## Multi-Stack Migration Tools

| Stack | Tool | Config file |
|---|---|---|
| Java / Spring Boot | Flyway or Liquibase | `src/main/resources/db/migration/` |
| Python / FastAPI | Alembic | `alembic/versions/` |
| Go | golang-migrate | `migrations/` |
| Node.js / Prisma | Prisma Migrate | `prisma/migrations/` |
| Node.js / raw SQL | db-migrate, Knex | `migrations/` |

## Rollback Strategy

```bash
# Flyway
./mvnw flyway:undo

# Alembic
alembic downgrade -1

# golang-migrate
migrate -path ./migrations -database $DATABASE_URL down 1

# Prisma (no native down — maintain down SQL separately)
```

**Always verify:** the down migration actually restores the state cleanly in staging before touching production.

## Pre-Migration Checklist

- [ ] Migration tested locally against a copy of production data
- [ ] Down migration tested and verified
- [ ] Large table operations use `CONCURRENTLY` or batching
- [ ] Application code is backward-compatible with both old and new schema
- [ ] DBA or senior engineer reviewed for locking risks

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Modifying an existing migration | Causes checksum mismatch, diverged DBs | Create a new migration |
| DDL inside application startup code | Hard to version, bypasses migration tooling | Use migration files only |
| Assuming sequential execution in parallel deploys | Race condition on migration order | Use advisory locks (Flyway, Alembic handle this) |
| No down migration | Can't roll back a bad release | Write down migration for every up |
| Giant migrations that do many things | Hard to review, long lock times | One logical change per migration |
