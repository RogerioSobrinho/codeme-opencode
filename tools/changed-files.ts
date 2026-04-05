import { tool } from "@opencode-ai/plugin"

/**
 * changed-files — Lists files modified in the current git working tree,
 * grouped by status (staged / unstaged / untracked) and rendered as a
 * navigable tree with +/~/- indicators.
 *
 * Used by orchestrator when decomposing tasks, and by code-review to quickly
 * understand the blast radius of staged changes before doing a full review.
 */
export default tool({
  description:
    "Lists all modified files in the current git working tree grouped by status: " +
    "staged (A/M/D/R), unstaged (modified/deleted), and untracked. " +
    "Renders as a directory tree with status indicators. " +
    "Use to understand what has changed before reviewing, committing, or planning next steps.",
  args: {
    scope: tool.schema
      .enum(["all", "staged", "unstaged", "untracked"])
      .optional()
      .describe(
        "Which changes to include. 'staged' = index only, 'unstaged' = worktree only, " +
          "'untracked' = new files not yet tracked, 'all' = everything. Defaults to 'all'.",
      ),
    since_commit: tool.schema
      .string()
      .optional()
      .describe(
        "Show files changed since this commit ref (e.g. 'HEAD~3', a SHA, or a branch name). " +
          "If omitted, shows current working tree changes.",
      ),
  },
  async execute(args, context) {
    const dir = context.worktree || context.directory
    const scope = args.scope ?? "all"

    // ── Check this is a git repo ──────────────────────────────────────────────
    try {
      await Bun.$`git -C ${dir} rev-parse --git-dir`.quiet()
    } catch {
      return JSON.stringify({ error: "Not a git repository.", directory: dir })
    }

    // ── Collect changed files ─────────────────────────────────────────────────
    type FileEntry = { path: string; status: string; statusLabel: string }

    const stagedFiles: FileEntry[] = []
    const unstagedFiles: FileEntry[] = []
    const untrackedFiles: FileEntry[] = []

    if (args.since_commit) {
      // Show files changed since a specific commit
      try {
        const raw = (
          await Bun.$`git -C ${dir} diff --name-status ${args.since_commit}...HEAD`.text()
        ).trim()
        for (const line of raw.split("\n").filter(Boolean)) {
          const parts = line.split("\t")
          const status = parts[0]?.trim() ?? "M"
          const filePath = parts[parts.length - 1]?.trim() ?? ""
          stagedFiles.push({
            path: filePath,
            status,
            statusLabel: statusToLabel(status),
          })
        }
      } catch { /* ignore */ }
    } else {
      // Current working tree
      try {
        const raw = (await Bun.$`git -C ${dir} status --porcelain`.text()).trim()
        for (const line of raw.split("\n").filter(Boolean)) {
          const xy = line.slice(0, 2)
          const filePath = line.slice(3).trim().replace(/^"(.*)"$/, "$1") // strip quotes
          const x = xy[0] // index
          const y = xy[1] // worktree

          if (xy === "??") {
            untrackedFiles.push({ path: filePath, status: "?", statusLabel: "untracked" })
            continue
          }
          if (x !== " ") {
            stagedFiles.push({ path: filePath, status: x, statusLabel: statusToLabel(x) })
          }
          if (y !== " ") {
            unstagedFiles.push({ path: filePath, status: y, statusLabel: statusToLabel(y) })
          }
        }
      } catch { /* ignore */ }
    }

    // ── Build tree ────────────────────────────────────────────────────────────
    const sections: Record<string, FileEntry[]> = {}

    if (scope === "all" || scope === "staged") {
      if (stagedFiles.length) sections["staged"] = stagedFiles
    }
    if (scope === "all" || scope === "unstaged") {
      if (unstagedFiles.length) sections["unstaged"] = unstagedFiles
    }
    if (scope === "all" || scope === "untracked") {
      if (untrackedFiles.length) sections["untracked"] = untrackedFiles
    }

    const totalFiles =
      (sections.staged?.length ?? 0) +
      (sections.unstaged?.length ?? 0) +
      (sections.untracked?.length ?? 0)

    if (totalFiles === 0) {
      return JSON.stringify({
        summary: "No changed files found.",
        scope,
        since_commit: args.since_commit ?? null,
        tree: "",
        files: [],
      })
    }

    // ── Render tree ───────────────────────────────────────────────────────────
    const allFiles: FileEntry[] = [
      ...(sections.staged ?? []),
      ...(sections.unstaged ?? []),
      ...(sections.untracked ?? []),
    ]

    const tree = renderTree(sections)

    return JSON.stringify({
      summary: `${totalFiles} file(s) changed`,
      scope,
      since_commit: args.since_commit ?? null,
      counts: {
        staged: sections.staged?.length ?? 0,
        unstaged: sections.unstaged?.length ?? 0,
        untracked: sections.untracked?.length ?? 0,
      },
      tree,
      files: allFiles,
    })
  },
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusToLabel(s: string): string {
  const map: Record<string, string> = {
    A: "added",
    M: "modified",
    D: "deleted",
    R: "renamed",
    C: "copied",
    U: "updated",
    "?": "untracked",
  }
  return map[s] ?? s
}

function statusToIcon(s: string): string {
  const map: Record<string, string> = {
    A: "+",
    M: "~",
    D: "-",
    R: "→",
    C: "→",
    U: "~",
    "?": "?",
  }
  return map[s] ?? "~"
}

function renderTree(sections: Record<string, Array<{ path: string; status: string }>>): string {
  const lines: string[] = []

  for (const [sectionName, files] of Object.entries(sections)) {
    lines.push(`[${sectionName}]`)

    // Group by directory
    const byDir = new Map<string, Array<{ name: string; status: string }>>()
    for (const f of files) {
      const parts = f.path.split("/")
      const name = parts.pop() ?? f.path
      const dirKey = parts.join("/") || "."
      if (!byDir.has(dirKey)) byDir.set(dirKey, [])
      byDir.get(dirKey)!.push({ name, status: f.status })
    }

    const dirs = Array.from(byDir.entries()).sort(([a], [b]) => a.localeCompare(b))
    for (const [dir, entries] of dirs) {
      if (dir !== ".") lines.push(`  ${dir}/`)
      for (const entry of entries) {
        const icon = statusToIcon(entry.status)
        const indent = dir !== "." ? "    " : "  "
        lines.push(`${indent}${icon} ${entry.name}`)
      }
    }

    lines.push("")
  }

  return lines.join("\n").trimEnd()
}
