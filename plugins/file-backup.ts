import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * file-backup — creates a backup before the agent overwrites or edits large files
 *
 * Intercepts `tool.execute.before` on `write` and `edit` tool calls. If the
 * target file exists and is larger than FILE_BACKUP_MIN_LINES (default: 50),
 * a copy is saved to .opencode/backups/<timestamp>-<filename> before the
 * change is applied.
 *
 * This gives you a simple, human-readable safety net alongside the snapshot
 * system — especially useful when snapshots are disabled or when you want to
 * quickly inspect the pre-edit version of a file.
 *
 * Configuration via environment variables:
 *   FILE_BACKUP_MIN_LINES  — minimum line count to trigger backup (default: 50)
 *   FILE_BACKUP_DIR        — backup directory (default: .opencode/backups)
 *   FILE_BACKUP_MAX_AGE_H  — delete backups older than N hours (default: 24)
 *   OPENCODE_NO_BACKUP=1   — disable the plugin entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const FileBackupPlugin: Plugin = async ({ $, worktree }) => {
  if (process.env.OPENCODE_NO_BACKUP === "1") return {}

  const MIN_LINES = parseInt(process.env.FILE_BACKUP_MIN_LINES ?? "50", 10)
  const MAX_AGE_H = parseInt(process.env.FILE_BACKUP_MAX_AGE_H ?? "24", 10)
  const BACKUP_DIR = process.env.FILE_BACKUP_DIR ?? path.join(worktree, ".opencode", "backups")

  async function ensureBackupDir(): Promise<void> {
    await $`mkdir -p ${BACKUP_DIR}`.quiet()
  }

  async function pruneOldBackups(): Promise<void> {
    try {
      // Remove backups older than MAX_AGE_H hours (macOS + Linux compatible)
      await $`find ${BACKUP_DIR} -maxdepth 1 -name "*.bak" -mmin +${MAX_AGE_H * 60} -delete`.quiet()
    } catch {
      // Non-fatal — pruning is best-effort
    }
  }

  async function countLines(filePath: string): Promise<number> {
    try {
      const content = await Bun.file(filePath).text()
      return content.split("\n").length
    } catch {
      return 0
    }
  }

  async function backup(filePath: string): Promise<void> {
    const lineCount = await countLines(filePath)
    if (lineCount < MIN_LINES) return

    await ensureBackupDir()
    await pruneOldBackups()

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
    const basename = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, "_")
    const dest = path.join(BACKUP_DIR, `${timestamp}-${basename}.bak`)

    try {
      await $`cp ${filePath} ${dest}`.quiet()
    } catch {
      // Non-fatal — backup failure must never block the agent
    }
  }

  return {
    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool !== "write" && input.tool !== "edit") return

      const filePath: string | undefined = output.args?.filePath
      if (!filePath) return

      // Check the file exists before trying to back it up
      const exists = await Bun.file(filePath).exists()
      if (!exists) return

      await backup(filePath)
    },
  }
}
