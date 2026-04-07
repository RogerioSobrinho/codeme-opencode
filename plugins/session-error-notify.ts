import type { Plugin } from "@opencode-ai/plugin"

/**
 * session-error-notify — alerta imediato quando uma sessão crasha com erro
 *
 * Ouve `session.error` e dispara:
 *   1. Notificação macOS via osascript (som Sosumi — distinto do idle/permission)
 *   2. Toast de erro no TUI via client.tui.showToast
 *   3. Log estruturado via client.app.log com detalhes do erro
 *
 * Diferente do session-notify (que só cobre idle e permission.asked), este
 * plugin cobre exclusivamente falhas — timeout de modelo, crash do servidor,
 * resposta inválida, etc. — que hoje passam silenciosas.
 *
 * Configuração:
 *   OPENCODE_NO_NOTIFY=1 — desativa notificações macOS e toast (compartilhado)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const SessionErrorNotifyPlugin: Plugin = async ({ $, client }) => {
  const isMac = process.platform === "darwin"

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.error") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
      const errorMsg: string =
        event.properties?.error ??
        event.properties?.message ??
        event.properties?.reason ??
        "Unknown error"

      // 1. Log estruturado
      await client.app.log({
        body: {
          service: "session-error-notify",
          level: "error",
          message: `Session ${sessionId.slice(0, 8)} crashed: ${errorMsg}`,
          extra: {
            session_id: sessionId,
            error: errorMsg,
            event_properties: event.properties,
          },
        },
      })

      if (process.env.OPENCODE_NO_NOTIFY === "1") return

      // 2. Toast no TUI
      try {
        await (client.tui as any).showToast({
          body: {
            message: `Session error: ${errorMsg.slice(0, 80)}`,
            variant: "error",
          },
        })
      } catch {
        // TUI pode não estar disponível (ex: modo headless) — não é fatal
      }

      // 3. Notificação macOS
      if (!isMac) return
      try {
        const msg = `Session crashed: ${errorMsg.slice(0, 60)}`
        await $`osascript -e ${`display notification "${msg}" with title "OpenCode — Error" sound name "Sosumi"`}`.quiet()
      } catch {
        // Não fatal
      }
    },
  }
}
