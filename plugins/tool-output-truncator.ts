import type { Plugin } from "@opencode-ai/plugin"

/**
 * tool-output-truncator — caps large tool outputs before they reach context
 *
 * Large bash outputs (git log, grep on big repos, npm audit) can burn 10-30K
 * tokens of context in a single tool call. This plugin intercepts
 * `tool.execute.after` and truncates outputs that exceed a configurable byte
 * limit, appending a `[truncated — N bytes omitted]` marker so the agent
 * knows there is more and can request a narrower query.
 *
 * Tools monitored (high-noise by default):
 *   bash, grep, find — command output can be unbounded
 *
 * Tools intentionally excluded:
 *   read, edit, write — file content should not be truncated mid-file
 *
 * Configuration:
 *   OPENCODE_NO_TRUNCATOR=1          — disable entirely
 *   OPENCODE_TRUNCATOR_LIMIT=10240   — byte limit (default: 10 KB)
 *   OPENCODE_TRUNCATOR_TOOLS=bash,grep,find — comma-separated list of tools to watch
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const DEFAULT_LIMIT_BYTES = 10_240 // 10 KB
const DEFAULT_TOOLS = new Set(["bash", "grep", "find"])

export const ToolOutputTruncatorPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_TRUNCATOR === "1") return {}

  const limitBytes = Number(process.env.OPENCODE_TRUNCATOR_LIMIT ?? DEFAULT_LIMIT_BYTES)
  const watchTools = process.env.OPENCODE_TRUNCATOR_TOOLS
    ? new Set(process.env.OPENCODE_TRUNCATOR_TOOLS.split(",").map((t) => t.trim()))
    : DEFAULT_TOOLS

  return {
    "tool.execute.after": async (input: any, output: any) => {
      if (!watchTools.has(input.tool)) return

      // output.result may be a string or an object with stdout/stderr/content
      let original: string | undefined

      if (typeof output.result === "string") {
        original = output.result
      } else if (typeof output.result?.stdout === "string") {
        original = output.result.stdout
      } else if (typeof output.result?.content === "string") {
        original = output.result.content
      }

      if (!original) return

      const byteLen = Buffer.byteLength(original, "utf8")
      if (byteLen <= limitBytes) return

      // Truncate to the byte limit (slice by chars, not bytes — safe approximation)
      const charLimit = Math.floor(limitBytes * 0.9) // small margin for the marker
      const truncated = original.slice(0, charLimit)
      const omitted = byteLen - Buffer.byteLength(truncated, "utf8")
      const marker = `\n\n[truncated — ${omitted.toLocaleString()} bytes omitted. Use a narrower query to see more.]`

      const truncatedOutput = truncated + marker

      // Write back to the output
      if (typeof output.result === "string") {
        output.result = truncatedOutput
      } else if (typeof output.result?.stdout === "string") {
        output.result = { ...output.result, stdout: truncatedOutput }
      } else if (typeof output.result?.content === "string") {
        output.result = { ...output.result, content: truncatedOutput }
      }

      await client.app.log({
        body: {
          service: "tool-output-truncator",
          level: "info",
          message: `Truncated ${input.tool} output: ${byteLen.toLocaleString()} → ${limitBytes.toLocaleString()} bytes`,
          extra: { tool: input.tool, original_bytes: byteLen, limit: limitBytes },
        },
      })
    },
  }
}
