import type { Plugin } from "@opencode-ai/plugin"

/**
 * session-timer — tracks elapsed time per session
 *
 * Records when each session starts and logs the elapsed time whenever the
 * session goes idle (agent finished responding). Also warns when a session
 * has been running for more than 10 minutes.
 *
 * Log format:
 *   [session-timer] Session <id> idle after 2m 34s
 *   [session-timer] Session <id> still running — 12m 05s elapsed (long session)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const SessionTimerPlugin: Plugin = async ({ client }) => {
  const startTimes = new Map<string, number>()

  const LONG_SESSION_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

  function formatElapsed(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    if (minutes === 0) return `${seconds}s`
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`
  }

  return {
    event: async ({ event }: { event: any }) => {
      const sessionId: string = event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      if (event.type === "session.created") {
        startTimes.set(sessionId, Date.now())
        return
      }

      if (event.type === "session.idle") {
        const startedAt = startTimes.get(sessionId)
        if (startedAt == null) return

        const elapsed = Date.now() - startedAt
        const elapsedStr = formatElapsed(elapsed)
        const isLong = elapsed >= LONG_SESSION_THRESHOLD_MS

        await client.app.log({
          body: {
            service: "session-timer",
            level: "info",
            message: isLong
              ? `Session ${sessionId.slice(0, 8)} idle after ${elapsedStr} (long session)`
              : `Session ${sessionId.slice(0, 8)} idle after ${elapsedStr}`,
            extra: {
              session_id: sessionId,
              elapsed_ms: elapsed,
              elapsed_human: elapsedStr,
              long_session: isLong,
            },
          },
        })

        return
      }

      if (event.type === "session.deleted") {
        startTimes.delete(sessionId)
      }
    },
  }
}
