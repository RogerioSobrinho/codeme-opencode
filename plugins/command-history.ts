import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * command-history — log persistente de todos os comandos bash executados pelo agente
 *
 * Salva cada comando bash em .opencode/history/YYYY-MM-DD.log com:
 *   - Timestamp ISO
 *   - Exit code
 *   - Primeiros 300 chars do stdout/stderr combinado
 *
 * Útil para auditar o que o agente fez durante a sessão, especialmente em
 * sessões autônomas longas onde é difícil rolar o histórico do TUI.
 *
 * Rotação: no session.created, apaga logs com mais de OPENCODE_CMD_HISTORY_DAYS dias.
 *
 * Configuração:
 *   OPENCODE_NO_CMD_HISTORY=1       — desativa o plugin inteiramente
 *   OPENCODE_CMD_HISTORY_DAYS=7     — retenção em dias (padrão: 7)
 *   OPENCODE_CMD_HISTORY_MAX_OUT=300 — chars de output a salvar por comando (padrão: 300)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const CommandHistoryPlugin: Plugin = async ({ $, worktree }) => {
  if (process.env.OPENCODE_NO_CMD_HISTORY === "1") return {}

  const RETENTION_DAYS = parseInt(process.env.OPENCODE_CMD_HISTORY_DAYS ?? "7", 10)
  const MAX_OUTPUT = parseInt(process.env.OPENCODE_CMD_HISTORY_MAX_OUT ?? "300", 10)
  const HISTORY_DIR = path.join(worktree, ".opencode", "history")

  function todayLog(): string {
    const today = new Date().toISOString().slice(0, 10)
    return path.join(HISTORY_DIR, `${today}.log`)
  }

  function formatEntry(command: string, exitCode: number, output: string): string {
    const ts = new Date().toISOString()
    const truncated = output.length > MAX_OUTPUT
      ? output.slice(0, MAX_OUTPUT) + ` …(+${output.length - MAX_OUTPUT} chars)`
      : output
    const lines = [
      `[${ts}] exit=${exitCode}`,
      `  cmd: ${command.slice(0, 500)}`,
    ]
    if (truncated.trim()) {
      lines.push(`  out: ${truncated.replace(/\n/g, "\n       ")}`)
    }
    lines.push("")
    return lines.join("\n")
  }

  async function pruneOldLogs(): Promise<void> {
    try {
      await $`find ${HISTORY_DIR} -maxdepth 1 -name "*.log" -mtime +${RETENTION_DAYS} -delete`.quiet()
    } catch {
      // Non-fatal
    }
  }

  async function appendToLog(entry: string): Promise<void> {
    try {
      await $`mkdir -p ${HISTORY_DIR}`.quiet()
      const logFile = todayLog()
      await Bun.write(Bun.file(logFile), entry, { append: true } as any)
    } catch {
      // Non-fatal — history failure must never block the agent
    }
  }

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.created") return
      await pruneOldLogs()
    },

    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool !== "bash") return

      const command: string = (input.args as { command?: string })?.command ?? ""
      if (!command.trim()) return

      const exitCode: number = output?.result?.exitCode ?? output?.exitCode ?? 0
      const stdout: string = String(output?.result?.stdout ?? output?.stdout ?? "")
      const stderr: string = String(output?.result?.stderr ?? output?.stderr ?? "")
      const combined = (stdout + (stderr ? `\n[stderr] ${stderr}` : "")).trim()

      const entry = formatEntry(command, exitCode, combined)
      await appendToLog(entry)
    },
  }
}
