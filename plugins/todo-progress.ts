import type { Plugin } from "@opencode-ai/plugin"

/**
 * todo-progress — Logs structured progress whenever the TodoWrite tool
 * updates the task list.
 *
 * Emits a log entry in the format:
 *   [todo] X/Y tasks completed (N in progress) — "current task name"
 *
 * This gives visibility into orchestrator progress without cluttering the
 * session with additional LLM output.
 */
export const TodoProgressPlugin: Plugin = async ({ client }) => {
  return {
    "todo.updated": async (input) => {
      const todos = input.todos ?? []
      if (todos.length === 0) return

      const completed = todos.filter((t) => t.status === "completed").length
      const inProgress = todos.filter((t) => t.status === "in_progress")
      const pending = todos.filter((t) => t.status === "pending").length
      const total = todos.length

      const currentTask = inProgress[0]?.content ?? null
      const summary = currentTask
        ? `${completed}/${total} tasks completed — "${currentTask}"`
        : `${completed}/${total} tasks completed (${pending} pending)`

      await client.app.log({
        body: {
          service: "todo-progress",
          level: "info",
          message: summary,
          extra: {
            completed,
            in_progress: inProgress.length,
            pending,
            total,
            current_task: currentTask,
          },
        },
      })
    },
  }
}
