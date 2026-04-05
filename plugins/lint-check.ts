/**
 * lint-check — auto-run ESLint (JS/TS) and ruff (Python) after every edit
 *
 * Fires `tool.execute.after` on every Edit. When the edited file is a
 * JS/TS or Python source file, it runs the appropriate linter if one is
 * configured in the project:
 *
 *   JS/TS (.ts, .tsx, .js, .jsx):
 *     Looks for an ESLint config file (eslint.config.*, .eslintrc.*,
 *     eslintConfig in package.json). If found, runs:
 *       npx eslint --quiet <file>
 *
 *   Python (.py):
 *     Checks if `ruff` is available in $PATH. If found, runs:
 *       ruff check <file>
 *
 * Both run asynchronously in the background — they never block the agent.
 * Lint errors are printed to the session log as warnings (console.error).
 *
 * Intentionally separate from typescript-check.ts (tsc) so each concern
 * can be disabled independently per project.
 *
 * Ported from: https://github.com/iamfakeguru/claude-md (.claude/hooks/post-edit-verify.sh)
 * Adapted for OpenCode plugin API.
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"
import path from "path"
import fs from "fs"

// ── ESLint config detection ───────────────────────────────────────────────────
const ESLINT_CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.mjs",
  ".eslintrc.ts",
  ".eslintrc.json",
  ".eslintrc.yaml",
  ".eslintrc.yml",
]

function findEslintConfig(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 8; i++) {
    // Check config files
    for (const configFile of ESLINT_CONFIG_FILES) {
      if (fs.existsSync(path.join(dir, configFile))) return dir
    }
    // Check package.json for eslintConfig field
    const pkgPath = path.join(dir, "package.json")
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
        if (pkg.eslintConfig) return dir
      } catch {
        // malformed package.json — skip
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

async function isRuffAvailable($: (strings: TemplateStringsArray, ...values: unknown[]) => { quiet(): { text(): Promise<string> } }): Promise<boolean> {
  try {
    await $`which ruff`.quiet().text()
    return true
  } catch {
    return false
  }
}

export const LintCheckPlugin: Plugin = async ({ $, client }) => {
  return {
    "tool.execute.after": async (input) => {
      if (input.tool !== "edit") return

      const filePath: string = (input.args as { filePath?: string }).filePath ?? ""
      if (!filePath) return

      const ext = path.extname(filePath).toLowerCase()
      const absPath = path.resolve(filePath)

      // ── JS / TS linting via ESLint ─────────────────────────────────────────
      if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
        const dir = path.dirname(absPath)
        const configRoot = findEslintConfig(dir)
        if (!configRoot) return // no ESLint config in the project — skip silently

        try {
          await $`npx eslint --quiet ${absPath}`.quiet()
        } catch (err: unknown) {
          const output =
            (err as { stdout?: string })?.stdout ??
            (err as { stderr?: string })?.stderr ??
            String(err)
          if (output.trim()) {
            await client.app.log({
              body: {
                service: "lint-check",
                level: "warn",
                message: `ESLint errors in ${path.basename(filePath)}:\n${output.trim()}`,
                extra: { file: path.basename(filePath), linter: "eslint" },
              },
            })
          }
        }
        return
      }

      // ── Python linting via ruff ────────────────────────────────────────────
      if (ext === ".py") {
        const ruffAvailable = await isRuffAvailable($)
        if (!ruffAvailable) return // ruff not installed — skip silently

        try {
          await $`ruff check ${absPath}`.quiet()
        } catch (err: unknown) {
          const output =
            (err as { stdout?: string })?.stdout ??
            (err as { stderr?: string })?.stderr ??
            String(err)
          if (output.trim()) {
            await client.app.log({
              body: {
                service: "lint-check",
                level: "warn",
                message: `ruff errors in ${path.basename(filePath)}:\n${output.trim()}`,
                extra: { file: path.basename(filePath), linter: "ruff" },
              },
            })
          }
        }
      }
    },
  }
}
