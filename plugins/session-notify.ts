/**
 * session-notify — macOS desktop notifications for agent attention events
 *
 * Fires on two events:
 *   - `permission.asked`: agent is waiting for you to approve/deny a tool call
 *   - `session.idle`:     agent finished responding and is waiting for your next prompt
 *
 * Both send native macOS notifications via `osascript` so you can leave the
 * terminal and be alerted when action is needed.
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

const notify = async ($: any, message: string, sound: string): Promise<void> => {
  try {
    await $`osascript -e ${`display notification "${message}" with title "OpenCode" sound name "${sound}"`}`.quiet()
  } catch {
    // Notification failure is non-fatal — silently ignore
  }
}

export const SessionNotifyPlugin: Plugin = async ({ $ }) => {
  // Only register on macOS
  if (process.platform !== "darwin") return {}

  return {
    "permission.asked": async ({ event }: { event: any }) => {
      if (process.env.OPENCODE_NO_NOTIFY === "1") return

      const tool: string = event.properties?.tool ?? event.properties?.toolName ?? "a tool"
      await notify($, `Waiting for your approval: ${tool}`, "Glass")
    },

    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.idle") return
      if (process.env.OPENCODE_NO_NOTIFY === "1") return

      await notify($, "Agent is done — ready for your next prompt.", "Submarine")
    },
  }
}
