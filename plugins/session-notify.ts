/**
 * session-notify — macOS desktop notification when session goes idle
 *
 * Fires on `session.idle` (agent finished responding and is waiting for input).
 * Sends a native macOS notification via `osascript` so you can leave the
 * terminal and be notified when the agent is done.
 *
 * Behaviour:
 *   - Only fires on macOS (checks `process.platform === "darwin"`)
 *   - Skips if OPENCODE_NO_NOTIFY=1 is set in the environment
 *   - Non-blocking: notification failure never crashes the session
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"

export const SessionNotifyPlugin: Plugin = async ({ $ }) => {
  // Only register on macOS
  if (process.platform !== "darwin") return {}

  return {
    event: async ({ event }) => {
      if (event.type !== "session.idle") return
      if (process.env.OPENCODE_NO_NOTIFY === "1") return

      try {
        await $`osascript -e 'display notification "Agent is done — ready for your next prompt." with title "OpenCode" sound name "Submarine"'`.quiet()
      } catch {
        // Notification failure is non-fatal — silently ignore
      }
    },
  }
}
