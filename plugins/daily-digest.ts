import type { Plugin } from "@opencode-ai/plugin"

/**
 * daily-digest — logs a summary of today's git activity when a session starts
 *
 * On `session.created`, runs a set of git commands scoped to today (since
 * midnight local time) and logs a structured digest:
 *
 *   - Commits made today (count + one-liner each)
 *   - Branches touched today
 *   - Files most changed today (top 5 by change frequency)
 *   - Current branch
 *
 * Fires only once per calendar day per repo (deduped in-memory per worktree).
 * Skips silently if not inside a git repo or if there is no activity today.
 *
 * Configuration:
 *   OPENCODE_NO_DIGEST=1 — disable the plugin entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const DailyDigestPlugin: Plugin = async ({ $, client, worktree }) => {
  if (process.env.OPENCODE_NO_DIGEST === "1") return {}

  // Dedup: fire at most once per day per worktree
  const lastFiredDate = new Map<string, string>()

  function todayStr(): string {
    return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  }

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.created") return

      const today = todayStr()
      const key = worktree
      if (lastFiredDate.get(key) === today) return

      // ── Check if inside a git repo ──────────────────────────────────────────
      try {
        await $`git rev-parse --git-dir`.quiet()
      } catch {
        return // Not a git repo
      }

      lastFiredDate.set(key, today)

      // ── Gather git data scoped to today ─────────────────────────────────────
      let commits = ""
      let currentBranch = ""
      let allBranchesTouched = ""
      let filesChanged = ""

      try {
        commits = (
          await $`git log --since=midnight --oneline --no-merges`.quiet().text()
        ).trim()
      } catch { /* skip */ }

      try {
        currentBranch = (
          await $`git rev-parse --abbrev-ref HEAD`.quiet().text()
        ).trim()
      } catch { /* skip */ }

      try {
        allBranchesTouched = (
          await $`git log --since=midnight --format=%D --no-merges`.quiet().text()
        ).trim()
      } catch { /* skip */ }

      try {
        filesChanged = (
          await $`git log --since=midnight --name-only --format="" --no-merges`.quiet().text()
        ).trim()
      } catch { /* skip */ }

      // ── Nothing happened today ──────────────────────────────────────────────
      if (!commits) return

      // ── Parse ───────────────────────────────────────────────────────────────
      const commitLines = commits.split("\n").filter(Boolean)
      const commitCount = commitLines.length

      // Count file change frequency
      const fileCounts = new Map<string, number>()
      for (const f of filesChanged.split("\n").filter(Boolean)) {
        fileCounts.set(f, (fileCounts.get(f) ?? 0) + 1)
      }
      const topFiles = [...fileCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)

      // Unique branches from reflog-style output
      const branchSet = new Set<string>()
      for (const line of allBranchesTouched.split("\n")) {
        for (const ref of line.split(",")) {
          const clean = ref.trim().replace(/^HEAD -> /, "").replace(/^origin\//, "")
          if (clean && !clean.includes("->") && !clean.startsWith("tag:")) {
            branchSet.add(clean)
          }
        }
      }
      branchSet.delete("")

      // ── Build log message ───────────────────────────────────────────────────
      const lines: string[] = [
        `Daily digest for ${today} — ${commitCount} commit(s) on "${currentBranch}"`,
      ]

      lines.push(``)
      lines.push(`Commits today:`)
      for (const c of commitLines.slice(0, 10)) lines.push(`  ${c}`)
      if (commitLines.length > 10) lines.push(`  … and ${commitLines.length - 10} more`)

      if (branchSet.size > 1) {
        lines.push(``)
        lines.push(`Branches active today: ${[...branchSet].join(", ")}`)
      }

      if (topFiles.length > 0) {
        lines.push(``)
        lines.push(`Most changed files today:`)
        for (const [file, count] of topFiles) {
          lines.push(`  ${count}x  ${file}`)
        }
      }

      await client.app.log({
        body: {
          service: "daily-digest",
          level: "info",
          message: lines.join("\n"),
          extra: {
            date: today,
            commit_count: commitCount,
            current_branch: currentBranch,
            branches: [...branchSet],
            top_files: topFiles.map(([f, n]) => ({ file: f, count: n })),
          },
        },
      })

      // Inject digest as a system message so the agent has context on startup
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
      try {
        await (client as any).postSessionByIdMessage({
          path: { id: sessionId },
          body: {
            role: "system",
            content: `[daily-digest] ${lines.join("\n")}`,
          },
        })
      } catch {
        // System message injection not available — digest already in log
      }
    },
  }
}
