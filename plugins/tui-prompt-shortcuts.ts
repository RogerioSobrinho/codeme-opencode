import type { Plugin } from "@opencode-ai/plugin"

/**
 * tui-prompt-shortcuts — appends quick-action snippets ao prompt do TUI
 *
 * O evento `tui.prompt.append` permite injetar texto no prompt de input do
 * usuário de forma programática. Este plugin usa isso para adicionar snippets
 * de contexto automáticos quando certas condições são detectadas, reduzindo
 * a necessidade de digitação repetitiva.
 *
 * Snippets injetados automaticamente:
 *
 *   1. Ao criar uma nova sessão em branch de feature:
 *      Appends o nome da branch atual como contexto para o agente.
 *
 *   2. Quando há todos pendentes na sessão:
 *      Appends contagem de todos pendentes no prompt ao entrar idle.
 *
 * Configuração:
 *   OPENCODE_NO_PROMPT_SHORTCUTS=1 — desativa o plugin
 *   OPENCODE_APPEND_BRANCH=0       — não appenda branch no prompt (padrão: 1)
 *   OPENCODE_APPEND_TODOS=0        — não appenda contagem de todos (padrão: 1)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const TuiPromptShortcutsPlugin: Plugin = async ({ client, $, worktree }) => {
  if (process.env.OPENCODE_NO_PROMPT_SHORTCUTS === "1") return {}

  const appendBranch = process.env.OPENCODE_APPEND_BRANCH !== "0"
  const appendTodos = process.env.OPENCODE_APPEND_TODOS !== "0"

  // Track which sessions already had branch context appended
  const appendedSessions = new Set<string>()

  // Track pending todos per session
  const pendingCountBySession = new Map<string, number>()

  async function getCurrentBranch(): Promise<string> {
    try {
      return (await $`git -C ${worktree} rev-parse --abbrev-ref HEAD`.quiet().text()).trim()
    } catch {
      return ""
    }
  }

  function isFeatureBranch(branch: string): boolean {
    const PROTECTED = new Set(["main", "master", "develop", "dev", "staging", "production", "HEAD"])
    return !PROTECTED.has(branch) && branch.length > 0
  }

  async function appendToPrompt(text: string): Promise<void> {
    try {
      await (client.tui as any).promptAppend({
        body: { text },
      })
    } catch {
      try {
        await (client as any).postTuiPromptAppend({
          body: { text },
        })
      } catch {
        // Give up silently
      }
    }
  }

  return {
    "todo.updated": async (input: any) => {
      const todos: any[] = input.todos ?? []
      const sessionId: string = input.sessionId ?? input.session_id ?? "unknown"
      const pending = todos.filter(
        (t: any) => t.status === "pending" || t.status === "in_progress",
      ).length
      pendingCountBySession.set(sessionId, pending)
    },

    "session.deleted": async (input: any) => {
      const sessionId: string = input?.sessionId ?? input?.session_id ?? "unknown"
      appendedSessions.delete(sessionId)
      pendingCountBySession.delete(sessionId)
    },

    event: async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      if (event.type === "session.created") {
        if (!appendBranch) return
        if (appendedSessions.has(sessionId)) return
        appendedSessions.add(sessionId)

        const branch = await getCurrentBranch()
        if (!branch || !isFeatureBranch(branch)) return

        await appendToPrompt(`[branch: ${branch}] `)

        await client.app.log({
          body: {
            service: "tui-prompt-shortcuts",
            level: "debug",
            message: `Appended branch context to prompt: ${branch}`,
            extra: { session_id: sessionId, branch },
          },
        })

        return
      }

      if (event.type === "session.idle" && appendTodos) {
        const pending = pendingCountBySession.get(sessionId) ?? 0
        if (pending === 0) return

        const label = pending === 1 ? "1 pending todo" : `${pending} pending todos`
        await appendToPrompt(`[${label}] `)

        await client.app.log({
          body: {
            service: "tui-prompt-shortcuts",
            level: "debug",
            message: `Appended pending todos count to prompt: ${pending}`,
            extra: { session_id: sessionId, pending_todos: pending },
          },
        })
      }
    },
  }
}
