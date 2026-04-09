import type { Plugin } from "@opencode-ai/plugin"
import path from "path"
import fs from "fs"

/**
 * directory-agents-injector — injects per-directory AGENTS.md into the session
 *
 * When the agent reads or edits a file, this plugin checks if there is an
 * AGENTS.md in the same directory (or any parent up to the worktree root).
 * If found and not yet injected this session, its content is injected as a
 * system message so the agent knows the local rules for that module.
 *
 * This enables "scoped agent context": each directory can have its own rules,
 * gotchas, and architectural constraints that the agent absorbs automatically.
 *
 * Example: editing `src/auth/user.ts` → injects `src/auth/AGENTS.md` if present.
 *
 * Behaviour:
 *   - Checks on `tool.execute.after` for `read` and `edit` tools
 *   - Walks up from the file's directory to the worktree root
 *   - Stops at the first AGENTS.md found (most specific wins)
 *   - Skips the root AGENTS.md (already loaded by OpenCode itself)
 *   - Deduplicates: each unique AGENTS.md path is injected at most once per session
 *
 * Configuration:
 *   OPENCODE_NO_DIR_AGENTS=1 — disable the plugin
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

// injected set: sessionId → Set of AGENTS.md paths already injected
const injectedBySession = new Map<string, Set<string>>()

export const DirectoryAgentsInjectorPlugin: Plugin = async ({ client, worktree }) => {
  if (process.env.OPENCODE_NO_DIR_AGENTS === "1") return {}

  const rootAgentsPath = path.join(worktree, "AGENTS.md")

  function findDirectoryAgentsMd(filePath: string): string | null {
    // Start from the file's directory, walk up to worktree root
    let dir = path.dirname(path.resolve(filePath))

    while (dir.startsWith(worktree) && dir !== worktree) {
      const candidate = path.join(dir, "AGENTS.md")
      if (fs.existsSync(candidate)) return candidate
      const parent = path.dirname(dir)
      if (parent === dir) break
      dir = parent
    }

    return null
  }

  return {
    "tool.execute.after": async (input: any) => {
      if (input.tool !== "read" && input.tool !== "edit") return

      const filePath: string = (input.args as { filePath?: string }).filePath ?? ""
      if (!filePath) return

      // Skip if the file itself is an AGENTS.md
      if (path.basename(filePath) === "AGENTS.md") return

      const agentsMdPath = findDirectoryAgentsMd(filePath)
      if (!agentsMdPath) return

      // Skip the root AGENTS.md — OpenCode loads it already
      if (agentsMdPath === rootAgentsPath) return

      // Extract session id from the event (best-effort from last known context)
      // Use the file path as a stable proxy key if session id unavailable
      const sessionKey = "global"
      const injected = injectedBySession.get(sessionKey) ?? new Set<string>()
      if (injected.has(agentsMdPath)) return

      // Read the directory AGENTS.md
      let content: string
      try {
        content = fs.readFileSync(agentsMdPath, "utf8").trim()
      } catch {
        return
      }

      if (!content) return

      const relPath = path.relative(worktree, agentsMdPath)
      const message =
        `[directory-agents-injector] Found local agent context at ${relPath}:\n\n${content}`

      try {
        await client.app.log({
          body: {
            service: "directory-agents-injector",
            level: "info",
            message: `Injecting directory AGENTS.md: ${relPath}`,
            extra: { path: agentsMdPath },
          },
        })

        // Inject as a system prompt addition via session message
        // The exact API varies by OpenCode version — try both known shapes
        const sessionId: string = (input as any).sessionId ?? (input as any).session_id ?? ""
        if (sessionId) {
          await (client as any).postSessionByIdMessage({
            path: { id: sessionId },
            body: { role: "system", content: message },
          })
        }

        injected.add(agentsMdPath)
        injectedBySession.set(sessionKey, injected)
      } catch {
        // Non-fatal — injection failure must not break the tool call
      }
    },

    event: async ({ event }: { event: any }) => {
      if (event.type === "session.deleted") {
        injectedBySession.clear()
      }
    },
  }
}
