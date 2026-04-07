import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * session-summary — writes a markdown summary when a session goes idle
 *
 * On `session.idle`, generates a structured `.md` file at:
 *   .opencode/sessions/YYYY-MM-DD-HH-MM-<session-id>.md
 *
 * The summary includes:
 *   - Session title and date
 *   - Git diff stat (files changed, insertions, deletions)
 *   - List of modified files (from git diff --name-status HEAD)
 *   - Pending todos (if any remain — acts as a "next steps" section)
 *
 * This gives you a persistent, human-readable record of every work session
 * without having to remember what was done.
 *
 * Configuration:
 *   OPENCODE_SUMMARY_DIR  — output directory (default: <worktree>/.opencode/sessions)
 *   OPENCODE_NO_SUMMARY=1 — disable the plugin entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

interface Todo {
  content: string
  status: string
  priority: string
}

// In-memory store: sessionId → latest todos snapshot
const todosBySession = new Map<string, Todo[]>()

export const SessionSummaryPlugin: Plugin = async ({ $, client, worktree }) => {
  if (process.env.OPENCODE_NO_SUMMARY === "1") return {}

  const SUMMARY_DIR = process.env.OPENCODE_SUMMARY_DIR ?? path.join(worktree, ".opencode", "sessions")

  // Track todos per session so we can include them in the summary
  return {
    "todo.updated": async (input: any) => {
      const todos: Todo[] = input.todos ?? []
      const sessionId: string = input.sessionId ?? input.session_id ?? "unknown"
      todosBySession.set(sessionId, todos)
    },

    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.idle") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // ── Fetch session info ──────────────────────────────────────────────────
      let sessionTitle = "Untitled session"
      try {
        const res = await client.session.get({ path: { id: sessionId } })
        const title = (res as any)?.data?.title ?? (res as any)?.title
        if (title) sessionTitle = title
      } catch {
        // Not fatal — use fallback title
      }

      // ── Git diff ────────────────────────────────────────────────────────────
      let diffStat = ""
      let nameStatus = ""
      try {
        diffStat = (await $`git diff --stat HEAD`.quiet().text()).trim()
        nameStatus = (await $`git diff --name-status HEAD`.quiet().text()).trim()
      } catch {
        // Not a git repo or no commits — skip git sections
      }

      // ── Todos ───────────────────────────────────────────────────────────────
      const todos = todosBySession.get(sessionId) ?? []
      const pending = todos.filter((t) => t.status === "pending" || t.status === "in_progress")
      const completed = todos.filter((t) => t.status === "completed")

      // ── Build markdown ──────────────────────────────────────────────────────
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 16).replace("T", " ")
      const fileDate = now.toISOString().slice(0, 16).replace(/[T:]/g, "-")
      const shortId = sessionId.slice(0, 8)

      const lines: string[] = [
        `# ${sessionTitle}`,
        ``,
        `**Date:** ${dateStr}  `,
        `**Session:** \`${shortId}\``,
        ``,
      ]

      if (diffStat) {
        // Extract summary line (last non-empty line of --stat)
        const statLines = diffStat.split("\n").filter(Boolean)
        const statSummary = statLines[statLines.length - 1]?.trim() ?? ""

        lines.push(`## Changed files`)
        lines.push(``)
        lines.push(`_${statSummary}_`)
        lines.push(``)

        if (nameStatus) {
          for (const line of nameStatus.split("\n").filter(Boolean)) {
            const [status, ...rest] = line.split("\t")
            const file = rest.join("\t")
            const icon = status === "A" ? "+" : status === "D" ? "-" : "~"
            lines.push(`- \`${icon} ${file}\``)
          }
          lines.push(``)
        }
      }

      if (completed.length > 0) {
        lines.push(`## Completed`)
        lines.push(``)
        for (const t of completed) {
          lines.push(`- [x] ${t.content}`)
        }
        lines.push(``)
      }

      if (pending.length > 0) {
        lines.push(`## Next steps`)
        lines.push(``)
        for (const t of pending) {
          const label = t.status === "in_progress" ? " _(in progress)_" : ""
          lines.push(`- [ ] ${t.content}${label}`)
        }
        lines.push(``)
      }

      if (!diffStat && todos.length === 0) {
        lines.push(`_No changes recorded for this session._`)
        lines.push(``)
      }

      const content = lines.join("\n")
      const filename = `${fileDate}-${shortId}.md`
      const dest = path.join(SUMMARY_DIR, filename)

      try {
        await $`mkdir -p ${SUMMARY_DIR}`.quiet()
        await Bun.write(dest, content)

        await client.app.log({
          body: {
            service: "session-summary",
            level: "info",
            message: `Session summary saved → .opencode/sessions/${filename}`,
            extra: { path: dest, session_id: sessionId },
          },
        })
      } catch {
        // Non-fatal — summary failure must never disrupt the session
      }

      // Clean up memory
      todosBySession.delete(sessionId)
    },
  }
}
