/**
 * java-check — run mvn compile after editing .java files
 *
 * Fires `tool.execute.after` on every Edit. When the edited file is a
 * Java source file, it walks up the directory tree looking for a pom.xml
 * to confirm it's a Maven project, then runs:
 *   `mvn compile -q --batch-mode`
 *
 * Runs async and is debounced: if multiple .java files are edited in
 * quick succession only one compile is triggered per 3-second window
 * per project root (prevents hammering mvn on bulk edits).
 *
 * Outputs only compiler errors (not full build output) to keep noise low.
 *
 * Disable with: OPENCODE_NO_JAVA_CHECK=1
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

// debounce map: projectRoot → timeout handle
const pending = new Map<string, ReturnType<typeof setTimeout>>()
const DEBOUNCE_MS = 3_000

function findPomXml(startDir: string): string | null {
  let dir = startDir
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pom.xml"))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

async function runMvnCompile(projectRoot: string): Promise<void> {
  try {
    await execFileAsync("mvn", ["compile", "-q", "--batch-mode"], {
      cwd: projectRoot,
      timeout: 120_000, // Maven can be slow on cold start
    })
  } catch (err: unknown) {
    // mvn exits non-zero on compile errors — extract the ERROR lines
    const raw =
      (err as { stdout?: string })?.stdout ??
      (err as { stderr?: string })?.stderr ??
      String(err)

    const errorLines = raw
      .split("\n")
      .filter((l) => /^\[ERROR\]/.test(l))
      .slice(0, 20) // cap at 20 lines to keep noise low
      .join("\n")

    if (errorLines) {
      console.error(`[java-check] mvn compile errors in ${path.basename(projectRoot)}:\n${errorLines}`)
    }
  }
}

export const JavaCheckPlugin: Plugin = async () => {
  return {
    "tool.execute.after": async (input) => {
      if (process.env.OPENCODE_NO_JAVA_CHECK === "1") return
      if (input.tool !== "edit") return

      const filePath: string = (input.args as { filePath?: string }).filePath ?? ""
      if (!filePath || !/\.java$/.test(filePath)) return

      const dir = path.dirname(path.resolve(filePath))
      const projectRoot = findPomXml(dir)
      if (!projectRoot) return // not a Maven project

      // Debounce: cancel any pending compile for this project root
      const existing = pending.get(projectRoot)
      if (existing) clearTimeout(existing)

      const handle = setTimeout(() => {
        pending.delete(projectRoot)
        runMvnCompile(projectRoot).catch(() => {/* already handled inside */})
      }, DEBOUNCE_MS)

      pending.set(projectRoot, handle)
    },
  }
}
