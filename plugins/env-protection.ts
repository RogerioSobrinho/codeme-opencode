/**
 * env-protection — block the agent from reading .env files
 *
 * Intercepts `tool.execute.before` on Read and Edit tools.
 * Throws (blocks) when the target file path is a .env file or a known
 * secrets file (.env.local, .env.production, .env.*.local, etc.).
 *
 * Rationale: .env files contain API keys and credentials. The agent
 * should never read them — it should use environment variables via the
 * shell.env plugin event or ask the user to set them manually.
 *
 * Exceptions:
 *   - .env.example and .env.template are allowed (they contain no real secrets)
 *   - Setting OPENCODE_ALLOW_ENV=1 disables this guard (escape hatch)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

// Files that are safe to read (examples / templates only)
const SAFE_ENV_FILES = new Set([".env.example", ".env.template", ".env.sample"])

function isEnvFile(filePath: string): boolean {
  const basename = path.basename(filePath)
  // Match .env, .env.local, .env.production, .env.development.local, etc.
  return /^\.env(\..+)?$/.test(basename) && !SAFE_ENV_FILES.has(basename)
}

export const EnvProtectionPlugin: Plugin = async () => {
  return {
    "tool.execute.before": async (input, output) => {
      if (process.env.OPENCODE_ALLOW_ENV === "1") return

      const tool = input.tool
      if (tool !== "read" && tool !== "edit") return

      const filePath: string =
        (output.args as { filePath?: string }).filePath ?? ""
      if (!filePath) return

      if (isEnvFile(filePath)) {
        throw new Error(
          `[env-protection] BLOCKED: Reading "${path.basename(filePath)}" is not allowed.\n` +
          `Env files may contain secrets. Use environment variables or ask the user to provide values.\n` +
          `To bypass this guard: set OPENCODE_ALLOW_ENV=1`
        )
      }
    },
  }
}
