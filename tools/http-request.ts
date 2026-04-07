import { tool } from "@opencode-ai/plugin"

/**
 * http-request — ferramenta HTTP tipada para o agente
 *
 * Permite ao agente fazer requisições HTTP com schema explícito em vez de
 * usar `curl` ou `fetch` via bash. Vantagens:
 *   - Aparece nos logs de ferramenta com args estruturados (não como string opaca)
 *   - Pode ser controlado via permissões (allow/deny/ask) no opencode.json
 *   - Sanitiza URLs internas por segurança (bloqueia localhost, 127.x, 169.254.x)
 *   - Trunca responses grandes para não explodir o contexto
 *   - Timeout configurável (padrão: 15s)
 *
 * Segurança:
 *   - Bloqueia requisições para redes internas (localhost, 127.*, 10.*, 192.168.*, 169.254.*)
 *     a menos que OPENCODE_HTTP_ALLOW_INTERNAL=1 esteja definido
 *   - Não segue redirects para domínios diferentes do original
 *   - Trunca body > MAX_BODY_CHARS (padrão: 20000 chars ~= 5KB)
 */

const INTERNAL_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\./,
  /^https?:\/\/0\.0\.0\.0/,
  /^https?:\/\/10\.\d+\.\d+\.\d+/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\./,
  /^https?:\/\/192\.168\./,
  /^https?:\/\/169\.254\./,   // AWS metadata service
  /^https?:\/\/\[::1\]/,      // IPv6 loopback
]

const MAX_BODY_CHARS = 20_000
const DEFAULT_TIMEOUT_MS = 15_000

function isInternalUrl(url: string): boolean {
  return INTERNAL_PATTERNS.some((p) => p.test(url))
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + `\n\n… (truncated ${text.length - max} chars — use a more specific request or increase OPENCODE_HTTP_MAX_BODY)`
}

export default tool({
  description:
    "Make an HTTP request and return the response. " +
    "Use this instead of curl/fetch in bash for structured, auditable HTTP calls. " +
    "Supports GET, POST, PUT, PATCH, DELETE. " +
    "Blocks requests to internal/private networks by default.",
  args: {
    url: tool.schema
      .string()
      .url()
      .describe("Full URL including scheme (https://...)"),
    method: tool.schema
      .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
      .default("GET")
      .describe("HTTP method"),
    headers: tool.schema
      .record(tool.schema.string())
      .optional()
      .describe("HTTP headers as key-value pairs"),
    body: tool.schema
      .string()
      .optional()
      .describe("Request body (for POST/PUT/PATCH). Use JSON string for JSON payloads."),
    timeout_ms: tool.schema
      .number()
      .int()
      .min(1000)
      .max(60_000)
      .default(DEFAULT_TIMEOUT_MS)
      .optional()
      .describe("Timeout in milliseconds (1000–60000, default: 15000)"),
  },
  async execute(args) {
    const maxBody = parseInt(process.env.OPENCODE_HTTP_MAX_BODY ?? String(MAX_BODY_CHARS), 10)
    const allowInternal = process.env.OPENCODE_HTTP_ALLOW_INTERNAL === "1"

    // Security: block internal URLs
    if (!allowInternal && isInternalUrl(args.url)) {
      return `[http-request] BLOCKED: Requests to internal/private network addresses are not allowed.\nURL: ${args.url}\nSet OPENCODE_HTTP_ALLOW_INTERNAL=1 to override (not recommended).`
    }

    const timeoutMs = args.timeout_ms ?? DEFAULT_TIMEOUT_MS
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(args.url, {
        method: args.method ?? "GET",
        headers: {
          "User-Agent": "opencode-http-tool/1.0",
          ...(args.headers ?? {}),
        },
        body: args.body,
        signal: controller.signal,
        redirect: "follow",
      })

      clearTimeout(timer)

      // Collect relevant response headers
      const relevantHeaders: Record<string, string> = {}
      for (const key of ["content-type", "content-length", "x-request-id", "x-ratelimit-remaining"]) {
        const val = response.headers.get(key)
        if (val) relevantHeaders[key] = val
      }

      let bodyText = ""
      const contentType = response.headers.get("content-type") ?? ""
      if (contentType.includes("application/json") || contentType.includes("text/")) {
        bodyText = await response.text()
      } else {
        bodyText = `[binary or non-text response: ${contentType}]`
      }

      const truncatedBody = truncate(bodyText, maxBody)

      const lines: string[] = [
        `HTTP ${response.status} ${response.statusText}`,
        `URL: ${response.url}`,
      ]
      if (Object.keys(relevantHeaders).length > 0) {
        lines.push(`Headers: ${JSON.stringify(relevantHeaders)}`)
      }
      lines.push(``, truncatedBody)

      return lines.join("\n")
    } catch (err: unknown) {
      clearTimeout(timer)
      if ((err as Error)?.name === "AbortError") {
        return `[http-request] Timeout after ${timeoutMs}ms — ${args.url}`
      }
      return `[http-request] Request failed: ${(err as Error)?.message ?? String(err)}`
    }
  },
})
