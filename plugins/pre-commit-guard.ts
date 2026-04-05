/**
 * pre-commit-guard — quality checks before git commit
 *
 * Intercepts `tool.execute.before` on Bash calls that match `git commit`.
 * Checks:
 *   1. Staged files must not contain debug statements:
 *      - JS/TS:   console.log / debugger
 *      - Dart:    print( statements
 *      - Java:    System.out.println / e.printStackTrace()
 *   2. Staged files must not contain obvious secret patterns (API keys, tokens)
 *   3. Commit message (when -m/--message is present) must follow Conventional Commits
 *
 * Blocks the commit (throws) if check 1 or 2 fail.
 * Warns (console.error) for check 3 without blocking — the agent can still commit.
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"

// Conventional Commits: type(scope?): description
const CONVENTIONAL_RE = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!?:\s.+/

// Secret patterns — high-signal, low false-positive
const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{20,}/i,
  /(?:secret|password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}/i,
  /(?:bearer|token)\s+[A-Za-z0-9\-._~+/]{20,}/i,
  /AKIA[0-9A-Z]{16}/,                          // AWS access key
  /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}/,  // GitHub tokens
  /sk-[A-Za-z0-9]{32,}/,                        // OpenAI keys
]

function extractCommitMessage(command: string): string | null {
  const match = command.match(/(?:-m|--message)\s+(['"])([\s\S]*?)\1/) ??
                command.match(/(?:-m|--message)\s+(\S+)/)
  return match ? (match[2] ?? match[1]) : null
}

export const PreCommitGuardPlugin: Plugin = async ({ $ }) => {
  return {
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return

      const command: string = (output.args as { command?: string }).command ?? ""
      if (!command.includes("git commit")) return

      // ── 1. Get staged diff ──────────────────────────────────────────────────
      let diff = ""
      try {
        const result = await $`git diff --cached --unified=0`.quiet()
        diff = result.stdout
      } catch {
        // Not in a git repo or nothing staged — let it pass
        return
      }

      if (!diff.trim()) return // nothing staged

      // ── 2. Check for debug statements (JS/TS + Dart + Java) ────────────────
      const addedLines = diff
        .split("\n")
        .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
        .map((l) => l.slice(1))

      const debugStatements = addedLines.filter((l) =>
        // JS / TS
        /console\.(log|warn|error|debug|info)\s*\(/.test(l) ||
        /\bdebugger\b/.test(l) ||
        // Dart — bare print( and debugPrint( are ok in tests but not in prod code
        /^\s*print\s*\(/.test(l) ||
        // Java
        /System\.out\.print(ln)?\s*\(/.test(l) ||
        /\.printStackTrace\s*\(/.test(l)
      )

      if (debugStatements.length > 0) {
        const examples = debugStatements.slice(0, 3).map((l) => `  ${l.trim()}`).join("\n")
        throw new Error(
          `[pre-commit-guard] BLOCKED: ${debugStatements.length} debug statement(s) in staged changes:\n${examples}\n\nRemove them before committing.\n(JS/TS: console.log/debugger | Dart: print() | Java: System.out.println/printStackTrace)`
        )
      }

      // ── 3. Check for secrets ────────────────────────────────────────────────
      const secretMatches: string[] = []
      for (const line of addedLines) {
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(line)) {
            secretMatches.push(`  ${line.trim().slice(0, 80)}`)
            break
          }
        }
      }

      if (secretMatches.length > 0) {
        throw new Error(
          `[pre-commit-guard] BLOCKED: Possible secret/credential in staged changes:\n${secretMatches.slice(0, 3).join("\n")}\n\nReview and remove before committing.`
        )
      }

      // ── 4. Conventional Commits warning (non-blocking) ─────────────────────
      const commitMsg = extractCommitMessage(command)
      if (commitMsg && !CONVENTIONAL_RE.test(commitMsg.split("\n")[0])) {
        console.error(
          `[pre-commit-guard] WARNING: Commit message does not follow Conventional Commits.\n` +
          `  Got:      "${commitMsg.split("\n")[0]}"\n` +
          `  Expected: type(scope): description\n` +
          `  Types:    feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert`
        )
      }
    },
  }
}
