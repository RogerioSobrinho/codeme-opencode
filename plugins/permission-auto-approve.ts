import type { Plugin } from "@opencode-ai/plugin"

/**
 * permission-auto-approve — aprova automaticamente ferramentas de leitura
 *
 * Quando o agente pede permissão para usar uma ferramenta classificada como
 * "somente leitura" (read, glob, grep, find, git-summary, etc.), aprova
 * automaticamente sem interromper o fluxo.
 *
 * Ferramentas que requerem aprovação manual (nunca auto-aprovadas):
 *   bash, write, edit, webfetch — e qualquer MCP tool não listada
 *
 * Comportamento:
 *   - Extrai permissionId e toolName do evento permission.asked
 *   - Consulta a lista de ferramentas permitidas (configurável)
 *   - Responde via SDK: postSessionByIdPermissionsByPermissionId
 *   - Loga toda auto-aprovação para auditoria
 *   - Em caso de dúvida: não aprova (fail safe)
 *
 * Configuração:
 *   OPENCODE_AUTO_APPROVE=0
 *     — desativa o plugin inteiramente (padrão: ativo)
 *
 *   OPENCODE_AUTO_APPROVE_TOOLS=read,glob,grep,find
 *     — lista customizada de tools auto-aprovadas (substitui o padrão)
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const DEFAULT_AUTO_APPROVE_TOOLS = new Set([
  // Built-in read-only tools
  "read",
  "glob",
  "grep",
  "find",
  // Custom tools (read-only)
  "git-summary",
  "changed-files",
  "run-tests",
  "security-audit",
  // Common MCP read-only tools
  "mcp__memory__read_graph",
  "mcp__memory__search_nodes",
  "mcp__context7__resolve-library-id",
  "mcp__context7__get-library-docs",
  "mcp__sequential-thinking__sequentialthinking",
])

function buildApproveSet(): Set<string> {
  const env = process.env.OPENCODE_AUTO_APPROVE_TOOLS
  if (env) {
    return new Set(env.split(",").map((t) => t.trim()).filter(Boolean))
  }
  return DEFAULT_AUTO_APPROVE_TOOLS
}

export const PermissionAutoApprovePlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_AUTO_APPROVE === "0") return {}

  const approveSet = buildApproveSet()

  return {
    event: async ({ event }: { event: any }) => {
      if (event.type !== "permission.asked") return

      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"
      const permissionId: string =
        event.properties?.permissionId ??
        event.properties?.permission_id ??
        event.properties?.id ??
        ""
      const toolName: string =
        event.properties?.tool ??
        event.properties?.toolName ??
        event.properties?.tool_name ??
        ""

      if (!permissionId || !toolName) return

      // Não auto-aprova tools não listadas — fail safe
      if (!approveSet.has(toolName)) return

      try {
        await (client as any).postSessionByIdPermissionsByPermissionId({
          path: { id: sessionId, permissionId },
          body: { response: "allow" },
        })

        await client.app.log({
          body: {
            service: "permission-auto-approve",
            level: "info",
            message: `Auto-approved: ${toolName} (session ${sessionId.slice(0, 8)})`,
            extra: { tool: toolName, session_id: sessionId, permission_id: permissionId },
          },
        })
      } catch {
        // Se a aprovação falhar, o usuário ainda vê o prompt manual — não fatal
        await client.app.log({
          body: {
            service: "permission-auto-approve",
            level: "warn",
            message: `Failed to auto-approve ${toolName} — falling back to manual approval`,
            extra: { tool: toolName, permission_id: permissionId },
          },
        })
      }
    },
  }
}
