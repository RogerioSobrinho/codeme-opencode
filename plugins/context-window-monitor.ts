import type { Plugin } from "@opencode-ai/plugin"

/**
 * context-window-monitor — warns when context usage approaches the limit
 *
 * On every `session.idle`, attempts to read the current token usage for the
 * session. When usage crosses configured thresholds, it:
 *   - At 70%: logs a warning and shows a TUI toast
 *   - At 85%: logs an urgent warning and injects a prompt suggesting /checkpoint
 *     (forcing the agent to compact or summarize before running out of context)
 *
 * This turns context overflow from a silent failure into a predictable,
 * actionable event.
 *
 * Note: token usage API shape varies by OpenCode version. This plugin
 * tries multiple known shapes and degrades gracefully when unavailable.
 *
 * Configuration:
 *   OPENCODE_NO_CTX_MONITOR=1    — disable entirely
 *   OPENCODE_CTX_WARN_PCT=70     — warning threshold % (default: 70)
 *   OPENCODE_CTX_URGENT_PCT=85   — urgent threshold % (default: 85)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

export const ContextWindowMonitorPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_CTX_MONITOR === "1") return {}

  const WARN_PCT = Number(process.env.OPENCODE_CTX_WARN_PCT ?? 70)
  const URGENT_PCT = Number(process.env.OPENCODE_CTX_URGENT_PCT ?? 85)

  // Track which sessions have already received an urgent nudge this idle cycle
  const nudgedSessions = new Set<string>()

  async function getTokenUsagePct(sessionId: string): Promise<number | null> {
    try {
      // Try known API shapes for session info
      const res = await (client as any).session.get({ path: { id: sessionId } })
      const data = (res as any)?.data ?? res

      // Shape 1: { tokens: { used, limit } }
      if (data?.tokens?.used != null && data?.tokens?.limit != null) {
        return (data.tokens.used / data.tokens.limit) * 100
      }
      // Shape 2: { context: { used, max } }
      if (data?.context?.used != null && data?.context?.max != null) {
        return (data.context.used / data.context.max) * 100
      }
      // Shape 3: { usage: { input_tokens }, model: { context_window } }
      if (data?.usage?.input_tokens != null && data?.model?.context_window != null) {
        return (data.usage.input_tokens / data.model.context_window) * 100
      }
    } catch {
      // API unavailable — degrade gracefully
    }
    return null
  }

  async function showToast(message: string, variant: "warning" | "error"): Promise<void> {
    try {
      await (client.tui as any).showToast({ body: { message, variant } })
    } catch {
      // TUI not available
    }
  }

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.idle") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      const pct = await getTokenUsagePct(sessionId)
      if (pct == null) return

      const pctStr = pct.toFixed(0)

      if (pct >= URGENT_PCT) {
        await client.app.log({
          body: {
            service: "context-window-monitor",
            level: "warn",
            message: `URGENT: Context at ${pctStr}% — compaction or /checkpoint recommended immediately`,
            extra: { session_id: sessionId, usage_pct: pct },
          },
        })

        await showToast(`Context at ${pctStr}% — run /checkpoint now`, "error")

        // Inject one nudge per session (not every idle)
        if (!nudgedSessions.has(sessionId)) {
          nudgedSessions.add(sessionId)
          try {
            await (client as any).postSessionByIdMessage({
              path: { id: sessionId },
              body: {
                role: "user",
                content:
                  `⚠️ Context window is at ${pctStr}% capacity. ` +
                  `Before continuing, run /checkpoint to save state and compact the context. ` +
                  `If you are mid-task, finish the current step first, then run /checkpoint.`,
              },
            })
          } catch {
            // Injection API may not be available
          }
        }

        return
      }

      if (pct >= WARN_PCT) {
        await client.app.log({
          body: {
            service: "context-window-monitor",
            level: "warn",
            message: `Context at ${pctStr}% — consider running /checkpoint soon`,
            extra: { session_id: sessionId, usage_pct: pct },
          },
        })

        await showToast(`Context at ${pctStr}% — consider /checkpoint`, "warning")
      }
    },

    "session.deleted": async (input: any) => {
      const sessionId: string = input?.sessionId ?? input?.session_id ?? "unknown"
      nudgedSessions.delete(sessionId)
    },
  }
}
