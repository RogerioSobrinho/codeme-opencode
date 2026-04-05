/**
 * flutter-check — run flutter analyze after editing .dart files
 *
 * Fires `tool.execute.after` on every Edit. When the edited file is a
 * Dart source file, it looks for the nearest pubspec.yaml walking up
 * from the file to confirm it's inside a Flutter/Dart project, then runs:
 *   1. `flutter analyze <file>` — if the `flutter` command is available
 *   2. `dart analyze <file>`   — fallback if only `dart` is available
 *
 * Runs async so it never blocks the agent. Errors are printed as warnings.
 * Analysis is scoped to the single edited file for speed (not the whole project).
 *
 * Disable with: OPENCODE_NO_FLUTTER_CHECK=1
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"
import path from "path"
import fs from "fs"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

function findPubspec(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pubspec.yaml"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync("which", [cmd])
    return true
  } catch {
    return false
  }
}

export const FlutterCheckPlugin: Plugin = async () => {
  return {
    "tool.execute.after": async (input) => {
      if (process.env.OPENCODE_NO_FLUTTER_CHECK === "1") return
      if (input.tool !== "edit") return

      const filePath: string = (input.args as { filePath?: string }).filePath ?? ""
      if (!filePath || !/\.dart$/.test(filePath)) return

      const dir = path.dirname(path.resolve(filePath))
      const projectRoot = findPubspec(dir)
      if (!projectRoot) return // not inside a Dart/Flutter project

      // Pick the best available tool — flutter first, dart as fallback
      const useFlutter = await commandExists("flutter")
      const useDart = !useFlutter && (await commandExists("dart"))
      if (!useFlutter && !useDart) return

      const [cmd, args] = useFlutter
        ? ["flutter", ["analyze", "--no-pub", filePath]]
        : ["dart", ["analyze", filePath]]

      try {
        const { stdout, stderr } = await execFileAsync(cmd, args, {
          cwd: projectRoot,
          timeout: 30_000,
        })
        const output = (stdout + stderr).trim()
        if (output && !/No issues found/.test(output)) {
          console.error(`[flutter-check] ${cmd} analyze:\n${output}`)
        }
      } catch (err: unknown) {
        const out =
          (err as { stdout?: string; stderr?: string })?.stdout ??
          (err as { stderr?: string })?.stderr ??
          String(err)
        if (out.trim()) {
          console.error(`[flutter-check] analysis warnings in ${path.basename(filePath)}:\n${out.trim()}`)
        }
      }
    },
  }
}
