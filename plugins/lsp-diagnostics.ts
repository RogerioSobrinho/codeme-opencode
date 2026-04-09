import type { Plugin } from "@opencode-ai/plugin"

/**
 * lsp-diagnostics — injeta erros e warnings do LSP como contexto na sessão
 *
 * Ouve `lsp.client.diagnostics` e, quando há erros ou warnings em arquivos
 * ativamente editados, injeta os diagnósticos como contexto silencioso
 * (noReply: true) na sessão. O agente recebe as informações sem round-trip
 * manual de "rode o compilador e veja os erros".
 *
 * Comportamento:
 *   - Filtra por severidade: só `error` (1) e `warning` (2), ignora hint/info
 *   - Deduplica: não re-injeta o mesmo diagnóstico (arquivo+linha+mensagem)
 *     dentro da mesma sessão
 *   - Limita a 20 diagnósticos por injeção para não poluir o contexto
 *   - Só injeta se houver uma sessão ativa (rastreia a última via session.created)
 *   - Non-blocking: falha de injeção nunca interrompe a sessão
 *
 * Configuração:
 *   OPENCODE_NO_LSP_DIAG=1        — desativa o plugin inteiramente
 *   OPENCODE_LSP_DIAG_MAX=20      — máximo de diagnósticos por injeção (padrão: 20)
 *   OPENCODE_LSP_DIAG_ERRORS_ONLY=1 — injeta apenas errors, ignora warnings
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

// LSP DiagnosticSeverity: 1=Error, 2=Warning, 3=Information, 4=Hint
const LSP_ERROR = 1
const LSP_WARNING = 2

interface LspDiagnostic {
  message: string
  severity?: number
  range?: {
    start?: { line?: number; character?: number }
  }
  source?: string
  code?: string | number
}

export const LspDiagnosticsPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_LSP_DIAG === "1") return {}

  const MAX_DIAG = parseInt(process.env.OPENCODE_LSP_DIAG_MAX ?? "20", 10)
  const ERRORS_ONLY = process.env.OPENCODE_LSP_DIAG_ERRORS_ONLY === "1"

  // Tracks active sessions — Map<sessionId, true> for all live sessions
  // The most recently created session receives LSP diagnostics.
  // Using a Map (not a single variable) prevents multi-session corruption.
  const activeSessions = new Map<string, boolean>()
  let lastCreatedSessionId: string | null = null

  // Deduplica por sessão: Set de "file:line:message"
  const injectedBySession = new Map<string, Set<string>>()

  function getInjected(sessionId: string): Set<string> {
    if (!injectedBySession.has(sessionId)) {
      injectedBySession.set(sessionId, new Set())
    }
    return injectedBySession.get(sessionId)!
  }

  function diagKey(file: string, diag: LspDiagnostic): string {
    const line = diag.range?.start?.line ?? 0
    return `${file}:${line}:${diag.message}`
  }

  function formatDiagnostic(file: string, diag: LspDiagnostic): string {
    const severity = diag.severity === LSP_ERROR ? "error" : "warning"
    const line = (diag.range?.start?.line ?? 0) + 1
    const col = (diag.range?.start?.character ?? 0) + 1
    const source = diag.source ? ` [${diag.source}]` : ""
    const code = diag.code != null ? `(${diag.code}) ` : ""
    return `  ${severity}  ${file}:${line}:${col}  ${code}${diag.message}${source}`
  }

  return {
    event: async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      if (event.type === "session.created") {
        activeSessions.set(sessionId, true)
        lastCreatedSessionId = sessionId
        return
      }

      if (event.type === "session.deleted") {
        injectedBySession.delete(sessionId)
        activeSessions.delete(sessionId)
        if (lastCreatedSessionId === sessionId) {
          // Fall back to any remaining session (arbitrary but safe)
          lastCreatedSessionId = activeSessions.size > 0
            ? [...activeSessions.keys()][activeSessions.size - 1]
            : null
        }
        return
      }

      if (event.type !== "lsp.client.diagnostics") return
      if (!lastCreatedSessionId) return
      const activeSessionId = lastCreatedSessionId

      // Extrai diagnósticos do evento
      const uri: string = event.properties?.uri ?? event.properties?.file ?? ""
      const rawDiags: LspDiagnostic[] = event.properties?.diagnostics ?? []
      if (!uri || rawDiags.length === 0) return

      // Normaliza o path do arquivo (remove file://)
      const filePath = uri.replace(/^file:\/\//, "")

      // Filtra por severidade
      const minSeverity = ERRORS_ONLY ? LSP_ERROR : LSP_WARNING
      const relevant = rawDiags.filter(
        (d) => (d.severity ?? LSP_ERROR) <= minSeverity,
      )
      if (relevant.length === 0) return

      // Deduplica
      const injected = getInjected(activeSessionId)
      const newDiags = relevant.filter((d) => {
        const key = diagKey(filePath, d)
        if (injected.has(key)) return false
        injected.add(key)
        return true
      })
      if (newDiags.length === 0) return

      // Cap
      const toInject = newDiags.slice(0, MAX_DIAG)
      const errorCount = toInject.filter((d) => d.severity === LSP_ERROR).length
      const warnCount = toInject.filter((d) => d.severity === LSP_WARNING).length

      const lines: string[] = [
        `[lsp-diagnostics] ${toInject.length} new diagnostic(s) in ${filePath.split("/").pop()}` +
          ` (${errorCount} error${errorCount !== 1 ? "s" : ""}, ${warnCount} warning${warnCount !== 1 ? "s" : ""}):`,
        ``,
      ]
      for (const d of toInject) {
        lines.push(formatDiagnostic(filePath, d))
      }
      if (newDiags.length > MAX_DIAG) {
        lines.push(`  … and ${newDiags.length - MAX_DIAG} more (increase OPENCODE_LSP_DIAG_MAX to see all)`)
      }

      try {
        await client.session.prompt({
          path: { id: activeSessionId },
          body: {
            noReply: true,
            parts: [{ type: "text", text: lines.join("\n") }],
          } as any,
        })

        await client.app.log({
          body: {
            service: "lsp-diagnostics",
            level: "info",
            message: `Injected ${toInject.length} LSP diagnostic(s) from ${filePath.split("/").pop()}`,
            extra: { file: filePath, errors: errorCount, warnings: warnCount },
          },
        })
      } catch {
        // Reverte deduplicação para tentar na próxima vez
        for (const d of toInject) injected.delete(diagKey(filePath, d))
      }
    },
  }
}
