/**
 * bash-guard — blocks destructive shell commands before execution
 *
 * Intercepts `tool.execute.before` on every Bash call and blocks (throws)
 * on 4 categories of irreversible / dangerous commands:
 *
 *   1. Destructive deletion — rm with recursive+force flags on dangerous paths
 *      (/, ~, $HOME, .., .) to prevent accidental wipeout of the filesystem.
 *
 *   2. SQL destruction — DROP TABLE/DATABASE, TRUNCATE TABLE, and DELETE FROM
 *      without a WHERE clause. These are unrecoverable without a backup.
 *
 *   3. Git force-push — git push --force / -f. Safe alternative
 *      (--force-with-lease) is allowed.
 *
 *   4. Git hard reset to remote/parent — git reset --hard HEAD~ or
 *      git reset --hard origin/<branch>. These discard local commits silently.
 *
 * Never blocks:
 *   - rm on specific files (non-recursive)
 *   - git push --force-with-lease (safe)
 *   - git reset --soft / --mixed (reversible)
 *   - DELETE FROM with a WHERE clause
 *
 * Ported from: https://github.com/iamfakeguru/claude-md (.claude/hooks/block-destructive.sh)
 * Adapted for OpenCode plugin API.
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"

// ── Dangerous path patterns for rm ────────────────────────────────────────────
// Matches: rm -rf /, rm -rf ~, rm -rf $HOME, rm -rf .., rm -rf .
const DANGEROUS_RM_PATHS = [
  /\brm\b.{0,40}(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|--recursive[a-zA-Z\s]*--force|--force[a-zA-Z\s]*--recursive).{0,20}(\/|~|\$HOME|\.\.(?:\/|$)|\.\s*$|\.\s+)/,
  // Also catch shorthand: rm -rf/ or rm -fr ~
  /\brm\s+-[rf]{2,}\s*(\/|~|\$HOME|\.\.|\.(?:\s|$))/,
]

// ── SQL destruction ───────────────────────────────────────────────────────────
// Matches DROP TABLE, DROP DATABASE, TRUNCATE TABLE, and DELETE without WHERE
const SQL_DESTRUCTIVE = [
  /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+(TABLE\s+)?\w+)/i,
  // DELETE FROM <table> ending with ; or end-of-string with no WHERE
  /\bDELETE\s+FROM\s+\w+\s*;/i,
  /\bDELETE\s+FROM\s+\w+\s*$/i,
]

// ── Git force-push ────────────────────────────────────────────────────────────
// Blocks --force and -f but NOT --force-with-lease
const GIT_FORCE_PUSH = [
  /\bgit\s+push\b.*--force(?!-with-lease)/,
  /\bgit\s+push\b.*(?<!\S)-f(?!\S)/,
  // git push -f origin main
  /\bgit\s+push\s+-f\b/,
]

// ── Git hard reset to parent / remote ────────────────────────────────────────
const GIT_HARD_RESET = [
  /\bgit\s+reset\s+--hard\s+HEAD[~^]/,
  /\bgit\s+reset\s+--hard\s+origin\//,
]

type BlockResult = { blocked: true; category: string; reason: string } | { blocked: false }

function checkCommand(command: string): BlockResult {
  const normalized = command.replace(/\s+/g, " ").trim()

  // 1. Destructive rm
  for (const pattern of DANGEROUS_RM_PATHS) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        category: "destructive-deletion",
        reason:
          `Recursive deletion of a dangerous path is not allowed.\n` +
          `  Command: ${normalized.slice(0, 120)}\n` +
          `If you genuinely need to delete files recursively, target a specific subdirectory,\n` +
          `not /, ~, $HOME, .., or . (the working directory root).`,
      }
    }
  }

  // 2. SQL destruction
  for (const pattern of SQL_DESTRUCTIVE) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        category: "sql-destruction",
        reason:
          `Destructive SQL command detected — this operation is irreversible without a backup.\n` +
          `  Command: ${normalized.slice(0, 120)}\n` +
          `For DELETE: always include a WHERE clause.\n` +
          `For DROP/TRUNCATE: confirm with the user before executing.`,
      }
    }
  }

  // 3. Git force-push
  for (const pattern of GIT_FORCE_PUSH) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        category: "git-force-push",
        reason:
          `Force-pushing is blocked to protect shared branch history.\n` +
          `  Command: ${normalized.slice(0, 120)}\n` +
          `Use --force-with-lease instead (git push --force-with-lease) — it only force-pushes\n` +
          `if no one else has pushed since your last fetch, preventing accidental overwrites.`,
      }
    }
  }

  // 4. Git hard reset to parent/remote
  for (const pattern of GIT_HARD_RESET) {
    if (pattern.test(normalized)) {
      return {
        blocked: true,
        category: "git-hard-reset",
        reason:
          `Hard reset to a parent or remote ref discards local commits and is not recoverable.\n` +
          `  Command: ${normalized.slice(0, 120)}\n` +
          `Use --soft or --mixed to preserve changes in the working tree or index.\n` +
          `If you need to throw away commits intentionally, confirm with the user first.`,
      }
    }
  }

  return { blocked: false }
}

export const BashGuardPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const command: string = (output.args as { command?: string }).command ?? ""
      if (!command.trim()) return

      const result = checkCommand(command)
      if (result.blocked) {
        throw new Error(
          `[bash-guard] BLOCKED (${result.category}): ${result.reason}`,
        )
      }
    },
  }
}
