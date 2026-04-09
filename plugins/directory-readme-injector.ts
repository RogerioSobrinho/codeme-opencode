import type { Plugin } from "@opencode-ai/plugin"
import * as path from "node:path"
import * as fs from "node:fs/promises"

/**
 * directory-readme-injector — injects the nearest README.md as context
 * when the agent reads or edits a file in a subdirectory.
 *
 * Complements directory-agents-injector (which injects AGENTS.md).
 * README files often contain project conventions, API contracts, and
 * architectural context that an AGENTS.md may not duplicate.
 *
 * Behavior:
 *   - On `tool.execute.before` for read/edit/write, walks up the directory
 *     tree from the target file looking for the nearest README.md
 *   - Stops at the worktree root — does not inject the root README (too noisy)
 *   - Injects each README at most once per (session, path) pair
 *   - Content is truncated to MAX_LINES to avoid flooding context
 *   - Cleans up per-session state on session.deleted
 *
 * Configuration:
 *   OPENCODE_NO_README_INJECTOR=1   — disable entirely
 *   OPENCODE_README_MAX_LINES=100   — max lines to inject (default: 80)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const README_NAMES = ["README.md", "readme.md", "Readme.md"]

async function findNearestReadme(
  startDir: string,
  worktree: string,
): Promise<string | null> {
  let current = startDir

  while (current.startsWith(worktree) && current !== worktree) {
    for (const name of README_NAMES) {
      const candidate = path.join(current, name)
      try {
        await fs.access(candidate)
        return candidate
      } catch {
        // Not found — keep walking up
      }
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  return null
}

export const DirectoryReadmeInjectorPlugin: Plugin = async ({ client, worktree }) => {
  if (process.env.OPENCODE_NO_README_INJECTOR === "1") return {}

  const MAX_LINES = parseInt(process.env.OPENCODE_README_MAX_LINES ?? "80", 10)

  // sessionId → Set of readme paths already injected this session
  const injectedBySession = new Map<string, Set<string>>()

  function getInjected(sessionId: string): Set<string> {
    if (!injectedBySession.has(sessionId)) {
      injectedBySession.set(sessionId, new Set())
    }
    return injectedBySession.get(sessionId)!
  }

  return {
    "session.deleted": async (input: any) => {
      const sessionId: string = input?.sessionId ?? input?.session_id ?? "unknown"
      injectedBySession.delete(sessionId)
    },

    "tool.execute.before": async (input: any) => {
      if (!["read", "edit", "write"].includes(input.tool)) return

      const sessionId: string = input.sessionId ?? input.session_id ?? "unknown"
      const rawPath: string = input.args?.filePath ?? input.args?.path ?? ""
      if (!rawPath) return

      const resolved = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(worktree, rawPath)

      const targetDir = path.dirname(resolved)

      const readmePath = await findNearestReadme(targetDir, worktree)
      if (!readmePath) return

      const injected = getInjected(sessionId)
      if (injected.has(readmePath)) return
      injected.add(readmePath)

      // Read and truncate the README
      let content: string
      try {
        content = await fs.readFile(readmePath, "utf-8")
      } catch {
        return
      }

      const lines = content.split("\n")
      const truncated = lines.slice(0, MAX_LINES)
      const wasTruncated = lines.length > MAX_LINES
      const body = truncated.join("\n") +
        (wasTruncated ? `\n\n_[truncated — ${lines.length - MAX_LINES} lines omitted]_` : "")

      const relReadme = path.relative(worktree, readmePath)

      try {
        await (client as any).postSessionByIdMessage({
          path: { id: sessionId },
          body: {
            role: "system",
            content: `[directory-readme-injector] Context from \`${relReadme}\`:\n\n${body}`,
          },
        })

        await client.app.log({
          body: {
            service: "directory-readme-injector",
            level: "debug",
            message: `Injected README: ${relReadme} (${Math.min(lines.length, MAX_LINES)} lines)`,
            extra: { readme: readmePath, session_id: sessionId, truncated: wasTruncated },
          },
        })
      } catch {
        // Injection may fail if session ended or API shape differs — remove from injected so it can retry
        injected.delete(readmePath)
      }
    },
  }
}
