/**
 * typescript-check — auto-run tsc after editing .ts/.tsx files
 *
 * Fires `tool.execute.after` on every Edit. When the edited file is a
 * TypeScript source file (not a .d.ts declaration), it looks for the
 * nearest tsconfig.json walking up from the file and runs
 * `tsc --noEmit --project <tsconfig>` asynchronously so it never blocks
 * the agent. Errors are printed to the session log as a warning.
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"
import path from "path"
import fs from "fs"

function findTsConfig(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, "tsconfig.json")
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

export const TypeScriptCheckPlugin: Plugin = async ({ $ }) => {
  return {
    "tool.execute.after": async (input) => {
      if (input.tool !== "edit") return

      const filePath: string = (input.args as { filePath?: string }).filePath ?? ""
      if (!filePath) return

      // Only TypeScript source files — skip declaration files
      if (!/\.(ts|tsx)$/.test(filePath) || /\.d\.ts$/.test(filePath)) return

      const dir = path.dirname(path.resolve(filePath))
      const tsconfig = findTsConfig(dir)
      if (!tsconfig) return // no tsconfig, skip silently

      // Run in the background — never block the agent
      try {
        await $`tsc --noEmit --project ${tsconfig} 2>&1 | head -40`.quiet()
      } catch (err: unknown) {
        const output = (err as { stdout?: string })?.stdout ?? String(err)
        if (output.trim()) {
          console.error(`[typescript-check] tsc errors in ${path.basename(filePath)}:\n${output}`)
        }
      }
    },
  }
}
