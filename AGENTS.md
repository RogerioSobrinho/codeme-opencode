# Project: {name}
# Location: AGENTS.md (repo root)
# Purpose: Shared agent context read by OpenCode, Claude Code, and any compatible AI coding agent.
#          Use this file for universal conventions visible to ALL agents and tools.
#          For OpenCode-specific config (agents, commands, skills), use .opencode/opencode.json
#
# Update this file when: core conventions change, architecture evolves, or a recurring mistake is discovered.
# Keep it short — this is a quick-start brief, not documentation.

---

# {Project Name}

## What This Project Does
{One paragraph: what the service/app does, who uses it, what problem it solves.}

## Tech Stack
- **Language**: {TypeScript / Python 3.12 / Java 21 / Go / ...}
- **Framework**: {Next.js / FastAPI / Spring Boot 3.x / Gin / ...}
- **Database**: {PostgreSQL / MySQL / MongoDB / Redis / ...}
- **Infra**: {Docker / Kubernetes / AWS / GCP / Vercel / ...}

## Architecture in One Paragraph
{Describe architectural style, layers, and key boundaries. Example:
"Hexagonal architecture. Domain layer has zero framework dependencies. Use cases in `application/`
call Port interfaces only. Controllers and adapters live in `infrastructure/`. No business logic
in controllers — they translate HTTP to use-case calls exclusively."}

## Absolute Rules (for any AI agent)

### Always
- {Rule 1 — e.g., "Constructor injection only — never field injection"}
- {Rule 2 — e.g., "All REST responses wrapped in ApiResponse<T>"}
- {Rule 3 — e.g., "DTOs are records/frozen dataclasses — never expose DB entities in responses"}
- {Rule 4 — e.g., "Migrations via tool (Flyway/Alembic) — no manual DDL"}
- {Rule 5 — e.g., "Strict TypeScript — no `any`, no `@ts-ignore`"}

### Never
- {Anti-pattern 1 — e.g., "No business logic in HTTP handlers or adapters"}
- {Anti-pattern 2 — e.g., "No hardcoded secrets — use environment variables"}
- {Anti-pattern 3 — e.g., "No direct DB access from domain layer"}
- {Anti-pattern 4 — e.g., "No force-push to main/master"}

## Testing
- {Test framework and style — e.g., "Jest + Supertest for API; Playwright for E2E"}
- {Naming convention — e.g., "`describe('UserService') > it('should throw when user not found')`"}
- {Coverage target — e.g., "80% line coverage on business logic"}
- {Test data — e.g., "Factory functions in `tests/factories/`. Never hard-coded objects."}

## Known Gotchas
{Recurring mistakes or non-obvious behaviors — update whenever you hit a new one:}
- {Gotcha 1 — e.g., "PaymentService has idempotency guards — do NOT add duplicate checks elsewhere"}
- {Gotcha 2 — e.g., "useEffect with empty deps runs once on mount — confirm this is intentional before adding deps"}

## Entry Points
- {Main entry — e.g., "API: `src/routes/index.ts` → `src/controllers/`"}
- {Config — e.g., "`src/config/index.ts` reads from environment variables"}
- {Tests — e.g., "Unit: `src/**/*.test.ts` | Integration: `tests/integration/` | E2E: `tests/e2e/`"}
