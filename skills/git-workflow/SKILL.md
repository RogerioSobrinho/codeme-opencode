---
name: git-workflow
description: Load when committing code, creating branches, writing PR descriptions, or asked about git conventions, commit messages, branching strategy, or PR best practices.
---

# Git Workflow

## Conventional Commits

Format: `type(scope): subject`

```
feat(auth): add JWT refresh token support
fix(cart): correct total calculation when coupon applied
refactor(user): extract address validation to separate module
perf(search): add index on product name column
test(orders): add integration tests for checkout flow
docs(api): update OpenAPI spec for /orders endpoint
chore(deps): upgrade React to 18.3.0
```

### Type Reference

| Type | When to use |
|---|---|
| `feat` | New feature for the user |
| `fix` | Bug fix for the user |
| `refactor` | Code change that is not a feature or bug fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `chore` | Build, tooling, dependency updates |
| `ci` | CI/CD pipeline changes |

### Subject Rules

- Lowercase imperative mood: `add`, `fix`, `update` — not `Added`, `Fixes`, `Updating`
- Max 72 characters
- No period at the end
- If needed, add a blank line then a body paragraph for context

## Branch Naming

```bash
feature/TICKET-123-user-onboarding-flow
fix/TICKET-456-null-pointer-checkout
release/v2.4.0
hotfix/prod-payment-timeout
chore/upgrade-node-20
```

- Lowercase, hyphens only
- Include ticket number when applicable
- Short descriptive slug (3–5 words max)

## PR Guidelines

**One logical change per PR.** If a PR does two unrelated things, split it.

### PR Description Template

```markdown
## Summary
Brief description of what this PR does and why.

## Changes
- Added X to handle Y
- Refactored Z for clarity
- Updated tests for W

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Tested manually in staging

## Screenshots (if UI changes)
Before | After
```

### PR Size Guidelines

| Size | Lines changed | Guidance |
|---|---|---|
| Small | < 200 | Ideal |
| Medium | 200–500 | Acceptable with good description |
| Large | > 500 | Consider splitting; requires justification |

## Commit Atomicity

Each commit should represent one logical, working change:

```bash
# GOOD — atomic commits
git commit -m "feat(auth): add password hashing with bcrypt"
git commit -m "test(auth): add unit tests for password hashing"

# BAD — mixing concerns
git commit -m "fix auth and also refactor user service and update deps"
```

## Merge Strategy

| Branch type | Strategy |
|---|---|
| Feature branch → main | Squash merge |
| Release branch → main | Merge commit (preserves history) |
| Hotfix → main | Merge commit |

## Pre-Commit Checks

```bash
# Recommended pre-commit hooks (.husky/pre-commit or .pre-commit-config.yaml)
- No secrets or API keys (detect-secrets / gitleaks)
- No `console.log` / `print` / `fmt.Println` debug statements
- No TODO/FIXME without associated ticket number
- Build passes
- Tests pass (at minimum: unit tests)
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| Giant PRs (1000+ lines) | Impossible to review meaningfully | Split into smaller PRs |
| "WIP" or "fix stuff" commits in main | Meaningless history | Squash or rewrite before merging |
| Force-push to main/master | Destroys shared history | Only force-push to your own branches |
| Committing `.env` files | Secrets in version control | `.gitignore` + secrets manager |
| Rebasing shared branches | Rewrites history others depend on | Only rebase local, unshared branches |
| Skipping pre-commit hooks (`--no-verify`) | Bypasses safety checks | Fix the issue instead |
