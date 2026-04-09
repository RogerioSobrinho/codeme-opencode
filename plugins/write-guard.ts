import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * write-guard — prevents writing to a file that hasn't been read in the current session
 *
 * Intercepts `tool.execute.before` for `write` and `edit` operations.
 * If the target file exists on disk but has NOT been read in the current session,
 * it injects the current file contents into the session context before allowing
 * the write. This prevents the silent "agent overwrote logic it didn't know about"
 * failure mode that happens in long sessions or when context has been compacted.
 *
 * Behavior:
 *   - Tracks files read per session (via `tool.execute.after` on `read`)
 *   - On write/edit: if file exists and wasn't read → inject current content first
 *   - Injection is non-blocking: write proceeds even if injection fails
 *   - New files (don't exist on disk) are always allowed without injection
 *   - Binary files and files > MAX_LINES are skipped (no injection, write allowed)
 *
 * Configuration:
 *   OPENCODE_NO_WRITE_GUARD=1          — disable entirely
 *   OPENCODE_WRITE_GUARD_MAX_LINES=500 — max lines to inject (default: 500)
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
  ".sql", ".graphql", ".proto",
  ".css", ".scss", ".sass", ".html", ".htm",
])

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === "") return false
  return TEXT_EXTENSIONS.has(ext)
}

function hasSkipDir(filePath: string): boolean {
  return filePath.split(path.sep).some((part) => SKIP_DIRS.has(part))
}

// Per-session: tracks files that have been read
const readBySession = new Map<string, Set<string>>()

export const WriteGuardPlugin: Plugin = async ({ client, worktree }) => {
  if (process.env.OPENCODE_NO_WRITE_GUARD === "1") return {}

  const MAX_LINES = parseInt(process.env.OPENCODE_WRITE_GUARD_MAX_LINES ?? "500", 10)

  function getRead(sessionId: string): Set<string> {
    if (!readBySession.has(sessionId)) readBySession.set(sessionId, new Set())
    return readBySession.get(sessionId)!
  }

  function resolveFilePath(rawPath: string): string {
    return path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(worktree, rawPath)
  }

  async function injectCurrentContent(sessionId: string, filePath: string): Promise<boolean> {
    const file = Bun.file(filePath)
    let content: string
    try {
      content = await file.text()
    } catch {
      return false
    }

    const lineCount = content.split("\n").length
    if (lineCount > MAX_LINES) return true // skip injection but consider it "seen"

    const relPath = path.relative(worktree, filePath)
    const ext = path.extname(filePath).slice(1) || "text"

    const message = [
      `[write-guard] You are about to write to \`${relPath}\`, but it was not read in this session.`,
      `Here is the current content on disk — review it before your write to avoid overwriting logic you didn't account for:`,
      `\`\`\`${ext}`,
      content,
      `\`\`\``,
    ].join("\n")

    try {
      await (client as any).postSessionByIdMessage({
        path: { id: sessionId },
        body: { role: "system", content: message },
      })

      await client.app.log({
        body: {
          service: "write-guard",
          level: "info",
          message: `Injected unread file before write: ${relPath} (${lineCount} lines)`,
          extra: { path: filePath, lines: lineCount, session_id: sessionId },
        },
      })

      return true
    } catch {
      await client.app.log({
        body: {
          service: "write-guard",
          level: "warn",
          message: `Failed to inject unread file context for ${relPath} — write will proceed without guard`,
          extra: { path: filePath, session_id: sessionId },
        },
      })
      return false
    }
  }

  return {
    event: async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // Clean up on session delete
      if (event.type === "session.deleted") {
        readBySession.delete(sessionId)
        return
      }
    },

    "tool.execute.after": async (input: any) => {
      // Track files that have been read
      if (input.tool !== "read") return

      const sessionId: string =
        input.sessionId ?? input.session_id ?? "unknown"
      const rawPath: string =
        input.args?.filePath ?? input.args?.path ?? ""
      if (!rawPath) return

      const resolved = resolveFilePath(rawPath)
      getRead(sessionId).add(resolved)
    },

    "tool.execute.before": async (input: any) => {
      if (input.tool !== "write" && input.tool !== "edit") return

      const sessionId: string =
        input.sessionId ?? input.session_id ?? "unknown"

      const rawPath: string =
        input.args?.filePath ?? input.args?.path ?? ""
      if (!rawPath) return

      const resolved = resolveFilePath(rawPath)

      // Allow: not a text file
      if (!isTextFile(resolved)) return

      // Allow: in a skip directory
      if (hasSkipDir(resolved)) return

      // Allow: file doesn't exist on disk (new file)
      const file = Bun.file(resolved)
      const exists = await file.exists()
      if (!exists) return

      // Allow: already read in this session
      const readFiles = getRead(sessionId)
      if (readFiles.has(resolved)) return

      // File exists and was not read — inject current content
      const injected = await injectCurrentContent(sessionId, resolved)

      // Only mark as seen if injection succeeded (or file is too large to inject)
      if (injected) {
        readFiles.add(resolved)
      }
    },
  }
}
