---
name: docker-patterns
description: Load when writing Dockerfiles, docker-compose configs, or asked about containerization patterns, multi-stage builds, image optimization, or container security.
---

# Docker Patterns

## Multi-Stage Builds

```dockerfile
# Node.js example — build stage separate from runtime
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage — only artifacts, no dev tooling
FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# Only production deps — exclude devDependencies
COPY package*.json ./
RUN npm ci --omit=dev

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

## Base Image Selection

| Use case | Base image | Notes |
|---|---|---|
| General purpose | `node:20-alpine` | Small, includes shell |
| Security-sensitive | `gcr.io/distroless/nodejs20-debian12` | No shell, minimal attack surface |
| Java | `eclipse-temurin:21-jre-alpine` | JRE only, not full JDK |
| Python | `python:3.12-slim` | Debian slim variant |
| Reproducible builds | Pin to digest: `alpine@sha256:abc123...` | Immutable reference |

```dockerfile
# Pin to digest for reproducibility
FROM node:20.11.0-alpine3.19@sha256:a1234567890abcdef...
```

## Layer Caching — Copy Dependencies First

```dockerfile
# GOOD — cache layer invalidated only when package.json changes
COPY package*.json ./
RUN npm ci

COPY . .          # source code copied after — cache miss here doesn't reinstall deps

# BAD — any source change invalidates npm ci cache
COPY . .
RUN npm ci
```

## Security

```dockerfile
# Non-root user — never run as root in production
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Read-only filesystem — mount writable dirs explicitly
# docker run --read-only --tmpfs /tmp image

# No secrets in ENV or ARG (visible in image history)
# BAD
ENV API_KEY=supersecret

# GOOD — inject at runtime via environment
# docker run -e API_KEY=$API_KEY image
# or use Docker secrets / Kubernetes secrets

# Minimal capabilities
# docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE image
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
```

## .dockerignore

```
# .dockerignore — prevent sensitive/unnecessary files from entering build context
.git
.env
.env.*
node_modules
dist
*.log
coverage
.DS_Store
```

## docker-compose Patterns

```yaml
# docker-compose.yml — production-like
services:
  app:
    image: myapp:${IMAGE_TAG:-latest}
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
    secrets:
      - db_password
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
    restart: unless-stopped

secrets:
  db_password:
    external: true
```

```yaml
# docker-compose.override.yml — development overrides (auto-merged)
services:
  app:
    build: .
    volumes:
      - .:/app          # live reload — source mounted into container
      - /app/node_modules  # prevent host node_modules overwriting container's
    environment:
      NODE_ENV: development
    command: npm run dev
```

## Image Size Optimization

```bash
# Check image layers
docker history myapp:latest

# Scan for vulnerabilities
docker scout cves myapp:latest

# Multi-stage keeps only the final stage
# Remove package manager caches in same RUN layer
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
 && rm -rf /var/lib/apt/lists/*
```

## Anti-Patterns

| Anti-pattern | Problem | Fix |
|---|---|---|
| `FROM ubuntu:latest` | Unpinned, changes on rebuild | Pin to specific version or digest |
| Running as root | Privilege escalation risk | `USER appuser` |
| `COPY . .` before dependency install | Invalidates dep cache on any file change | Copy package files first |
| Secrets in `ENV` or `ARG` | Visible in `docker history` | Inject at runtime via env or secrets |
| No `.dockerignore` | `.git`, `.env`, `node_modules` enter build context | Always maintain `.dockerignore` |
| Dev dependencies in final image | Larger image, more attack surface | Multi-stage build, `--omit=dev` |
