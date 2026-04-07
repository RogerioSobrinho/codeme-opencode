/**
 * auto-branch — warns when the agent is about to commit directly to a protected branch
 *
 * Intercepts `git commit` calls on Bash and checks if the current branch is a
 * protected branch (main, master, develop, staging, production). If so, throws
 * an error instructing the agent to create a feature branch first.
 *
 * Also intercepts `session.created` to log a warning if the session starts on
 * a protected branch, so the agent is aware from the very beginning.
 *
 * Protected branches (configurable via OPENCODE_PROTECTED_BRANCHES env var,
 * comma-separated):
 *   main, master, develop, staging, production
 *
 * Override: set OPENCODE_AUTO_BRANCH=0 to disable entirely.
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

import type { Plugin } from "@opencode-ai/plugin"

const DEFAULT_PROTECTED = ["main", "master", "develop", "staging", "production"]

function getProtectedBranches(): Set<string> {
  const env = process.env.OPENCODE_PROTECTED_BRANCHES
  if (env) return new Set(env.split(",").map((b) => b.trim()).filter(Boolean))
  return new Set(DEFAULT_PROTECTED)
}

async function getCurrentBranch($: any): Promise<string | null> {
  try {
    const branch = await $`git rev-parse --abbrev-ref HEAD`.quiet().text()
    return branch.trim()
  } catch {
    return null
  }
}

async function isGitRepo($: any): Promise<boolean> {
  try {
    await $`git rev-parse --git-dir`.quiet()
    return true
  } catch {
    return false
  }
}

export const AutoBranchPlugin: Plugin = async ({ $, client }) => {
  if (process.env.OPENCODE_AUTO_BRANCH === "0") return {}

  const protected_ = getProtectedBranches()

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.created") return
      if (!(await isGitRepo($))) return

      const branch = await getCurrentBranch($)
      if (!branch || !protected_.has(branch)) return

      await client.app.log({
        body: {
          service: "auto-branch",
          level: "warn",
          message:
            `Session started on protected branch "${branch}".\n` +
            `Create a feature branch before making changes:\n` +
            `  git checkout -b feat/<description>`,
          extra: { branch, protected_branches: [...protected_] },
        },
      })
    },

    "tool.execute.before": async (input: any, output: any) => {
      if (input.tool !== "bash") return

      const command: string = (output.args as { command?: string }).command ?? ""
      if (!command.includes("git commit")) return
      if (!(await isGitRepo($))) return

      const branch = await getCurrentBranch($)
      if (!branch || !protected_.has(branch)) return

      throw new Error(
        `[auto-branch] BLOCKED: Attempted to commit directly to protected branch "${branch}".\n` +
        `Create a feature branch first:\n` +
        `  git checkout -b feat/<description>\n` +
        `Then commit on the new branch.\n` +
        `To disable this check: set OPENCODE_AUTO_BRANCH=0`,
      )
    },
  }
}
