# Security Rules — Defense in Depth

Applied to all code that handles input, authentication, authorization, data, or external systems.

## Input Validation

- Validate all external input at the entry point (HTTP, CLI, message queue, file). Never trust it downstream.
- Validation must be explicit: allowlist known-good values, reject everything else.
- Input length limits. Reject oversized payloads before processing.
- Sanitize before rendering in HTML (XSS). Escape before embedding in SQL/shell (injection).
- File uploads: validate MIME type server-side (not just extension), scan if possible, store outside webroot.

## Authentication

- Passwords must be hashed with bcrypt, argon2, or scrypt. Never MD5/SHA1/plain.
- Tokens (JWT, session) must be signed and verified on every request.
- Token expiry must be enforced. Short-lived access tokens + refresh tokens.
- Brute-force protection: rate-limit login endpoints. Lock accounts after N failures.
- Sensitive flows (password reset, email change) require re-authentication.

## Authorization

- Default deny. A user must have explicit permission to access a resource.
- Authorization checks belong in the service layer — not just the HTTP handler.
- Validate ownership. A user fetching `/orders/42` must own order 42.
- Row-level security for multi-tenant data. Tenant ID must be part of every query.
- Privilege escalation must require explicit admin approval, not just a role change.

## Secrets Management

- No secrets in source code, config files, or environment files committed to git.
- Use a secrets manager (Vault, AWS Secrets Manager, GCP Secret Manager) or environment injection at deploy time.
- Rotate secrets on any suspected compromise. Automate rotation for critical credentials.
- Audit access to secrets. Log who read what and when.

## SQL and Injection

- Always use parameterized queries / prepared statements. Never string-concatenate SQL.
- ORM query builders are acceptable only if they produce parameterized queries under the hood.
- NoSQL: validate and sanitize document fields. MongoDB operators in input are injection vectors.
- Shell commands: avoid `exec(user_input)`. Use argument arrays, never shell interpolation.

## Data Protection

- PII must be identified, labeled, and subject to access controls.
- Data at rest: encrypt sensitive fields (not just the disk). Use field-level encryption for high-value data.
- Data in transit: TLS 1.2+ mandatory. Never HTTP for authenticated or sensitive traffic.
- Data retention: define and enforce retention periods. Delete or anonymize expired data.
- Log minimization: do not log tokens, passwords, card numbers, SSN, or full PII.

## Dependencies

- Run `npm audit` / `pip-audit` / `mvn dependency:check` / `go list -m -json all | nancy` on every build.
- No direct use of packages with known CRITICAL CVEs.
- Pin dependency versions in production. Lock files must be committed.
- Unused dependencies must be removed.

## HTTP Security Headers

- `Content-Security-Policy` — restrict script sources.
- `X-Content-Type-Options: nosniff` — prevent MIME sniffing.
- `X-Frame-Options: DENY` or `SAMEORIGIN` — prevent clickjacking.
- `Strict-Transport-Security` — enforce HTTPS.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- Never expose server version in `Server` or `X-Powered-By` headers.

## Error Handling (Security)

- Never expose stack traces, internal paths, or DB errors to end users.
- Generic error messages to clients, detailed errors to server logs only.
- Log security events: failed auth, permission denied, input rejection, rate limit hits.
