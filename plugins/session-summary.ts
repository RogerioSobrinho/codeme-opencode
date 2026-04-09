import type { Plugin } from "@opencode-ai/plugin"
import path from "path"

/**
 * session-summary — writes a markdown summary when a session goes idle
 *
 * On `session.idle`, generates a structured `.md` file at:
 *   .opencode/sessions/YYYY-MM-DD-HH-MM-<session-id>.md
 *
 * The summary includes:
 *   - Session title and date
 *   - Git diff stat (files changed, insertions, deletions)
 *   - List of modified files (from git diff --name-status HEAD)
 *   - Key decisions captured from assistant messages during the session
 *   - Pending todos (if any remain — acts as a "next steps" section)
 *
 * This gives you a persistent, human-readable record of every work session
 * without having to remember what was done.
 *
 * Configuration:
 *   OPENCODE_SUMMARY_DIR  — output directory (default: <worktree>/.opencode/sessions)
 *   OPENCODE_NO_SUMMARY=1 — disable the plugin entirely
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

interface Todo {
  content: string
  status: string
  priority: string
}

// Decision patterns: assistant sentences that signal an architectural or
// implementation decision was made during the session.
const DECISION_PATTERNS = [
  /\bI(?:'ll| will)\b.{5,80}(?:instead|because|since|to avoid|to prevent)/i,
  /\bdecided? to\b.{5,80}/i,
  /\bgoing with\b.{5,80}/i,
  /\bchoosing\b.{5,80}(?:over|instead|because)/i,
  /\busing\b.{3,60}\binstead of\b/i,
  /\bprefer(?:ring)?\b.{3,60}\bover\b/i,
  /\bopt(?:ed|ing) (?:for|to)\b.{5,80}/i,
  /\bthe (?:reason|rationale)\b.{5,100}/i,
  /\bnote[: ].{5,100}/i,
  /\bcaveat[: ].{5,100}/i,
  /\btradeoff[: ].{5,100}/i,
]

function extractDecisions(text: string): string[] {
  const decisions: string[] = []
  const sentences = text
    .replace(/```[\s\S]*?```/g, "") // strip code blocks
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 300)

  for (const sentence of sentences) {
    if (DECISION_PATTERNS.some((re) => re.test(sentence))) {
      const clean = sentence.replace(/\s+/g, " ").trim()
      if (!decisions.includes(clean)) {
        decisions.push(clean)
      }
    }
  }

  return decisions.slice(0, 10) // cap at 10 decisions per session
}

// In-memory store: sessionId → latest todos snapshot
const todosBySession = new Map<string, Todo[]>()

// In-memory store: sessionId → accumulated decisions
const decisionsBySession = new Map<string, string[]>()

export const SessionSummaryPlugin: Plugin = async ({ $, client, worktree }) => {
  if (process.env.OPENCODE_NO_SUMMARY === "1") return {}

  const SUMMARY_DIR = process.env.OPENCODE_SUMMARY_DIR ?? path.join(worktree, ".opencode", "sessions")

  // Track todos per session so we can include them in the summary
  return {
    "todo.updated": async (input: any) => {
      const todos: Todo[] = input.todos ?? []
      const sessionId: string = input.sessionId ?? input.session_id ?? "unknown"
      todosBySession.set(sessionId, todos)
    },

    "session.deleted": async (input: any) => {
      const sessionId: string = input?.sessionId ?? input?.session_id ?? "unknown"
      todosBySession.delete(sessionId)
      decisionsBySession.delete(sessionId)
    },

    "message.updated": async (input: any) => {
      // Only capture completed assistant messages
      const role: string = input.role ?? input.message?.role ?? ""
      if (role !== "assistant") return

      const sessionId: string =
        input.sessionId ?? input.session_id ?? input.message?.sessionId ?? "unknown"

      // Extract text content from the message parts
      const parts: any[] = input.parts ?? input.message?.parts ?? []
      const text = parts
        .filter((p: any) => p.type === "text" || typeof p.text === "string")
        .map((p: any) => p.text ?? p.content ?? "")
        .join(" ")

      if (!text) return

      const newDecisions = extractDecisions(text)
      if (newDecisions.length === 0) return

      const existing = decisionsBySession.get(sessionId) ?? []
      const merged = [...existing]
      for (const d of newDecisions) {
        if (!merged.includes(d)) merged.push(d)
      }
      decisionsBySession.set(sessionId, merged.slice(0, 10))
    },

    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.idle") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // ── Fetch session info ──────────────────────────────────────────────────
      let sessionTitle = "Untitled session"
      try {
        const res = await client.session.get({ path: { id: sessionId } })
        const title = (res as any)?.data?.title ?? (res as any)?.title
        if (title) sessionTitle = title
      } catch {
        // Not fatal — use fallback title
      }

      // ── Git diff ────────────────────────────────────────────────────────────
      let diffStat = ""
      let nameStatus = ""
      try {
        diffStat = (await $`git diff --stat HEAD`.quiet().text()).trim()
        nameStatus = (await $`git diff --name-status HEAD`.quiet().text()).trim()
      } catch {
        // Not a git repo or no commits — skip git sections
      }

      // ── Todos ───────────────────────────────────────────────────────────────
      const todos = todosBySession.get(sessionId) ?? []
      const pending = todos.filter((t) => t.status === "pending" || t.status === "in_progress")
      const completed = todos.filter((t) => t.status === "completed")

      // ── Decisions ───────────────────────────────────────────────────────────
      const decisions = decisionsBySession.get(sessionId) ?? []

      // ── Build markdown ──────────────────────────────────────────────────────
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 16).replace("T", " ")
      const fileDate = now.toISOString().slice(0, 16).replace(/[T:]/g, "-")
      const shortId = sessionId.slice(0, 8)

      const lines: string[] = [
        `# ${sessionTitle}`,
        ``,
        `**Date:** ${dateStr}  `,
        `**Session:** \`${shortId}\``,
        ``,
      ]

      if (diffStat) {
        // Extract summary line (last non-empty line of --stat)
        const statLines = diffStat.split("\n").filter(Boolean)
        const statSummary = statLines[statLines.length - 1]?.trim() ?? ""

        lines.push(`## Changed files`)
        lines.push(``)
        lines.push(`_${statSummary}_`)
        lines.push(``)

        if (nameStatus) {
          for (const line of nameStatus.split("\n").filter(Boolean)) {
            const [status, ...rest] = line.split("\t")
            const file = rest.join("\t")
            const icon = status === "A" ? "+" : status === "D" ? "-" : "~"
            lines.push(`- \`${icon} ${file}\``)
          }
          lines.push(``)
        }
      }

      if (completed.length > 0) {
        lines.push(`## Completed`)
        lines.push(``)
        for (const t of completed) {
          lines.push(`- [x] ${t.content}`)
        }
        lines.push(``)
      }

      if (decisions.length > 0) {
        lines.push(`## Decisions`)
        lines.push(``)
        for (const d of decisions) {
          lines.push(`- ${d}`)
        }
        lines.push(``)
      }

      if (pending.length > 0) {
        lines.push(`## Next steps`)
        lines.push(``)
        for (const t of pending) {
          const label = t.status === "in_progress" ? " _(in progress)_" : ""
          lines.push(`- [ ] ${t.content}${label}`)
        }
        lines.push(``)
      }

      if (!diffStat && todos.length === 0 && decisions.length === 0) {
        lines.push(`_No changes recorded for this session._`)
        lines.push(``)
      }

      const content = lines.join("\n")
      const filename = `${fileDate}-${shortId}.md`
      const dest = path.join(SUMMARY_DIR, filename)

      try {
        await $`mkdir -p ${SUMMARY_DIR}`.quiet()
        await Bun.write(dest, content)

        await client.app.log({
          body: {
            service: "session-summary",
            level: "info",
            message: `Session summary saved → .opencode/sessions/${filename}`,
            extra: { path: dest, session_id: sessionId },
          },
        })
      } catch {
        // Non-fatal — summary failure must never disrupt the session
      }

      // Clean up memory
      todosBySession.delete(sessionId)
      decisionsBySession.delete(sessionId)
    },
  }
}
