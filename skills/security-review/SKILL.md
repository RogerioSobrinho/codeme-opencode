---
name: security-review
description: Load when reviewing code for security vulnerabilities, before merging auth/payment/data code, auditing dependencies, or when asked about OWASP, injection, access control, or secrets management.
---

# Security Review

## OWASP Top 10 Quick Reference

| # | Category                        | Detection pattern                                              |
|---|---------------------------------|----------------------------------------------------------------|
| 1 | Broken Access Control           | Missing ownership check; `isAdmin` client-side; IDOR          |
| 2 | Cryptographic Failures          | Plaintext secrets; MD5/SHA1 for passwords; no TLS             |
| 3 | Injection                       | Raw SQL concat; `eval()`; unsanitised shell args              |
| 4 | Insecure Design                 | No rate limiting; no account lockout; missing audit log        |
| 5 | Security Misconfiguration       | Debug mode on; default credentials; permissive CORS           |
| 6 | Vulnerable Components           | Outdated deps with CVEs; unlocked version ranges              |
| 7 | Auth/Identity Failures          | Predictable session IDs; missing MFA for sensitive ops        |
| 8 | Data Integrity Failures         | No signature verification; unsafe deserialization             |
| 9 | Logging/Monitoring Failures     | No audit trail; PII in logs; silent auth failures             |
|10 | SSRF                            | User-controlled URLs fetched server-side without validation   |

---

## Input Validation Checklist

- [ ] All external input validated at the boundary (not deep in business logic).
- [ ] Parameterised queries / ORM used — no raw SQL string concatenation.
- [ ] File upload: validate MIME type by magic bytes, not extension; enforce size limit.
- [ ] No `eval()`, `exec()`, or `Function()` with user input.
- [ ] HTML output escaped; Content-Security-Policy header set.
- [ ] URL parameters validated before use in file paths or DB queries.
- [ ] JSON schema validation on all request bodies.

---

## Authentication Review Checklist

- [ ] Passwords hashed with bcrypt / argon2 / scrypt (cost factor ≥ 12 for bcrypt).
- [ ] JWT secret is >= 256 bits; RS256/ES256 preferred over HS256 for distributed systems.
- [ ] Access tokens expire ≤ 15 minutes; refresh tokens ≤ 7 days.
- [ ] Refresh token rotation on use; old token invalidated immediately.
- [ ] Tokens stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies — not localStorage.
- [ ] Failed login attempts rate-limited and logged.
- [ ] Account lockout after N failures (with unlock path).

---

## Authorization Review

- [ ] Every endpoint checks: is the requester **authenticated**?
- [ ] Every data operation checks: does the requester **own** this resource?
- [ ] Role checks happen server-side, never trust client-sent role claims.
- [ ] Admin endpoints protected by explicit role guard, not just by obscurity.
- [ ] Object-level authorization: `SELECT ... WHERE id = ? AND owner_id = ?`

```typescript
// BAD — fetches any order by ID
const order = await orderRepo.findOne(req.params.id);

// GOOD — scoped to authenticated user
const order = await orderRepo.findOne({
  where: { id: req.params.id, userId: req.user.id }
});
```

---

## Secrets Management Rules

- [ ] No secrets in source code, ever.
- [ ] No secrets in git history (run `git log -S '<secret>'` to check).
- [ ] `.env` files in `.gitignore`; only `.env.example` committed.
- [ ] Secrets loaded from environment variables or a secrets manager (Vault, AWS SSM, GCP Secret Manager).
- [ ] Rotate secrets after any suspected exposure.
- [ ] Different secrets per environment (dev ≠ staging ≠ prod).

```bash
# Check for accidentally committed secrets
git log --all --full-history -- .env
grep -r "password\s*=\s*['\"][^$]" . --include="*.ts" --include="*.py"
```

---

## Dependency Audit Commands

```bash
# Node
npm audit --audit-level=high
npx better-npm-audit audit

# Python
pip-audit
safety check

# Go
govulncheck ./...

# All stacks — Snyk (if configured)
snyk test
```

---

## PII Handling Rules

- [ ] PII not logged (names, emails, phone numbers, payment data).
- [ ] PII encrypted at rest (database-level or field-level for sensitive columns).
- [ ] PII not in URLs (query params get logged by proxies/CDNs).
- [ ] Data retention policy defined; stale PII purged.
- [ ] GDPR/CCPA deletion request path exists.

---

## Security-Critical Code Coverage

| Scope                          | Required coverage |
|--------------------------------|-------------------|
| Auth flows (login/logout/token)| 100%              |
| Payment processing             | 100%              |
| Access control / authorization | 100%              |
| Data encryption/decryption     | 100%              |
| Input validation for external data | 100%         |

---

## Anti-Patterns

| Anti-pattern                              | Risk                                          |
|-------------------------------------------|-----------------------------------------------|
| `if (role === 'admin')` on the client     | Trivially bypassed                            |
| Returning stack traces in API errors      | Reveals internal structure to attackers       |
| Using MD5/SHA1 for password hashing       | Rainbow table attacks; computationally cheap  |
| `SELECT *` then filtering in application  | Leaks columns that should not be accessible   |
| Hardcoded API keys in source              | Permanent credential exposure via git history |
| Logging `request.body` in auth endpoints  | PII + credentials in logs                     |
