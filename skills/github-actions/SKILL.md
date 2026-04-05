---
name: github-actions
description: Load when writing GitHub Actions workflows, reviewing CI/CD configuration, or asked about CI conventions, workflow triggers, secrets management, or deployment patterns.
---

# GitHub Actions

## Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:     # manual trigger with optional inputs

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true   # cancel outdated runs on new push
```

## Standard Pipeline

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint

  test:
    needs: lint
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --coverage

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with: { name: dist, path: dist/ }

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/download-artifact@v4
        with: { name: dist }
      - run: ./scripts/deploy.sh staging
```

## Security

```yaml
# Pin actions to commit SHA — not @v1 or @main
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2

# Minimum permissions — declare at top of workflow
permissions:
  contents: read
  pull-requests: write   # only if needed for PR comments

# Use secrets.NAME — never echo secrets, never set them as regular env vars
- name: Deploy
  env:
    DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}   # referenced by name only
  run: ./deploy.sh
  # NEVER: run: echo "${{ secrets.API_KEY }}"  — masks bypass regex in logs

# GITHUB_TOKEN — restrict default permissions in repo settings
```

## Caching

```yaml
# Node.js
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'          # built-in cache by setup action

# Python
- uses: actions/setup-python@v5
  with:
    python-version: '3.12'
    cache: 'pip'

# Gradle / Java
- uses: actions/setup-java@v4
  with:
    distribution: 'temurin'
    java-version: '21'
    cache: 'gradle'

# Manual cache for custom paths
- uses: actions/cache@v4
  with:
    path: ~/.cache/custom-tool
    key: ${{ runner.os }}-custom-${{ hashFiles('**/lockfile') }}
    restore-keys: ${{ runner.os }}-custom-
```

## Matrix Strategy

```yaml
test:
  strategy:
    fail-fast: false
    matrix:
      node: ['18', '20', '22']
      os: [ubuntu-latest, windows-latest]
  runs-on: ${{ matrix.os }}
  steps:
    - uses: actions/setup-node@v4
      with: { node-version: ${{ matrix.node }} }
```

## Reusable Workflows

```yaml
# .github/workflows/reusable-deploy.yml
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      DEPLOY_KEY:
        required: true

# Caller
jobs:
  deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: production
    secrets:
      DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## Deployment Patterns

```yaml
deploy-production:
  environment:
    name: production
    url: https://app.example.com   # shown in GitHub UI
  # environment protection rules in GitHub settings:
  # - Required reviewers: 1 senior engineer
  # - Deployment branches: main only
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `uses: actions/checkout@main` | Unpinned — can change without notice | Pin to SHA |
| `run: echo "${{ secrets.KEY }}"` | Exposes secret in logs | Never echo secrets |
| No `timeout-minutes` | Job hangs indefinitely, burns minutes | Set on every job |
| All steps in one mega-job | Can't parallelize, hard to retry | Split into lint/test/build/deploy jobs |
| Skipping tests on push to main | Broken code reaches main | Never skip tests in CI |
| Storing secrets in env vars at workflow level | Over-scoped, available to all steps | Scope to the specific step that needs it |
