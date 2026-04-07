import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * smart-context — auto-injects file contents when the agent references a path
 *
 * Watches `message.updated` for assistant messages that mention file paths
 * (e.g. "look at src/utils/auth.ts" or "the issue is in lib/parser.go").
 * When a referenced file exists on disk and hasn't been injected yet in this
 * session, its content is appended to the prompt silently (noReply: true) so
 * the agent has the full context without requiring a manual "read this file"
 * round-trip.
 *
 * Behaviour:
 *   - Only injects files that exist on disk
 *   - Skips files already read in this session (deduped per session)
 *   - Skips binary files and files > MAX_FILE_LINES (default: 300)
 *   - Skips node_modules, .git, dist, build, coverage directories
 *   - Non-blocking: injection failure never disrupts the session
 *
 * Configuration:
 *   OPENCODE_SMART_CONTEXT_MAX_LINES — max lines per file (default: 300)
 *   OPENCODE_NO_SMART_CONTEXT=1      — disable entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", ".cache"])
const TEXT_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".java", ".kt", ".rs", ".rb", ".php",
  ".c", ".cpp", ".h", ".hpp", ".cs",
  ".dart", ".swift", ".scala",
  ".json", ".yaml", ".yml", ".toml", ".xml",
  ".md", ".mdx", ".txt", ".sh", ".bash", ".zsh",
  ".env.example", ".sql", ".graphql", ".proto",
  ".css", ".scss", ".sass", ".html", ".htm",
])

// Matches file paths: relative (src/foo.ts), absolute (/home/...), or ./relative
const FILE_PATH_RE = /(?:^|[\s`"'(])((\.{0,2}\/[\w./\-]+|[\w][\w./\-]*\.\w{1,6}))(?=[\s`"'),]|$)/gm

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === "") return false
  return TEXT_EXTENSIONS.has(ext)
}

function hasSkipDir(filePath: string): boolean {
  return filePath.split(path.sep).some((part) => SKIP_DIRS.has(part))
}

function extractPaths(text: string): string[] {
  const found = new Set<string>()
  let match: RegExpExecArray | null
  FILE_PATH_RE.lastIndex = 0
  while ((match = FILE_PATH_RE.exec(text)) !== null) {
    const p = match[1]
    if (p && p.length > 3) found.add(p)
  }
  return [...found]
}

const injectedBySession = new Map<string, Set<string>>()

export const SmartContextPlugin: Plugin = async ({ client, worktree }) => {
  if (process.env.OPENCODE_NO_SMART_CONTEXT === "1") return {}

  const MAX_LINES = parseInt(process.env.OPENCODE_SMART_CONTEXT_MAX_LINES ?? "300", 10)

  function getInjected(sessionId: string): Set<string> {
    if (!injectedBySession.has(sessionId)) injectedBySession.set(sessionId, new Set())
    return injectedBySession.get(sessionId)!
  }

  async function tryInject(sessionId: string, rawPath: string): Promise<void> {
    const injected = getInjected(sessionId)

    // Resolve relative to worktree
    const resolved = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(worktree, rawPath)

    if (injected.has(resolved)) return
    if (!isTextFile(resolved)) return
    if (hasSkipDir(resolved)) return

    const file = Bun.file(resolved)
    const exists = await file.exists()
    if (!exists) return

    let content: string
    try {
      content = await file.text()
    } catch {
      return
    }

    const lineCount = content.split("\n").length
    if (lineCount > MAX_LINES) return

    injected.add(resolved)

    const relPath = path.relative(worktree, resolved)
    const ext = path.extname(resolved).slice(1) || "text"

    try {
      await client.session.prompt({
        path: { id: sessionId },
        body: {
          noReply: true,
          parts: [
            {
              type: "text",
              text: `[smart-context] Auto-injecting referenced file: ${relPath}\n\`\`\`${ext}\n${content}\n\`\`\``,
            },
          ],
        } as any,
      })

      await client.app.log({
        body: {
          service: "smart-context",
          level: "info",
          message: `Injected referenced file: ${relPath} (${lineCount} lines)`,
          extra: { path: resolved, lines: lineCount, session_id: sessionId },
        },
      })
    } catch {
      // Non-fatal
      injected.delete(resolved)
    }
  }

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "message.updated") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // Only process assistant messages
      const role = event.properties?.role ?? event.properties?.message?.role
      if (role !== "assistant") return

      // Extract text content from the message parts
      const parts: any[] = event.properties?.parts ?? event.properties?.message?.parts ?? []
      const text = parts
        .filter((p: any) => p.type === "text")
        .map((p: any) => p.text ?? "")
        .join("\n")

      if (!text) return

      const paths = extractPaths(text)
      if (paths.length === 0) return

      // Inject each referenced file concurrently (best-effort)
      await Promise.allSettled(paths.map((p) => tryInject(sessionId, p)))
    },

    "session.deleted": async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
      injectedBySession.delete(sessionId)
    },
  }
}
