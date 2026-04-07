import type { Plugin } from "@opencode-ai/plugin"

/**
 * diff-summary — logs a git diff summary when a session goes idle
 *
 * Runs `git diff --stat HEAD` whenever the agent finishes responding, giving
 * a quick overview of how many files and lines were changed during the session.
 *
 * Skips silently if:
 *   - Not inside a git repository
 *   - There are no uncommitted changes
 *   - The git command fails for any reason
 *
 * Log format:
 *   [diff-summary] 3 files changed, 42 insertions(+), 7 deletions(-)
 *     M  src/routes/users.ts
 *     M  src/services/auth.ts
 *     A  src/utils/token.ts
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const DiffSummaryPlugin: Plugin = async ({ $, client }) => {
  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.idle") return

      let stat = ""
      let nameStatus = ""

      try {
        stat = (await $`git diff --stat HEAD`.quiet().text()).trim()
        nameStatus = (await $`git diff --name-status HEAD`.quiet().text()).trim()
      } catch {
        // Not a git repo or no commits yet — skip silently
        return
      }

      if (!stat) return

      // Extract the summary line (last line of --stat output)
      const lines = stat.split("\n")
      const summary = lines[lines.length - 1]?.trim() ?? stat.trim()

      // Format changed files list
      const fileLines = nameStatus
        .split("\n")
        .filter(Boolean)
        .map((line) => `  ${line}`)
        .join("\n")

      await client.app.log({
        body: {
          service: "diff-summary",
          level: "info",
          message: `${summary}\n${fileLines}`,
          extra: { stat, name_status: nameStatus },
        },
      })
    },
  }
}
