import type { Plugin } from "@opencode-ai/plugin"

/**
 * error-rerun — retries bash commands that fail due to transient errors
 *
 * Intercepts `tool.execute.after` on Bash calls that exit with a non-zero
 * code. If the output matches known transient failure patterns, the command
 * is retried once automatically before the agent sees the error.
 *
 * Transient patterns detected:
 *   - Network:   ECONNREFUSED, ECONNRESET, ETIMEDOUT, ENOTFOUND, fetch failed
 *   - Port:      address already in use, EADDRINUSE
 *   - Modules:   Cannot find module, MODULE_NOT_FOUND (after npm/pnpm install race)
 *   - Processes: spawn ENOENT (binary not yet on PATH after install)
 *   - Docker:    connection refused to docker daemon
 *   - DB:        connection refused (postgres/mysql/redis not ready yet)
 *
 * Non-transient errors (syntax errors, test failures, type errors) are passed
 * through immediately — no retry, no delay.
 *
 * Configuration:
 *   OPENCODE_RERUN_DELAY_MS  — wait before retry in ms (default: 1500)
 *   OPENCODE_NO_RERUN=1      — disable the plugin entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const TRANSIENT_PATTERNS = [
  // Network
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /fetch failed/i,
  /network timeout/i,
  /getaddrinfo/i,
  // Port conflicts
  /address already in use/i,
  /EADDRINUSE/i,
  // Module resolution races
  /Cannot find module/i,
  /MODULE_NOT_FOUND/i,
  // Binary not yet available
  /spawn ENOENT/i,
  /command not found/i,
  // Docker
  /Cannot connect to the Docker daemon/i,
  /docker: error during connect/i,
  // DB not ready
  /could not connect to server/i,
  /Connection refused.*5432/i,
  /Connection refused.*3306/i,
  /Connection refused.*6379/i,
  // Generic transient
  /temporarily unavailable/i,
  /too many open files/i,
  /EAGAIN/i,
]

// Patterns that indicate a real error — never retry these
const PERMANENT_PATTERNS = [
  /SyntaxError/i,
  /TypeError/i,
  /ReferenceError/i,
  /error TS\d+/i,         // TypeScript compiler errors
  /FAIL\s+src\//i,        // Jest test failures
  /AssertionError/i,
  /permission denied/i,
  /No such file or directory/i,
  /authentication failed/i,
]

function isTransient(output: string): boolean {
  if (PERMANENT_PATTERNS.some((p) => p.test(output))) return false
  return TRANSIENT_PATTERNS.some((p) => p.test(output))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const ErrorRerunPlugin: Plugin = async ({ $, client }) => {
  if (process.env.OPENCODE_NO_RERUN === "1") return {}

  const DELAY_MS = parseInt(process.env.OPENCODE_RERUN_DELAY_MS ?? "1500", 10)

  return {
    "tool.execute.after": async (input: any, output: any) => {
      if (input.tool !== "bash") return

      // Exit code 0 = success, nothing to do
      const exitCode: number = output?.result?.exitCode ?? output?.exitCode ?? 0
      if (exitCode === 0) return

      const stdout: string = String(output?.result?.stdout ?? output?.stdout ?? "")
      const stderr: string = String(output?.result?.stderr ?? output?.stderr ?? "")
      const combined = `${stdout}\n${stderr}`

      if (!isTransient(combined)) return

      const command: string = (input.args as { command?: string })?.command ?? ""

      await client.app.log({
        body: {
          service: "error-rerun",
          level: "warn",
          message: `Transient failure detected — retrying in ${DELAY_MS}ms: ${command.slice(0, 100)}`,
          extra: { command, exit_code: exitCode, delay_ms: DELAY_MS },
        },
      })

      await sleep(DELAY_MS)

      try {
        const result = await $`bash -c ${command}`.quiet()

        // Overwrite the output so the agent sees the successful result
        output.result = {
          exitCode: 0,
          stdout: String(result.stdout ?? ""),
          stderr: String(result.stderr ?? ""),
        }
        output.exitCode = 0
        output.stdout = String(result.stdout ?? "")
        output.stderr = String(result.stderr ?? "")

        await client.app.log({
          body: {
            service: "error-rerun",
            level: "info",
            message: `Retry succeeded: ${command.slice(0, 100)}`,
          },
        })
      } catch {
        // Retry also failed — let the original error propagate to the agent
        await client.app.log({
          body: {
            service: "error-rerun",
            level: "warn",
            message: `Retry failed — passing original error to agent: ${command.slice(0, 100)}`,
          },
        })
      }
    },
  }
}
