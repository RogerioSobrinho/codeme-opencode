import type { Plugin } from "@opencode-ai/plugin"

/**
 * stale-todo-guard — warns when the agent goes idle with unfinished todos
 *
 * Watches `todo.updated` to track the current todo list per session.
 * On `session.idle`, checks if any todos are still `in_progress` or `pending`.
 * If so:
 *   - Logs a structured warning via client.app.log
 *   - On macOS, sends a desktop notification so you notice even from another window
 *
 * This prevents the silent "agent thought it was done but left work unfinished"
 * failure mode that's easy to miss in long autonomous sessions.
 *
 * Configuration:
 *   OPENCODE_NO_STALE_GUARD=1 — disable the plugin entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

interface Todo {
  content: string
  status: string
  priority: string
}

const todosBySession = new Map<string, Todo[]>()

export const StaleTodoGuardPlugin: Plugin = async ({ $, client }) => {
  if (process.env.OPENCODE_NO_STALE_GUARD === "1") return {}

  const isMac = process.platform === "darwin"

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

      const todos = todosBySession.get(sessionId) ?? []
      if (todos.length === 0) return

      const stale = todos.filter((t) => t.status === "in_progress" || t.status === "pending")
      if (stale.length === 0) return

      const inProgress = stale.filter((t) => t.status === "in_progress")
      const pending = stale.filter((t) => t.status === "pending")

      const lines: string[] = [
        `Session went idle with ${stale.length} unfinished todo(s):`,
      ]
      if (inProgress.length > 0) {
        lines.push(`  In progress (${inProgress.length}):`)
        for (const t of inProgress) lines.push(`    - ${t.content}`)
      }
      if (pending.length > 0) {
        lines.push(`  Pending (${pending.length}):`)
        for (const t of pending.slice(0, 5)) lines.push(`    - ${t.content}`)
        if (pending.length > 5) lines.push(`    … and ${pending.length - 5} more`)
      }

      await client.app.log({
        body: {
          service: "stale-todo-guard",
          level: "warn",
          message: lines.join("\n"),
          extra: {
            session_id: sessionId,
            stale_count: stale.length,
            in_progress: inProgress.map((t) => t.content),
            pending: pending.map((t) => t.content),
          },
        },
      })

      if (isMac && process.env.OPENCODE_NO_NOTIFY !== "1") {
        const first = inProgress[0]?.content ?? pending[0]?.content ?? "unknown task"
        const msg = `${stale.length} todo(s) unfinished — "${first.slice(0, 60)}"`
        try {
          await $`osascript -e ${`display notification "${msg}" with title "OpenCode — Stale Todos" sound name "Basso"`}`.quiet()
        } catch {
          // Non-fatal
        }
      }
    },

    "session.deleted": async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
      todosBySession.delete(sessionId)
    },
  }
}
