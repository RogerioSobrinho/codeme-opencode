import type { Plugin } from "@opencode-ai/plugin"

/**
 * tui-toast — toasts visuais inline no TUI para eventos de atenção
 *
 * Complementa session-notify.ts (que dispara notificações macOS) com feedback
 * visual diretamente no TUI do OpenCode, sem precisar olhar para outro lugar.
 *
 * Toasts disparados:
 *   session.idle       → success  "Agent is done — ready for your next prompt"
 *   permission.asked   → warning  "Waiting for approval: <tool>"
 *   session.error      → error    "Session error: <message>"
 *   todo.updated       → info     quando todos os todos são concluídos
 *
 * Configuração:
 *   OPENCODE_NO_TOAST=1 — desativa todos os toasts deste plugin
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const TuiToastPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_TOAST === "1") return {}

  async function toast(message: string, variant: "success" | "warning" | "error" | "info"): Promise<void> {
    try {
      await (client.tui as any).showToast({ body: { message, variant } })
    } catch {
      // TUI pode não estar disponível em modo headless — não fatal
    }
  }

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type === "session.idle") {
        await toast("Agent is done — ready for your next prompt.", "success")
        return
      }

      if (event.type === "permission.asked") {
        const tool: string =
          event.properties?.tool ?? event.properties?.toolName ?? "a tool"
        await toast(`Waiting for your approval: ${tool}`, "warning")
        return
      }

      if (event.type === "session.error") {
        const msg: string =
          event.properties?.error ??
          event.properties?.message ??
          "Unknown error"
        await toast(`Session error: ${msg.slice(0, 80)}`, "error")
        return
      }
    },

    "todo.updated": async (input: any) => {
      const todos: Array<{ status: string }> = input.todos ?? []
      if (todos.length === 0) return

      const allDone = todos.every(
        (t) => t.status === "completed" || t.status === "cancelled",
      )
      if (!allDone) return

      const count = todos.filter((t) => t.status === "completed").length
      await toast(`All ${count} task${count === 1 ? "" : "s"} completed.`, "success")
    },
  }
}
