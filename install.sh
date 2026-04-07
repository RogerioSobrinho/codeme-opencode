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
  "lint-check.ts"
  "pre-commit-guard.ts"
  "bash-guard.ts"
  "session-notify.ts"
  "env-protection.ts"
  "flutter-check.ts"
  "java-check.ts"
  "shell-env.ts"
  "compaction.ts"
  "todo-progress.ts"
  "session-timer.ts"
  "diff-summary.ts"
  "file-backup.ts"
  "auto-branch.ts"
  "session-summary.ts"
  "stale-todo-guard.ts"
  "error-rerun.ts"
  "smart-context.ts"
  "daily-digest.ts"
  "session-error-notify.ts"
  "tui-toast.ts"
  "lsp-diagnostics.ts"
  "permission-auto-approve.ts"
  "command-history.ts"
  "doom-loop-notify.ts"
  "file-watcher.ts"
  "session-diff.ts"
  "tui-prompt-shortcuts.ts"
)

TOOLS=(
  "run-tests.ts"
  "git-summary.ts"
  "changed-files.ts"
  "security-audit.ts"
  "http-request.ts"
)

AGENTS=(
  "architect.md"
  "build-resolver.md"
  "code-review.md"
  "doc-writer.md"
  "explore.md"
  "fix.md"
  "flutter-reviewer.md"
  "init-project.md"
  "java-reviewer.md"
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
  "standup.md"
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
  "flutter-patterns"
  "git-workflow"
  "github-actions"
  "golang-patterns"
  "java-patterns"
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

# npm packages to install into ~/.config/opencode/ so OpenCode picks them up.
# OpenCode reads the "plugin" array from opencode.json and auto-installs these
# at startup using Bun. The installer pre-installs them so the first launch
# is instant and works offline.
NPM_PLUGINS=(
  "@tarquinen/opencode-dcp@latest"
  "@nick-vi/opencode-type-inject@latest"
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
mkdir -p "$TARGET_DIR/agents" "$TARGET_DIR/commands" "$TARGET_DIR/skills" "$TARGET_DIR/rules" "$TARGET_DIR/plugins" "$TARGET_DIR/tools"

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

# ─── 5. Deploy tools ───────────────────────────────────────────────────────────
TOOLS_UPDATED=0
for tool_file in "${TOOLS[@]}"; do
  if deploy_file "tools/$tool_file" "$TARGET_DIR/tools/$tool_file"; then
    success "tools/$tool_file"
    ((TOOLS_UPDATED++)) || true
  fi
done

if [ "$TOOLS_UPDATED" -eq 0 ]; then
  info "tools/      — all up to date"
fi

# ─── 6. Deploy agents ──────────────────────────────────────────────────────────
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

# ─── 7. Deploy commands ────────────────────────────────────────────────────────
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

# ─── 8. Deploy skills (skip preserved) ────────────────────────────────────────
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

# ─── 9. Deploy rules ───────────────────────────────────────────────────────────
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

# ─── 10. Install npm plugins ───────────────────────────────────────────────────
# Pre-installs npm plugins into ~/.config/opencode/ so they are available on
# the first OpenCode launch without requiring network access.
#
# Strategy:
#   - Prefer bun (faster, used by OpenCode natively)
#   - Fall back to npm if bun is not available
#   - Create package.json if missing (required for bun/npm to install)
#   - Idempotent: skips packages already installed at the right version
#   - Soft failure: warns but does not abort the install if npm/bun fails

if [ ${#NPM_PLUGINS[@]} -gt 0 ]; then
  echo ""

  # Detect package manager
  NPM_CMD=""
  if command -v bun &>/dev/null; then
    NPM_CMD="bun"
  elif command -v npm &>/dev/null; then
    NPM_CMD="npm"
  fi

  if [ -z "$NPM_CMD" ]; then
    warn "npm plugins — skipped (bun and npm not found; OpenCode will install on first launch)"
  else
    # Ensure package.json exists in target dir
    PKG_JSON="$TARGET_DIR/package.json"
    if [ ! -f "$PKG_JSON" ]; then
      echo '{"name":"opencode-global-config","private":true,"dependencies":{}}' > "$PKG_JSON"
      success "package.json created in $TARGET_DIR"
    fi

    NPM_UPDATED=0
    NPM_SKIPPED=0
    for pkg in "${NPM_PLUGINS[@]}"; do
      # Strip version suffix for installed-check (e.g. @foo/bar@latest → @foo/bar)
      pkg_name="${pkg%@*}"
      # Handle scoped packages: @scope/name@version → name is @scope/name
      if [[ "$pkg" == @* ]]; then
        # e.g. @tarquinen/opencode-dcp@latest
        pkg_name="$(echo "$pkg" | sed 's/@[^@/][^/]*$//')"
        # If the result still ends with @, it's just @scope/name with no version
        [[ "$pkg_name" == "$pkg" ]] && pkg_name="$pkg"
      fi

      # Check if already installed
      if [ -d "$TARGET_DIR/node_modules/$pkg_name" ]; then
        warn "npm/$pkg_name  — already installed"
        ((NPM_SKIPPED++)) || true
        continue
      fi

      if [ "$NPM_CMD" = "bun" ]; then
        if bun add "$pkg" --cwd "$TARGET_DIR" --silent 2>/dev/null; then
          success "npm/$pkg_name  (via bun)"
          ((NPM_UPDATED++)) || true
        else
          warn "npm/$pkg_name  — bun install failed; OpenCode will retry on first launch"
        fi
      else
        if npm install "$pkg" --prefix "$TARGET_DIR" --silent 2>/dev/null; then
          success "npm/$pkg_name  (via npm)"
          ((NPM_UPDATED++)) || true
        else
          warn "npm/$pkg_name  — npm install failed; OpenCode will retry on first launch"
        fi
      fi
    done

    if [ "$NPM_UPDATED" -eq 0 ] && [ "$NPM_SKIPPED" -gt 0 ]; then
      info "npm plugins — all up to date"
    fi
  fi
fi

# ─── 11. Summary ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}Done.${NC}"
echo ""

TOTAL_AGENTS=$(find "$TARGET_DIR/agents" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_COMMANDS=$(find "$TARGET_DIR/commands" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_SKILLS=$(find "$TARGET_DIR/skills" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
TOTAL_RULES=$(find "$TARGET_DIR/rules" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_PLUGINS=$(find "$TARGET_DIR/plugins" -maxdepth 1 \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | wc -l | tr -d ' ')
TOTAL_TOOLS=$(find "$TARGET_DIR/tools" -maxdepth 1 \( -name "*.ts" -o -name "*.js" \) 2>/dev/null | wc -l | tr -d ' ')

echo "  Agents   : $TOTAL_AGENTS"
echo "  Commands : $TOTAL_COMMANDS  (slash commands, e.g. /plan, /tdd, /review)"
echo "  Skills   : $TOTAL_SKILLS"
echo "  Rules    : $TOTAL_RULES  (modular instruction sets)"
  echo "  Plugins  : $TOTAL_PLUGINS  (doom-loop-notify, file-watcher, session-diff, tui-prompt-shortcuts, session-error-notify, tui-toast, lsp-diagnostics, permission-auto-approve, command-history, typescript-check, lint-check, pre-commit-guard, bash-guard, session-notify, env-protection, flutter-check, java-check, shell-env, compaction, todo-progress, session-timer, diff-summary, file-backup, auto-branch, session-summary, stale-todo-guard, error-rerun, smart-context, daily-digest)"
  echo "  Tools    : $TOTAL_TOOLS  (run-tests, git-summary, changed-files, security-audit, http-request)"
  echo "  MCPs     : sequential-thinking, memory, context7, gh_grep  (configured in opencode.json)"

# Count installed npm plugins
TOTAL_NPM=0
for pkg in "${NPM_PLUGINS[@]}"; do
  pkg_name="${pkg%@*}"
  if [[ "$pkg" == @* ]]; then
    pkg_name="$(echo "$pkg" | sed 's/@[^@/][^/]*$//')"
    [[ "$pkg_name" == "$pkg" ]] && pkg_name="$pkg"
  fi
  [ -d "$TARGET_DIR/node_modules/$pkg_name" ] && ((TOTAL_NPM++)) || true
done
if [ "$TOTAL_NPM" -gt 0 ]; then
  echo "  npm      : $TOTAL_NPM plugin(s) installed — @tarquinen/opencode-dcp, @nick-vi/opencode-type-inject"
fi

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
  echo "       /refactor  /learn  /checkpoint  /verify  /orchestrate  /standup  /init-project"
  echo ""
  echo -e "  ${BLUE}Tip:${NC} npm plugin commands after first launch:"
  echo "       /dcp context  — token usage breakdown"
  echo "       /dcp stats    — cumulative pruning stats"
echo ""
