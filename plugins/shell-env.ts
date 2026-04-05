import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * shell-env — Injects project-level environment variables into every bash
 * command executed by any agent.
 *
 * Injects:
 *   PROJECT_ROOT         → git worktree root (or cwd if not in a git repo)
 *   PACKAGE_MANAGER      → npm | pnpm | yarn | bun (Node) or pip | pipenv | poetry (Python)
 *   PRIMARY_LANGUAGE     → typescript | javascript | python | go | java | rust | dart | unknown
 *   DETECTED_LANGUAGES   → comma-separated list of all detected languages
 *
 * Agents no longer need to run `which pnpm`, check lock files, or guess
 * whether to use `npm run` vs `pnpm` in their bash commands.
 */
export const ShellEnvPlugin: Plugin = async ({ directory }) => {
  // ── Detect languages ───────────────────────────────────────────────────────
  async function detectLanguages(dir: string): Promise<{ primary: string; all: string[] }> {
    const checks: Array<{ lang: string; files: string[] }> = [
      { lang: "typescript", files: ["tsconfig.json", "tsconfig.base.json"] },
      { lang: "javascript", files: ["package.json"] },
      { lang: "python", files: ["pyproject.toml", "setup.py", "requirements.txt"] },
      { lang: "go", files: ["go.mod"] },
      { lang: "java", files: ["pom.xml", "build.gradle", "build.gradle.kts"] },
      { lang: "rust", files: ["Cargo.toml"] },
      { lang: "dart", files: ["pubspec.yaml"] },
    ]

    const detected: string[] = []
    for (const { lang, files } of checks) {
      for (const f of files) {
        if (await Bun.file(path.join(dir, f)).exists()) {
          if (!detected.includes(lang)) detected.push(lang)
          break
        }
      }
    }

    // Primary: typescript beats javascript; otherwise first detected
    let primary = detected[0] ?? "unknown"
    if (detected.includes("typescript")) primary = "typescript"
    else if (detected.includes("java")) primary = "java"

    return { primary, all: detected }
  }

  // ── Detect package manager ─────────────────────────────────────────────────
  async function detectPackageManager(dir: string): Promise<string> {
    if (await Bun.file(path.join(dir, "bun.lockb")).exists()) return "bun"
    if (await Bun.file(path.join(dir, "pnpm-lock.yaml")).exists()) return "pnpm"
    if (await Bun.file(path.join(dir, "yarn.lock")).exists()) return "yarn"
    if (await Bun.file(path.join(dir, "package.json")).exists()) return "npm"
    if (await Bun.file(path.join(dir, "Pipfile")).exists()) return "pipenv"
    if (await Bun.file(path.join(dir, "poetry.lock")).exists()) return "poetry"
    if (
      (await Bun.file(path.join(dir, "pyproject.toml")).exists()) ||
      (await Bun.file(path.join(dir, "requirements.txt")).exists())
    )
      return "pip"
    if (await Bun.file(path.join(dir, "go.mod")).exists()) return "go"
    if (await Bun.file(path.join(dir, "Cargo.toml")).exists()) return "cargo"
    if (await Bun.file(path.join(dir, "pom.xml")).exists()) return "mvn"
    if (
      (await Bun.file(path.join(dir, "build.gradle")).exists()) ||
      (await Bun.file(path.join(dir, "build.gradle.kts")).exists())
    )
      return "gradle"
    return "unknown"
  }

  return {
    "shell.env": async (input, output) => {
      const dir = input.cwd ?? directory

      // Resolve git root if possible
      let projectRoot = dir
      try {
        const result = await Bun.$`git -C ${dir} rev-parse --show-toplevel`.quiet().text()
        projectRoot = result.trim()
      } catch {
        // not a git repo — use cwd
      }

      const [pm, langs] = await Promise.all([
        detectPackageManager(projectRoot),
        detectLanguages(projectRoot),
      ])

      output.env.PROJECT_ROOT = projectRoot
      output.env.PACKAGE_MANAGER = pm
      output.env.PRIMARY_LANGUAGE = langs.primary
      output.env.DETECTED_LANGUAGES = langs.all.join(",")
    },
  }
}
