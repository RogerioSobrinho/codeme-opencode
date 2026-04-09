import type { Plugin } from "@opencode-ai/plugin"

/**
 * compaction — Replaces the default context compaction prompt with one
 * optimized for multi-agent sessions, and injects live todo state.
 *
 * The default compaction prompt produces a generic summary. This plugin
 * replaces it with a structured continuation brief that preserves:
 *   - The current task and its completion status
 *   - Which files are actively being modified
 *   - Key architectural or implementation decisions made this session
 *   - Blockers, open questions, and next steps
 *   - Which agents were invoked and what they produced
 *   - The LIVE todo list at compaction time (read from in-memory state,
 *     not reconstructed from conversation — prevents any todo from being lost)
 *
 * Uses the `experimental.session.compacting` hook (fires before the LLM
 * generates the continuation summary).
 */

interface Todo {
  content: string
  status: string
  priority: string
}

// Shared in-memory todo state — populated by todo.updated hook
const todosBySession = new Map<string, Todo[]>()

export const CompactionPlugin: Plugin = async () => {
  return {
    "todo.updated": async (input: any) => {
      const todos: Todo[] = input.todos ?? []
      const sessionId: string = input.sessionId ?? input.session_id ?? "unknown"
      todosBySession.set(sessionId, todos)
    },

    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.deleted") return
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
      todosBySession.delete(sessionId)
    },

    "experimental.session.compacting": async (input: any, output) => {
      // Extract session id to look up live todos
      const sessionId: string =
        input?.sessionId ?? input?.session_id ?? input?.id ?? "unknown"

      const todos = todosBySession.get(sessionId) ?? []

      // Build a literal todo block to embed in the prompt
      let todoBlock = ""
      if (todos.length > 0) {
        const lines = todos.map((t) => {
          const marker = t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[~]" : "[ ]"
          return `${marker} [${t.priority}] ${t.content}`
        })
        todoBlock = `\n\n### CURRENT TODO STATE (live — do NOT reconstruct from conversation)\n\`\`\`\n${lines.join("\n")}\n\`\`\`\n\nThis list is authoritative. Preserve every incomplete item verbatim in the NEXT STEPS section.`
      }

      output.prompt = `You are generating a continuation brief for an OpenCode session that is being compacted due to context length.

Your job is to produce a structured, dense summary that a new context window can use to resume work exactly where it left off — with zero loss of intent or state.
${todoBlock}

## Required sections (use these exact headers):

### TASK
One paragraph: what the user asked for, what problem is being solved, and the current completion status (e.g., "50% complete — backend done, frontend pending").

### DECISIONS
Bullet list of every architectural, implementation, or design decision made this session. Include the rationale. Example:
- Used pnpm workspaces instead of Lerna — already in use in the project
- Chose Zod for validation — avoids runtime errors at the API boundary

### ACTIVE FILES
List every file that has been created, modified, or is currently being worked on. Format: \`STATUS path/to/file — one-line description of change\`.
Status: CREATED | MODIFIED | DELETED | IN PROGRESS

### NEXT STEPS
Numbered list of concrete remaining tasks, in execution order. Be specific — name files, functions, and behaviors. If a CURRENT TODO STATE block is present above, every incomplete item ([~] or [ ]) must appear here. Example:
1. Add \`createUser\` endpoint in src/routes/users.ts
2. Write Jest test for the new endpoint in src/routes/users.test.ts
3. Run npm test and fix any failures

### BLOCKERS
Any open questions, dependencies, or issues that need resolution before proceeding. Write "None" if there are none.

### AGENT CONTEXT
If specialized agents (planner, architect, tdd-guide, etc.) were invoked, summarize what each one produced or decided.

---

Rules for writing this brief:
- Be maximally dense — no filler phrases
- Every sentence must be actionable or informative
- Preserve exact file paths, function names, and variable names
- If tests were run, include the last known pass/fail state
- If the user gave explicit constraints ("never use X", "always do Y"), include them verbatim`
    },
  }
}
}
