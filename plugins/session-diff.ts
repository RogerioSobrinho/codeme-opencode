import type { Plugin } from "@opencode-ai/plugin"

/**
 * session-diff — log rico de diff usando o evento session.diff
 *
 * O OpenCode emite `session.diff` com os dados do diff já processados,
 * incluindo a lista de arquivos modificados, adições e remoções. Isso é
 * superior ao `diff-summary` que rodava `git diff --stat HEAD` manualmente,
 * pois:
 *   - Recebe o dado diretamente da plataforma (sem fork de processo)
 *   - Inclui metadata da sessão (session_id, timestamp)
 *   - Dispara para cada diff, não só no idle
 *   - Integra com o sistema de log estruturado nativamente
 *
 * O `diff-summary` (git diff --stat no idle) continua útil como fallback
 * para projetos que não expõem session.diff.
 *
 * Comportamento:
 *   - Loga cada diff com arquivos, adições e remoções
 *   - Mostra toast TUI com resumo compacto quando habilitado
 *   - Skipa se não houver mudanças reais
 *
 * Configuração:
 *   OPENCODE_NO_SESSION_DIFF=1    — desativa o plugin
 *   OPENCODE_DIFF_TOAST=1         — mostra toast TUI (padrão: off)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const SessionDiffPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_SESSION_DIFF === "1") return {}

  const toastEnabled = process.env.OPENCODE_DIFF_TOAST === "1"

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.diff") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // Extract diff data from event properties
      // The exact shape depends on the OpenCode version — handle defensively
      const diff = event.properties?.diff ?? event.properties ?? {}
      const files: Array<{ path?: string; file?: string; added?: number; removed?: number }> =
        diff.files ?? diff.changed_files ?? []
      const totalAdded: number = diff.added ?? diff.insertions ?? 0
      const totalRemoved: number = diff.removed ?? diff.deletions ?? 0
      const totalFiles: number = files.length || (diff.files_changed ?? 0)

      if (totalFiles === 0 && totalAdded === 0 && totalRemoved === 0) return

      const summary = `${totalFiles} file${totalFiles === 1 ? "" : "s"} changed, +${totalAdded} -${totalRemoved}`

      const fileLines = files
        .map((f) => {
          const name = f.path ?? f.file ?? "?"
          const added = f.added ?? 0
          const removed = f.removed ?? 0
          return `  ${name}  (+${added} -${removed})`
        })
        .join("\n")

      await client.app.log({
        body: {
          service: "session-diff",
          level: "info",
          message: fileLines ? `${summary}\n${fileLines}` : summary,
          extra: {
            session_id: sessionId,
            files_changed: totalFiles,
            added: totalAdded,
            removed: totalRemoved,
          },
        },
      })

      if (toastEnabled && totalFiles > 0) {
        try {
          await (client.tui as any).showToast({
            body: {
              message: summary,
              variant: "info",
            },
          })
        } catch {
          // TUI not available — not fatal
        }
      }
    },
  }
}
