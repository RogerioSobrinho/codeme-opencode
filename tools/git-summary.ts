import { tool } from "@opencode-ai/plugin"

/**
 * git-summary — Returns branch, status, recent log, and diff stats in a
 * single structured JSON response.
 *
 * Replaces the pattern of agents making 3–4 separate git bash calls to
 * understand the current repository state. Used by write-commit, code-review,
 * pr-review, and orchestrator.
 */
export default tool({
  description:
    "Returns a structured summary of the current git repository state: " +
    "active branch, working tree status (staged/unstaged/untracked), " +
    "last N commits, and diff stats (files changed, insertions, deletions). " +
    "Use before writing commit messages, reviewing changes, or planning next steps.",
  args: {
    log_count: tool.schema
      .number()
      .optional()
      .describe("Number of recent commits to include. Defaults to 10."),
    include_diff_stat: tool.schema
      .boolean()
      .optional()
      .describe("Include per-file diff stats for staged changes. Defaults to true."),
  },
  async execute(args, context) {
    const dir = context.worktree || context.directory
    const n = args.log_count ?? 10
    const diffStat = args.include_diff_stat !== false

    // ── Check this is a git repo ──────────────────────────────────────────────
    try {
      await Bun.$`git -C ${dir} rev-parse --git-dir`.quiet()
    } catch {
      return JSON.stringify({ error: "Not a git repository.", directory: dir })
    }

    // ── Branch ────────────────────────────────────────────────────────────────
    let branch = "unknown"
    try {
      branch = (await Bun.$`git -C ${dir} rev-parse --abbrev-ref HEAD`.text()).trim()
    } catch { /* detached HEAD or empty repo */ }

    // ── Status ────────────────────────────────────────────────────────────────
    let statusRaw = ""
    try {
      statusRaw = (await Bun.$`git -C ${dir} status --porcelain`.text()).trim()
    } catch { /* ignore */ }

    const staged: string[] = []
    const unstaged: string[] = []
    const untracked: string[] = []

    for (const line of statusRaw.split("\n").filter(Boolean)) {
      const xy = line.slice(0, 2)
      const file = line.slice(3).trim()
      const x = xy[0] // index (staged)
      const y = xy[1] // worktree (unstaged)

      if (x !== " " && x !== "?") staged.push(`${x} ${file}`)
      if (y !== " " && y !== "?") unstaged.push(`${y} ${file}`)
      if (xy === "??") untracked.push(file)
    }

    // ── Log ───────────────────────────────────────────────────────────────────
    let log: Array<{ hash: string; author: string; date: string; subject: string }> = []
    try {
      const logRaw = (
        await Bun.$`git -C ${dir} log --oneline -${n} --format=%H%x1f%an%x1f%ad%x1f%s --date=short`.text()
      ).trim()

      log = logRaw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash, author, date, ...rest] = line.split("\x1f")
          return { hash: hash?.slice(0, 8) ?? "", author: author ?? "", date: date ?? "", subject: rest.join(" ") }
        })
    } catch { /* empty repo */ }

    // ── Diff stats (staged) ───────────────────────────────────────────────────
    let diffStats: { files: number; insertions: number; deletions: number; detail: string[] } | null = null
    if (diffStat) {
      try {
        const statRaw = (await Bun.$`git -C ${dir} diff --cached --stat`.text()).trim()
        const summary = statRaw.split("\n").pop() ?? ""
        const filesMatch = summary.match(/(\d+) file/)
        const insMatch = summary.match(/(\d+) insertion/)
        const delMatch = summary.match(/(\d+) deletion/)
        const detail = statRaw
          .split("\n")
          .slice(0, -1)
          .map((l) => l.trim())
          .filter(Boolean)
        diffStats = {
          files: filesMatch ? parseInt(filesMatch[1]) : 0,
          insertions: insMatch ? parseInt(insMatch[1]) : 0,
          deletions: delMatch ? parseInt(delMatch[1]) : 0,
          detail,
        }
      } catch { /* nothing staged */ }
    }

    // ── Remote sync status ────────────────────────────────────────────────────
    let ahead = 0
    let behind = 0
    try {
      const revCount = (
        await Bun.$`git -C ${dir} rev-list --left-right --count @{upstream}...HEAD`.quiet().text()
      ).trim()
      const [b, a] = revCount.split("\t").map(Number)
      behind = b ?? 0
      ahead = a ?? 0
    } catch { /* no upstream */ }

    return JSON.stringify({
      branch,
      ahead,
      behind,
      status: { staged, unstaged, untracked },
      log,
      diffStats,
    })
  },
})
