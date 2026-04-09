import type { Plugin } from "@opencode-ai/plugin"

/**
 * doom-loop-notify — alerta quando o agente entra em loop infinito
 *
 * O OpenCode detecta automaticamente quando o mesmo tool call se repete 3x
 * com input idêntico (doom_loop) e nega a execução. Sem este plugin, isso
 * acontece silenciosamente — o agente para, mas o usuário não sabe por quê.
 *
 * Este plugin intercepta o evento permission.asked com tool === "doom_loop"
 * e dispara:
 *   - Log estruturado com tool name e session id
 *   - Toast TUI com aviso visual imediato
 *   - Notificação macOS (som Basso = tom de erro grave)
 *
 * O plugin NÃO aprova nem nega a permissão — isso é controlado pelo
 * `opencode.json` (`"doom_loop": "deny"`). Ele apenas notifica.
 *
 * Configuração:
 *   OPENCODE_NO_DOOM_NOTIFY=1 — desativa este plugin
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const DoomLoopNotifyPlugin: Plugin = async ({ client, $ }) => {
  if (process.env.OPENCODE_NO_DOOM_NOTIFY === "1") return {}

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "permission.asked") return

      const toolName: string =
        event.properties?.tool ??
        event.properties?.toolName ??
        event.properties?.tool_name ??
        ""

      if (toolName !== "doom_loop") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      const repeatedTool: string =
        event.properties?.repeated_tool ??
        event.properties?.repeatedTool ??
        event.properties?.loop_tool ??
        "unknown tool"

      const message = `Doom loop detected: agent called "${repeatedTool}" 3x with identical input. Blocking.`

      // Structured log
      await client.app.log({
        body: {
          service: "doom-loop-notify",
          level: "warn",
          message,
          extra: {
            session_id: sessionId,
            repeated_tool: repeatedTool,
          },
        },
      })

      // TUI toast
      try {
        await (client.tui as any).showToast({
          body: {
            message: `Loop infinito bloqueado: "${repeatedTool}" repetida 3x. Corrija o contexto e tente novamente.`,
            variant: "error",
          },
        })
      } catch {
        // TUI unavailable in headless mode — not fatal
      }

      // macOS notification (Basso = serious error sound)
      try {
        await $`osascript -e ${`display notification "Doom loop bloqueado: \"${repeatedTool}\" repetida 3x com input idêntico." with title "OpenCode — Loop Detectado" sound name "Basso"`}`
      } catch {
        // Not macOS or osascript unavailable — not fatal
      }

      // Inject escape hint so the agent knows what to do next
      try {
        const sessionId: string =
          event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
        await (client as any).postSessionByIdMessage({
          path: { id: sessionId },
          body: {
            role: "system",
            content:
              `[doom-loop-notify] You have called "${repeatedTool}" 3 times with identical input. ` +
              `This call has been blocked to prevent an infinite loop. ` +
              `Stop repeating this action. Instead: (1) re-read the relevant file to verify your assumptions, ` +
              `(2) try a different approach, or (3) ask the user for clarification.`,
          },
        })
      } catch {
        // System message injection not supported or session unavailable — not fatal
      }
    },
  }
}
