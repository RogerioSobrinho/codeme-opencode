# Git Rules — Version Control Hygiene

Applied to all commit, branch, and pull request work.

## Commits

- Commit format: **Conventional Commits** — `<type>(<scope>): <subject>`
  - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, `build`, `revert`
  - Subject: imperative mood, lowercase, no period. Max 72 chars.
  - Body: explain *why*, not *what* (the diff shows what). Reference issue numbers.
- One logical change per commit. Do not mix features, fixes, and refactors.
- Tests must be in the same commit as the code they test.
- Generated files (build artifacts, lockfile updates from dep upgrades) go in a separate commit.
- Never commit directly to `main`/`master`. Always via PR.

## Branches

- Branch naming: `<type>/<ticket-or-description>` — e.g., `feat/user-auth`, `fix/order-timeout`
- Feature branches are short-lived. Merge within days, not weeks.
- One feature per branch. Large features use a feature branch as base with sub-branches.
- Delete branches after merge.

## Pull Requests

- PRs are small and focused. A PR that changes 10+ files across unrelated concerns should be split.
- PR description: what changed, why, how to test it. Link the related issue.
- PRs require at least one approval before merge.
- All CI gates must be green before merge: tests, lint, type check, build.
- Rebase or squash before merge. No merge commits on `main`.

## Staging and Commits

- Review `git diff --staged` before committing. Never commit accidentally staged files.
- Never force-push to shared branches (`main`, `develop`, `staging`).
- Use `git rebase -i` to clean up local history before opening a PR.
- Amend commits only if they have not been pushed to remote.

## .gitignore

- `.gitignore` must cover: build artifacts, `node_modules`, virtual environments, IDE configs, `.env` files, OS files (`.DS_Store`, `Thumbs.db`).
- Add new rules at the appropriate scope (global gitignore for IDE/OS, repo gitignore for project artifacts).

## Secrets

- Never commit secrets, credentials, `.env` files with real values, or private keys.
- If a secret is accidentally committed: rotate it immediately, then remove from history with `git filter-repo`.
- `.env.example` with placeholder values is fine to commit. `.env` with real values is not.

## Tags and Releases

- Tags follow semver: `v<major>.<minor>.<patch>` — e.g., `v1.2.3`
- Tags are created on `main` after merge, not on feature branches.
- Annotated tags (`git tag -a`) for releases, lightweight for local markers.

## Commit Message Examples

```
feat(auth): add JWT refresh token rotation

Implements RFC 6819 token binding. Previous tokens are invalidated
on rotation to prevent replay attacks. Adds Redis store for token family tracking.
Closes #142.

fix(orders): prevent duplicate charge on retry

Payment gateway can return 5xx then succeed async. Guard with idempotency
key stored in orders table. Fixes intermittent double-charge in production.
Closes #201.

refactor(user): extract email validation to shared validator

Removes duplicated regex logic from UserService, AdminService, and InviteService.
No behavior change — all existing tests pass.
```
