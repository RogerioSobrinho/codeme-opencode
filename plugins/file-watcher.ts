import type { Plugin } from "@opencode-ai/plugin"
import * as path from "node:path"
import * as fs from "node:fs/promises"

/**
 * file-watcher — reage a mudanças externas no sistema de arquivos
 *
 * O OpenCode monitora arquivos via watcher e emite `file.watcher.updated`
 * quando um arquivo muda fora do controle do agente (outro editor, processo
 * de build, hot-reload, etc.).
 *
 * Este plugin:
 *   - Registra mudanças externas com log estruturado
 *   - Agrupa mudanças em janelas de 2s (debounce) para evitar flood
 *   - Para arquivos TypeScript/JavaScript modificados externamente, injeta
 *     um aviso silencioso na sessão para o agente recarregar o arquivo
 *   - Ignora arquivos gerados (dist/, node_modules/, .git/, etc.)
 *
 * Configuração:
 *   OPENCODE_NO_FILE_WATCHER=1 — desativa o plugin
 *   OPENCODE_WATCHER_NOTIFY=1  — também mostra toast TUI para cada mudança
 *
 * Install: place in ~/.config/opencode/plugins/  (global)
 *          or in .opencode/plugins/              (per-project)
 */

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".dart_tool",
  "target",
  ".next",
  "coverage",
  ".venv",
  "__pycache__",
  ".opencode",
])

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".go", ".rs", ".java", ".kt", ".dart",
  ".vue", ".svelte",
])

function isIgnored(filePath: string): boolean {
  const parts = filePath.split(path.sep)
  return parts.some((part) => IGNORED_DIRS.has(part))
}

function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export const FileWatcherPlugin: Plugin = async ({ client }) => {
  if (process.env.OPENCODE_NO_FILE_WATCHER === "1") return {}

  const toastEnabled = process.env.OPENCODE_WATCHER_NOTIFY === "1"
  const notifiedPaths = new Set<string>()
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

  // Per-session tracking: sessionId → set of paths already injected
  const injectedPerSession = new Map<string, Set<string>>()

  function getSessionSet(sessionId: string): Set<string> {
    if (!injectedPerSession.has(sessionId)) {
      injectedPerSession.set(sessionId, new Set())
    }
    return injectedPerSession.get(sessionId)!
  }

  async function handleFileChange(filePath: string, sessionId: string): Promise<void> {
    if (isIgnored(filePath)) return

    await client.app.log({
      body: {
        service: "file-watcher",
        level: "info",
        message: `External change detected: ${filePath}`,
        extra: { file: filePath, session_id: sessionId },
      },
    })

    if (toastEnabled) {
      try {
        const rel = path.basename(filePath)
        await (client.tui as any).showToast({
          body: { message: `File changed externally: ${rel}`, variant: "info" },
        })
      } catch {
        // TUI not available — not fatal
      }
    }

    // Only inject context hint for source files, once per session per path
    if (!isSourceFile(filePath)) return

    const sessionSet = getSessionSet(sessionId)
    if (sessionSet.has(filePath)) return
    sessionSet.add(filePath)

    try {
      await (client as any).postSessionByIdMessages({
        path: { id: sessionId },
        body: {
          role: "user",
          content: `[file-watcher] The file \`${filePath}\` was modified externally. If you have this file in context, re-read it before making further edits.`,
          noReply: true,
        },
      })
    } catch {
      // SDK call may fail if session ended or API shape differs — not fatal
    }
  }

  return {
    event: async ({ event }: { event: any }) => {
      const sessionId: string =
        event.sessionID ?? event.session_id ?? event.properties?.sessionId ?? "unknown"

      // Clean up per-session state on delete
      if (event.type === "session.deleted") {
        injectedPerSession.delete(sessionId)
        return
      }

      if (event.type !== "file.watcher.updated") return

      const filePath: string =
        event.properties?.path ??
        event.properties?.filePath ??
        event.properties?.file ??
        ""

      if (!filePath) return

      // Debounce: 2s window to batch rapid saves (e.g., auto-formatters)
      const existing = debounceTimers.get(filePath)
      if (existing) clearTimeout(existing)

      const timer = setTimeout(async () => {
        debounceTimers.delete(filePath)
        await handleFileChange(filePath, sessionId)
      }, 2000)

      debounceTimers.set(filePath, timer)
    },
  }
}
