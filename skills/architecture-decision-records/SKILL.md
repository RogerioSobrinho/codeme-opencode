---
name: architecture-decision-records
description: Load when documenting an architecture decision, creating an ADR, or asked about ADR format, when to write an ADR, or how to capture a design decision.
---

# Architecture Decision Records (ADRs)

## When to Write an ADR

Write an ADR when the decision:
- Introduces a new technology or major library
- Establishes a significant architectural pattern affecting the whole team
- Will be hard or costly to reverse
- Replaces or contradicts a previous decision
- Would make a future developer ask "why did they do it this way?"

**Do NOT write an ADR for:** routine implementation choices, library version bumps, minor refactors.

## ADR Template

```markdown
# ADR-001: Use PostgreSQL as the primary database

**Date:** 2026-01-15
**Status:** Accepted

## Context
We need a persistent store for user and order data. The team evaluated relational
and document stores. Data has strong relational structure (users → orders → items).
We have existing team expertise in SQL. Expected scale: 10M rows within 2 years.

## Decision
Use PostgreSQL 16 as the primary operational database.

## Options Considered

### Option A: PostgreSQL
- **Pros:** ACID compliance, strong typing, rich query capabilities, team familiarity,
  excellent ecosystem (pgvector, PostGIS if needed later)
- **Cons:** Horizontal write scaling requires additional tooling (Citus, partitioning)

### Option B: MongoDB
- **Pros:** Flexible schema for early-stage iteration, horizontal scaling built in
- **Cons:** Weak transactional guarantees across documents, team lacks expertise,
  our data is inherently relational

### Option C: DynamoDB
- **Pros:** Managed, scales to infinite writes
- **Cons:** Access pattern must be defined upfront, complex querying, high cost at low scale

## Consequences
- **Positive:** Familiar tooling, strong data integrity, good ORM support (SQLAlchemy, Prisma)
- **Negative:** Vertical scaling is the primary scale-up path; will revisit if write throughput
  exceeds 10k TPS
- **Risks:** Schema migrations require care at scale — mitigation: adopt Flyway from day one
- **Implementation:** Use connection pooling (PgBouncer) from the start; configure
  `statement_timeout` and `idle_in_transaction_session_timeout`

## Implementation Notes
- All migrations via Flyway; no schema changes outside of migrations
- Use `TIMESTAMPTZ` for all timestamps
- Revisit this decision at 1M rows/month write throughput
```

## File Naming and Storage

```
docs/adr/
  ADR-001-use-postgresql-as-primary-database.md
  ADR-002-adopt-event-driven-architecture-for-notifications.md
  ADR-003-replace-rest-with-graphql-for-mobile-api.md
```

- Zero-padded three-digit number: `ADR-001`, `ADR-002`
- Lowercase hyphenated slug describing the decision
- Stored in `docs/adr/` at the repo root
- Committed to version control alongside the code

## Status Lifecycle

```
Proposed → Accepted → Deprecated → Superseded by ADR-N
```

| Status | Meaning |
|---|---|
| `Proposed` | Under discussion, not yet agreed |
| `Accepted` | Team agreed, in effect |
| `Deprecated` | No longer recommended but not replaced |
| `Superseded by ADR-007` | Replaced by a newer decision |

Update the status in the file when it changes — never delete old ADRs.

## ADR Quality Checklist

- [ ] Context explains the **constraints and forces** that drove the decision
- [ ] The decision statement is **unambiguous** — someone new could implement it
- [ ] At least **two alternatives** were considered with real pros and cons
- [ ] Consequences include **negatives and risks**, not just positives
- [ ] Status is set (not left blank)
- [ ] The ADR is linked from the relevant code module's README or PR

## Linking ADRs to Code

```typescript
/**
 * Event bus implementation.
 * See docs/adr/ADR-004-use-redis-pubsub-for-events.md for why Redis was chosen
 * over RabbitMQ and Kafka.
 */
export class EventBus { ... }
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| ADR with no rejected alternatives | Looks like a rubber stamp, hides trade-offs | Document at least 2 real options with real trade-offs |
| ADR written months after the decision | Context is lost, forces are forgotten | Write while the decision is being made |
| Status permanently `Proposed` | No accountability, unclear if adopted | Set to `Accepted` or `Rejected` within 2 weeks |
| Vague decision ("we will use microservices") | Unactionable | Be specific: what, scope, boundaries |
| ADR in a wiki instead of version control | Becomes disconnected from code history | Store in `docs/adr/` in the repo |
