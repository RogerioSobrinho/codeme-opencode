#!/bin/bash
# install.sh — codme-opencode Installer
#
# Two modes:
#   LOCAL:  ./install.sh                          (from a cloned repo)
#   REMOTE: curl -fsSL <raw-url>/install.sh | bash  (downloads everything via curl)
#
# Safe to run multiple times (idempotent).
# Preserved: ~/.config/opencode/skills/company-*/  (company-specific, never overwritten)
#
# Deploys to: ~/.config/opencode/ (OpenCode's native global config directory)

set -euo pipefail

TARGET_DIR="${HOME}/.config/opencode"
PRESERVED_PATTERN="company-*"
REPO_RAW="https://raw.githubusercontent.com/RogerioSobrinho/codme-opencode/main"

# ─── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[skip]${NC}  $*"; }
error()   { echo -e "${RED}[err]${NC}   $*"; }

# ─── File manifest ─────────────────────────────────────────────────────────────
# Update these arrays when adding new files.

ROOT_FILES=(
  "opencode.json"
  "AGENTS.md"
)

PLUGINS=(
  "typescript-check.ts"
  "pre-commit-guard.ts"
  "session-notify.ts"
  "env-protection.ts"
)

AGENTS=(
  "architect.md"
  "build-resolver.md"
  "code-review.md"
  "doc-writer.md"
  "explore.md"
  "fix.md"
  "init-project.md"
  "new-feature.md"
  "orchestrator.md"
  "planner.md"
  "pr-review.md"
  "python-reviewer.md"
  "refactor.md"
  "security-auditor.md"
  "tdd-guide.md"
  "typescript-reviewer.md"
  "write-commit.md"
)

COMMANDS=(
  "checkpoint.md"
  "fix.md"
  "init-project.md"
  "learn.md"
  "orchestrate.md"
  "plan.md"
  "refactor.md"
  "review.md"
  "secure.md"
  "tdd.md"
  "verify.md"
)

SKILLS=(
  "api-design"
  "architecture-decision-records"
  "autonomous-loops"
  "codebase-onboarding"
  "context-budget"
  "continuous-learning"
  "database-migrations"
  "debugging-playbook"
  "deployment-patterns"
  "docker-patterns"
  "e2e-testing"
  "git-workflow"
  "github-actions"
  "golang-patterns"
  "iterative-retrieval"
  "multiagent-orchestration"
  "node-patterns"
  "python-patterns"
  "react-patterns"
  "search-first"
  "security-review"
  "skill-authoring"
  "springboot-patterns"
  "strategic-compact"
  "subagent-patterns"
  "tdd-workflow"
  "typescript-patterns"
  "verification-loop"
)

RULES=(
  "core.md"
  "engineering.md"
  "git.md"
  "python.md"
  "security.md"
  "testing.md"
  "typescript.md"
)

# ─── Detect mode ───────────────────────────────────────────────────────────────
SCRIPT_DIR=""
LOCAL_MODE=false

if [ -n "${BASH_SOURCE[0]:-}" ] && [ -f "${BASH_SOURCE[0]}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -d "$SCRIPT_DIR/agents" ] && [ -d "$SCRIPT_DIR/skills" ] && [ -d "$SCRIPT_DIR/commands" ]; then
    LOCAL_MODE=true
  fi
fi

echo ""
echo -e "${BLUE}codme-opencode — Install${NC}"
if $LOCAL_MODE; then
  echo "  Mode   : local (from cloned repo)"
  echo "  Source : $SCRIPT_DIR"
else
  echo "  Mode   : remote (downloading from GitHub)"
  echo "  Source : $REPO_RAW"
fi
echo "  Target : $TARGET_DIR"
echo ""

# ─── Helper: get file content ──────────────────────────────────────────────────
# Local mode: reads from disk. Remote mode: downloads via curl.
get_file() {
  local rel_path="$1"
  if $LOCAL_MODE; then
    cat "$SCRIPT_DIR/$rel_path"
  else
    curl -fsSL "$REPO_RAW/$rel_path"
  fi
}

# ─── Helper: deploy file ───────────────────────────────────────────────────────
# Reads/downloads source, writes to target only if changed. Returns 0 if updated.
deploy_file() {
  local rel_path="$1"
  local dest="$2"

  mkdir -p "$(dirname "$dest")"

  local tmp
  tmp=$(mktemp)
  if get_file "$rel_path" > "$tmp" 2>/dev/null; then
    if [ -f "$dest" ] && diff -q "$tmp" "$dest" &>/dev/null; then
      rm "$tmp"
      return 1  # unchanged
    fi
    mv "$tmp" "$dest"
    return 0  # updated
  else
    rm -f "$tmp"
    error "Failed to get: $rel_path"
    return 2  # error
  fi
}

# ─── 1. Create target directory structure ─────────────────────────────────────
mkdir -p "$TARGET_DIR/agents" "$TARGET_DIR/commands" "$TARGET_DIR/skills" "$TARGET_DIR/rules" "$TARGET_DIR/plugins"

# ─── 2. Discover preserved skills ─────────────────────────────────────────────
PRESERVED=()
if [ -d "$TARGET_DIR/skills" ]; then
  for dir in "$TARGET_DIR/skills"/$PRESERVED_PATTERN; do
    [ -d "$dir" ] && PRESERVED+=("$(basename "$dir")")
  done
fi

if [ ${#PRESERVED[@]} -gt 0 ]; then
  info "Preserving ${#PRESERVED[@]} company-specific skill(s):"
  for name in "${PRESERVED[@]}"; do
    warn "  ~/.config/opencode/skills/$name  (not overwritten)"
  done
  echo ""
fi

# ─── 3. Deploy root files (opencode.json, AGENTS.md) ──────────────────────────
ROOT_UPDATED=0
for file in "${ROOT_FILES[@]}"; do
  if deploy_file "$file" "$TARGET_DIR/$file"; then
    success "$file"
    ((ROOT_UPDATED++)) || true
  fi
done

if [ "$ROOT_UPDATED" -eq 0 ]; then
  info "root files  — all up to date"
fi

# ─── 4. Deploy plugins ─────────────────────────────────────────────────────────
PLUGINS_UPDATED=0
for plugin in "${PLUGINS[@]}"; do
  if deploy_file "plugins/$plugin" "$TARGET_DIR/plugins/$plugin"; then
    success "plugins/$plugin"
    ((PLUGINS_UPDATED++)) || true
  fi
done

if [ "$PLUGINS_UPDATED" -eq 0 ]; then
  info "plugins/    — all up to date"
fi

# ─── 5. Deploy agents ──────────────────────────────────────────────────────────
AGENTS_UPDATED=0
for agent in "${AGENTS[@]}"; do
  if deploy_file "agents/$agent" "$TARGET_DIR/agents/$agent"; then
    success "agents/$agent"
    ((AGENTS_UPDATED++)) || true
  fi
done

if [ "$AGENTS_UPDATED" -eq 0 ]; then
  info "agents/     — all up to date"
fi

# ─── 6. Deploy commands ────────────────────────────────────────────────────────
COMMANDS_UPDATED=0
for cmd in "${COMMANDS[@]}"; do
  if deploy_file "commands/$cmd" "$TARGET_DIR/commands/$cmd"; then
    success "commands/$cmd"
    ((COMMANDS_UPDATED++)) || true
  fi
done

if [ "$COMMANDS_UPDATED" -eq 0 ]; then
  info "commands/   — all up to date"
fi

# ─── 7. Deploy skills (skip preserved) ────────────────────────────────────────
SKILLS_UPDATED=0
for skill in "${SKILLS[@]}"; do
  skip=false
  for preserved in "${PRESERVED[@]+"${PRESERVED[@]}"}"; do
    [ "$skill" = "$preserved" ] && skip=true && break
  done
  $skip && continue

  if deploy_file "skills/$skill/SKILL.md" "$TARGET_DIR/skills/$skill/SKILL.md"; then
    success "skills/$skill/SKILL.md"
    ((SKILLS_UPDATED++)) || true
  fi
done

if [ "$SKILLS_UPDATED" -eq 0 ]; then
  info "skills/     — all up to date"
fi

# ─── 8. Deploy rules ───────────────────────────────────────────────────────────
RULES_UPDATED=0
for rule in "${RULES[@]}"; do
  if deploy_file "rules/$rule" "$TARGET_DIR/rules/$rule"; then
    success "rules/$rule"
    ((RULES_UPDATED++)) || true
  fi
done

if [ "$RULES_UPDATED" -eq 0 ]; then
  info "rules/      — all up to date"
fi

# ─── 9. Summary ───────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Done.${NC}"
echo ""

TOTAL_AGENTS=$(find "$TARGET_DIR/agents" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_COMMANDS=$(find "$TARGET_DIR/commands" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_SKILLS=$(find "$TARGET_DIR/skills" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
TOTAL_RULES=$(find "$TARGET_DIR/rules" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_PLUGINS=$(find "$TARGET_DIR/plugins" -maxdepth 1 -name "*.ts" -o -name "*.js" 2>/dev/null | wc -l | tr -d ' ')

echo "  Agents   : $TOTAL_AGENTS"
echo "  Commands : $TOTAL_COMMANDS  (slash commands, e.g. /plan, /tdd, /review)"
echo "  Skills   : $TOTAL_SKILLS"
echo "  Rules    : $TOTAL_RULES  (modular instruction sets)"
echo "  Plugins  : $TOTAL_PLUGINS  (typescript-check, pre-commit-guard, session-notify, env-protection)"
echo "  MCPs     : sequential-thinking, memory, context7, gh_grep  (configured in opencode.json)"

if [ ${#PRESERVED[@]} -gt 0 ]; then
  echo ""
  echo -e "  ${YELLOW}Company-specific skills preserved (not updated):${NC}"
  for name in "${PRESERVED[@]}"; do
    echo "    ~/.config/opencode/skills/$name"
  done
fi

echo ""
echo -e "  ${BLUE}Tip:${NC} Per-project config lives in .opencode/opencode.json — run /init-project to generate it."
echo ""
echo -e "  ${BLUE}Tip:${NC} Company-specific skills go in:"
echo "       ~/.config/opencode/skills/company-{name}-{topic}/SKILL.md"
echo "       (never overwritten by this installer)"
echo ""
echo -e "  ${BLUE}Tip:${NC} Available slash commands: /plan  /tdd  /review  /fix  /secure"
echo "       /refactor  /learn  /checkpoint  /verify  /orchestrate  /init-project"
echo ""
