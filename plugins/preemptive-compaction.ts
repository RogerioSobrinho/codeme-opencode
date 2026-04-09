import type { Plugin } from "@opencode-ai/plugin"

/**
 * preemptive-compaction — triggers context compaction before hitting the limit
 *
 * The default compaction fires reactively when the context window is full,
 * which can cause a mid-thought interruption. This plugin fires proactively
 * at a configurable threshold (default: 78%) so compaction happens at a
 * clean boundary — after an idle, while the agent is between tasks.
 *
 * Behavior:
 *   - On `session.idle`, reads token usage from the session API
 *   - If usage >= threshold and cooldown has elapsed, triggers compaction
 *   - Cooldown prevents re-triggering on the same session too frequently
 *   - Degrades gracefully when token usage API is unavailable
 *   - Cleans up per-session state on session.deleted
 *
 * Configuration:
 *   OPENCODE_NO_PREEMPTIVE_COMPACT=1    — disable entirely
 *   OPENCODE_PREEMPTIVE_COMPACT_PCT=78  — trigger threshold % (default: 78)
 *   OPENCODE_PREEMPTIVE_COMPACT_COOLDOWN_MS=60000 — cooldown in ms (default: 60s)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const PREEMPTIVE_THRESHOLD = Number(process.env.OPENCODE_PREEMPTIVE_COMPACT_PCT ?? 78)
const COOLDOWN_MS = Number(process.env.OPENCODE_PREEMPTIVE_COMPACT_COOLDOWN_MS ?? 60_000)

export const PreemptiveCompactionPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_PREEMPTIVE_COMPACT === "1") return {}

  // sessionId → timestamp of last compaction trigger
  const lastCompactedAt = new Map<string, number>()

  async function getTokenUsagePct(sessionId: string): Promise<number | null> {
    try {
      const res = await (client as any).session.get({ path: { id: sessionId } })
      const data = (res as any)?.data ?? res

      if (data?.tokens?.used != null && data?.tokens?.limit != null) {
        return (data.tokens.used / data.tokens.limit) * 100
      }
      if (data?.context?.used != null && data?.context?.max != null) {
        return (data.context.used / data.context.max) * 100
      }
      if (data?.usage?.input_tokens != null && data?.model?.context_window != null) {
        return (data.usage.input_tokens / data.model.context_window) * 100
      }
    } catch {
      // API unavailable — degrade gracefully
    }
    return null
  }

  async function triggerCompaction(sessionId: string): Promise<void> {
    // Try known API shapes for triggering compaction
    try {
      await (client as any).postSessionByIdCompact({
        path: { id: sessionId },
        body: {},
      })
      return
    } catch { /* try next shape */ }

    try {
      await (client as any).session.compact({
        path: { id: sessionId },
      })
      return
    } catch { /* try next shape */ }

    // Fallback: inject a system message asking the agent to compact
    try {
      await (client as any).postSessionByIdMessage({
        path: { id: sessionId },
        body: {
          role: "system",
          content:
            `[preemptive-compaction] Context window is at or above ${PREEMPTIVE_THRESHOLD}%. ` +
            `Please run /checkpoint now to compact the context and preserve state before continuing.`,
        },
      })
    } catch { /* all attempts failed */ }
  }

  return {
    "session.deleted": async (input: any) => {
      const sessionId: string = input?.sessionId ?? input?.session_id ?? "unknown"
      lastCompactedAt.delete(sessionId)
    },

    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.idle") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // Cooldown: don't trigger again too soon
      const last = lastCompactedAt.get(sessionId) ?? 0
      if (Date.now() - last < COOLDOWN_MS) return

      const pct = await getTokenUsagePct(sessionId)
      if (pct == null || pct < PREEMPTIVE_THRESHOLD) return

      lastCompactedAt.set(sessionId, Date.now())

      await client.app.log({
        body: {
          service: "preemptive-compaction",
          level: "info",
          message: `Triggering preemptive compaction at ${pct.toFixed(0)}% context usage`,
          extra: { session_id: sessionId, usage_pct: pct, threshold: PREEMPTIVE_THRESHOLD },
        },
      })

      await triggerCompaction(sessionId)
    },
  }
}
