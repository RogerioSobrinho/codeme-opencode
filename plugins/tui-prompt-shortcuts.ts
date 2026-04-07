import type { Plugin } from "@opencode-ai/plugin"

/**
 * tui-prompt-shortcuts — appends quick-action snippets ao prompt do TUI
 *
 * O evento `tui.prompt.append` permite injetar texto no prompt de input do
 * usuário de forma programática. Este plugin usa isso para adicionar snippets
 * de contexto automáticos quando certas condições são detectadas, reduzindo
 * a necessidade de digitação repetitiva.
 *
 * Snippets injetados automaticamente:
 *
 *   1. Ao criar uma nova sessão em branch de feature:
 *      Appends o nome da branch atual como contexto para o agente.
 *
 *   2. Quando há erros de compilação pendentes (LSP diagnostics):
 *      Não injeta — esse é o domínio do lsp-diagnostics.ts.
 *
 *   3. Quando `session.idle` com todos os todos completos:
 *      Não injeta — usuário provavelmente está revisando, não queremos
 *      interferir no prompt.
 *
 * Configuração:
 *   OPENCODE_NO_PROMPT_SHORTCUTS=1 — desativa o plugin
 *   OPENCODE_APPEND_BRANCH=0       — não appenda branch no prompt (padrão: 1)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */
export const TuiPromptShortcutsPlugin: Plugin = async ({ client, $, worktree }) => {
  if (process.env.OPENCODE_NO_PROMPT_SHORTCUTS === "1") return {}

  const appendBranch = process.env.OPENCODE_APPEND_BRANCH !== "0"

  // Track which sessions already had branch context appended
  const appendedSessions = new Set<string>()

  async function getCurrentBranch(): Promise<string> {
    try {
      return (await $`git -C ${worktree} rev-parse --abbrev-ref HEAD`.quiet().text()).trim()
    } catch {
      return ""
    }
  }

  function isFeatureBranch(branch: string): boolean {
    const PROTECTED = new Set(["main", "master", "develop", "dev", "staging", "production", "HEAD"])
    return !PROTECTED.has(branch) && branch.length > 0
  }

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "session.created") return
      if (!appendBranch) return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      if (appendedSessions.has(sessionId)) return
      appendedSessions.add(sessionId)

      const branch = await getCurrentBranch()
      if (!branch || !isFeatureBranch(branch)) return

      try {
        await (client.tui as any).promptAppend({
          body: { text: `[branch: ${branch}] ` },
        })
      } catch {
        // TUI not available or promptAppend API differs — not fatal
        // Try alternative event shape
        try {
          await (client as any).postTuiPromptAppend({
            body: { text: `[branch: ${branch}] ` },
          })
        } catch {
          // Give up silently
        }
      }

      await client.app.log({
        body: {
          service: "tui-prompt-shortcuts",
          level: "debug",
          message: `Appended branch context to prompt: ${branch}`,
          extra: { session_id: sessionId, branch },
        },
      })
    },
  }
}
