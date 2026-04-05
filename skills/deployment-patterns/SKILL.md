---
name: deployment-patterns
description: Load when setting up deployment pipelines, discussing release strategies, or asked about blue/green, canary, feature flags, rollback, or environment management.
---

# Deployment Patterns

## Deployment Strategies

### Blue/Green — Instant Cutover

```
[Load Balancer]
     |         \
  [Blue]     [Green]   ← new version deployed here, health-checked
  (live)     (standby)

1. Deploy new version to Green
2. Run smoke tests against Green
3. Switch LB to Green (instant cutover)
4. Keep Blue alive for 15 min (instant rollback if needed)
5. Terminate Blue
```

- **Pros:** zero-downtime, instant rollback
- **Cons:** requires 2x infrastructure capacity during cutover

### Canary — Gradual Rollout

```
[Load Balancer]
  |         \
[Stable 90%]  [Canary 10%]  ← new version serves 10% of traffic

Monitor error rate, p99 latency for 30 min
→ If healthy: increase to 50% → 100%
→ If degraded: drop canary to 0%
```

- **Pros:** limits blast radius, real traffic validation
- **Cons:** both versions must handle same data schema simultaneously

### Rolling — Zero-Downtime Without Extra Capacity

```
v1 v1 v1 v1   →   v2 v1 v1 v1   →   v2 v2 v1 v1   →   v2 v2 v2 v2
```

- **Pros:** no extra capacity needed
- **Cons:** slow rollback, mixed versions simultaneously

## Feature Flags

Decouple deploy from release — ship code dark, release when ready.

```typescript
// Feature flag check — kills switch built in
if (featureFlags.isEnabled('new-checkout-flow', user.id)) {
  return newCheckoutFlow(cart);
}
return legacyCheckoutFlow(cart);
```

**Rules:**
- Every new feature behind a flag for the first release
- Kill switch tested before enabling in production
- Remove flag code within 2 weeks of 100% rollout
- Never use feature flags as permanent configuration

## Environment Management

```
dev → staging → production
```

- `dev`: local + shared dev database, relaxed config
- `staging`: mirrors production config, real secrets from secrets manager, used for QA
- `production`: protected, requires approval gate for deployment

```bash
# All config via environment variables — 12-factor
DATABASE_URL=postgres://...
REDIS_URL=redis://...
LOG_LEVEL=info
FEATURE_NEW_CHECKOUT=false

# Secrets via secrets manager — never in code or .env committed to git
aws secretsmanager get-secret-value --secret-id prod/app/database
```

## Zero-Downtime Deployment Checklist

- [ ] Health check endpoint (`/health`) returns 200 before traffic routes to new instance
- [ ] Graceful shutdown: drain in-flight requests, then exit (SIGTERM → drain → exit)
- [ ] Database migrations are backward-compatible with current running version
- [ ] No breaking API changes (add fields don't remove; version if breaking)
- [ ] Readiness probe configured in Kubernetes / load balancer

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  server.close(async () => {    // stop accepting new connections
    await drainInflightRequests();
    await db.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 30_000); // force exit after 30s
});
```

## Rollback Strategy

```bash
# Kubernetes — rollback to previous deployment
kubectl rollout undo deployment/myapp

# Docker Swarm
docker service update --image myapp:v1.2.3 myapp

# Maintain previous image tag for 72h — do not overwrite :latest immediately
# Tag strategy: myapp:v1.4.2, myapp:latest (always mutable), myapp:stable (last known good)
```

**Database rollback:** always verify the down migration works in staging before a risky migration.

## Observability During Deployment

Monitor these during and after every deployment:

| Signal | Threshold to trigger rollback |
|---|---|
| HTTP 5xx error rate | > 1% sustained over 2 min |
| p99 latency | > 2× baseline |
| Pod restart count | > 3 restarts in 5 min |
| Business metric (orders/min) | > 20% drop |

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Deploying directly to production without staging | No validation layer | Always stage → prod |
| No rollback plan | Stuck with bad release | Pre-tested rollback before every deploy |
| Backward-incompatible DB change + code deploy together | Old code fails against new schema | Two-phase: compatible schema first, then code |
| Secrets in application code or committed `.env` | Credential leak | Secrets manager (AWS SM, Vault, GCP SM) |
| Manual deployments with no audit trail | Untraceable changes | Automate and log all deployments |
| Overwriting `:latest` tag immediately | Can't roll back to previous image | Keep previous image tag for 72h |
