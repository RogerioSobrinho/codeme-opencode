import type { Plugin } from "@opencode-ai/plugin"

/**
 * stale-todo-guard — warns and nudges the agent when it goes idle with unfinished todos
 *
 * Watches `todo.updated` to track the current todo list per session.
 * On `session.idle`, checks if any todos are still `in_progress` or `pending`.
 * If so:
 *   - Logs a structured warning via client.app.log
 *   - On macOS, sends a desktop notification so you notice even from another window
 *   - Injects a continuation prompt into the session to nudge the agent back on track
 *     (with cooldown: max once every 30s, max 5 injections per session)
 *
 * On `session.deleted`, cleans up the in-memory todo map.
 *
 * This prevents the silent "agent thought it was done but left work unfinished"
 * failure mode that's easy to miss in long autonomous sessions.
 *
 * Configuration:
 *   OPENCODE_NO_STALE_GUARD=1        — disable the plugin entirely
 *   OPENCODE_STALE_NO_PROMPT=1       — log/notify only, skip prompt injection
 *   OPENCODE_STALE_COOLDOWN_MS=30000 — cooldown between injections (default: 30s)
 *   OPENCODE_STALE_MAX_NUDGES=5      — max nudges per session (default: 5)
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
// Cooldown tracking: sessionId → { lastNudgeAt, nudgeCount }
const nudgeState = new Map<string, { lastNudgeAt: number; nudgeCount: number }>()

export const StaleTodoGuardPlugin: Plugin = async ({ $, client }) => {
  if (process.env.OPENCODE_NO_STALE_GUARD === "1") return {}

  const isMac = process.platform === "darwin"
  const COOLDOWN_MS = Number(process.env.OPENCODE_STALE_COOLDOWN_MS ?? 30_000)
  const MAX_NUDGES = Number(process.env.OPENCODE_STALE_MAX_NUDGES ?? 5)
  const skipPrompt = process.env.OPENCODE_STALE_NO_PROMPT === "1"

  return {
    "todo.updated": async (input: any) => {
      const todos: Todo[] = input.todos ?? []
      const sessionId: string = input.sessionId ?? input.session_id ?? "unknown"
      todosBySession.set(sessionId, todos)
    },

    event: async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      if (event.type === "session.deleted") {
        todosBySession.delete(sessionId)
        nudgeState.delete(sessionId)
        return
      }

      if (event.type !== "session.idle") return

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

      // ── Continuation prompt injection ──────────────────────────────────────
      if (skipPrompt) return

      const now = Date.now()
      const state = nudgeState.get(sessionId) ?? { lastNudgeAt: 0, nudgeCount: 0 }

      // Respect cooldown and max nudge cap
      if (state.nudgeCount >= MAX_NUDGES) return
      if (now - state.lastNudgeAt < COOLDOWN_MS) return

      // Build a focused continuation prompt listing exact stale items
      const todoLines = [
        ...inProgress.map((t) => `- [in_progress] ${t.content}`),
        ...pending.slice(0, 5).map((t) => `- [pending] ${t.content}`),
      ]
      if (pending.length > 5) todoLines.push(`- … and ${pending.length - 5} more pending`)

      const promptText =
        `You went idle but the following todos are still unfinished:\n\n` +
        todoLines.join("\n") +
        `\n\nContinue working through them. Pick the first unfinished item, mark it in_progress, and proceed.`

      try {
        await (client as any).postSessionByIdMessage({
          path: { id: sessionId },
          body: { role: "user", content: promptText },
        })

        nudgeState.set(sessionId, { lastNudgeAt: now, nudgeCount: state.nudgeCount + 1 })

        await client.app.log({
          body: {
            service: "stale-todo-guard",
            level: "info",
            message: `Injected continuation prompt (nudge ${state.nudgeCount + 1}/${MAX_NUDGES})`,
            extra: { session_id: sessionId, stale_count: stale.length },
          },
        })
      } catch {
        // Injection API may differ across versions — non-fatal
      }
    },
  }
}
