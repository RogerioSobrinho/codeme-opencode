---
description: Full security audit — OWASP Top 10, dependency CVEs, auth/authorization, input validation, secrets exposure.
agent: security-auditor
---

Perform a comprehensive security audit${ $ARGUMENTS ? ' focused on: ' + $ARGUMENTS : '' }.

Check for:
- Dependency CVEs (run audit tool if available: npm audit, pip-audit, etc.)
- OWASP Top 10 vulnerabilities
- Hardcoded secrets or API keys in source
- SQL/command injection vectors
- Authentication and authorization flaws
- Unsafe input handling (missing validation)
- PII exposure in logs or responses

Map every finding to an OWASP category (A01–A10) with severity (CRITICAL/HIGH/MEDIUM/LOW) and concrete fix.

End with overall posture: PASS / NEEDS IMPROVEMENT / FAIL
