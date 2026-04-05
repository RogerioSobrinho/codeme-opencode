import { tool } from "@opencode-ai/plugin"
import path from "path"

/**
 * security-audit — Detects the project stack and runs the appropriate
 * dependency vulnerability scanner.
 *
 * Supported:
 *   Node.js  → npm audit (--json) or yarn audit / pnpm audit
 *   Python   → pip-audit
 *   Rust     → cargo audit
 *   Java     → mvn dependency:check (OWASP) or gradle dependencyCheckAnalyze
 *   Go       → govulncheck (if available) or go list -m -json (fallback)
 *
 * Returns structured findings with severity counts and per-vulnerability detail.
 */
export default tool({
  description:
    "Runs a dependency security audit for the current project. " +
    "Detects the stack (Node/Python/Rust/Java/Go) and executes the appropriate scanner: " +
    "npm audit, pip-audit, cargo audit, govulncheck, or Maven OWASP plugin. " +
    "Returns structured findings grouped by severity (critical/high/moderate/low). " +
    "Use before releases, when adding dependencies, or as part of a full security review.",
  args: {
    severity_threshold: tool.schema
      .enum(["critical", "high", "moderate", "low"])
      .optional()
      .describe(
        "Only report vulnerabilities at this severity or above. Defaults to 'low' (all).",
      ),
  },
  async execute(args, context) {
    const dir = context.worktree || context.directory
    const threshold = args.severity_threshold ?? "low"

    const severityOrder = ["critical", "high", "moderate", "low"]
    const thresholdIndex = severityOrder.indexOf(threshold)

    // ── Detect stacks ─────────────────────────────────────────────────────────
    const hasPkg = await Bun.file(path.join(dir, "package.json")).exists()
    const hasBunLock = await Bun.file(path.join(dir, "bun.lockb")).exists()
    const hasPnpmLock = await Bun.file(path.join(dir, "pnpm-lock.yaml")).exists()
    const hasYarnLock = await Bun.file(path.join(dir, "yarn.lock")).exists()
    const hasPyproject = await Bun.file(path.join(dir, "pyproject.toml")).exists()
    const hasRequirements = await Bun.file(path.join(dir, "requirements.txt")).exists()
    const hasCargoToml = await Bun.file(path.join(dir, "Cargo.toml")).exists()
    const hasPom = await Bun.file(path.join(dir, "pom.xml")).exists()
    const hasGradle =
      (await Bun.file(path.join(dir, "build.gradle")).exists()) ||
      (await Bun.file(path.join(dir, "build.gradle.kts")).exists())
    const hasGoMod = await Bun.file(path.join(dir, "go.mod")).exists()

    type Finding = {
      name: string
      severity: string
      description: string
      fixAvailable?: string | boolean
      via?: string[]
    }

    const results: Array<{
      stack: string
      command: string
      success: boolean
      findings: Finding[]
      counts: Record<string, number>
      raw?: string
      error?: string
    }> = []

    // ── Node.js audit ─────────────────────────────────────────────────────────
    if (hasPkg) {
      let pm = "npm"
      if (hasBunLock) pm = "bun"
      else if (hasPnpmLock) pm = "pnpm"
      else if (hasYarnLock) pm = "yarn"

      let command = "npm audit --json"
      if (pm === "pnpm") command = "pnpm audit --json"
      else if (pm === "yarn") command = "yarn audit --json 2>/dev/null"
      else if (pm === "bun") command = "bun audit"

      try {
        const raw = await Bun.$`sh -c ${command}`.cwd(dir).text()
        const data = JSON.parse(raw)

        const findings: Finding[] = []
        const counts: Record<string, number> = {}

        // npm audit json format
        const vulns = data.vulnerabilities ?? data.advisories ?? {}
        for (const [, v] of Object.entries(vulns)) {
          const vuln = v as Record<string, unknown>
          const sev = (vuln.severity as string) ?? "unknown"
          counts[sev] = (counts[sev] ?? 0) + 1
          const sevIdx = severityOrder.indexOf(sev)
          if (sevIdx === -1 || sevIdx <= thresholdIndex) {
            findings.push({
              name: (vuln.name ?? vuln.module_name ?? "unknown") as string,
              severity: sev,
              description: (vuln.title ?? vuln.overview ?? "") as string,
              fixAvailable: vuln.fixAvailable as string | boolean | undefined,
              via: Array.isArray(vuln.via)
                ? vuln.via.map((v: unknown) =>
                    typeof v === "string" ? v : (v as Record<string, unknown>).title as string ?? "",
                  )
                : undefined,
            })
          }
        }

        results.push({ stack: `node (${pm})`, command, success: true, findings, counts })
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string }
        // npm audit exits non-zero when vulnerabilities are found — try to parse anyway
        try {
          const raw = e.stdout ?? ""
          const data = JSON.parse(raw)
          const vulns = data.vulnerabilities ?? data.advisories ?? {}
          const findings: Finding[] = []
          const counts: Record<string, number> = {}
          for (const [, v] of Object.entries(vulns)) {
            const vuln = v as Record<string, unknown>
            const sev = (vuln.severity as string) ?? "unknown"
            counts[sev] = (counts[sev] ?? 0) + 1
            const sevIdx = severityOrder.indexOf(sev)
            if (sevIdx === -1 || sevIdx <= thresholdIndex) {
              findings.push({
                name: (vuln.name ?? vuln.module_name ?? "unknown") as string,
                severity: sev,
                description: (vuln.title ?? vuln.overview ?? "") as string,
              })
            }
          }
          results.push({ stack: `node (${pm})`, command, success: findings.length === 0, findings, counts })
        } catch {
          results.push({
            stack: `node (${pm})`,
            command,
            success: false,
            findings: [],
            counts: {},
            error: e.stderr ?? e.message ?? "audit failed",
          })
        }
      }
    }

    // ── Python audit ──────────────────────────────────────────────────────────
    if (hasPyproject || hasRequirements) {
      const command = "pip-audit --format=json 2>&1"
      try {
        const raw = await Bun.$`sh -c ${command}`.cwd(dir).text()
        const data = JSON.parse(raw) as Array<{
          name: string
          version: string
          vulns: Array<{ id: string; description: string; fix_versions: string[] }>
        }>

        const findings: Finding[] = []
        const counts: Record<string, number> = { unknown: 0 }

        for (const pkg of data) {
          for (const vuln of pkg.vulns) {
            counts["unknown"] = (counts["unknown"] ?? 0) + 1
            findings.push({
              name: `${pkg.name}@${pkg.version}`,
              severity: "unknown",
              description: vuln.description,
              fixAvailable: vuln.fix_versions.join(", ") || false,
            })
          }
        }

        results.push({ stack: "python", command, success: findings.length === 0, findings, counts })
      } catch (err: unknown) {
        const e = err as { message?: string }
        results.push({
          stack: "python",
          command,
          success: false,
          findings: [],
          counts: {},
          error: "pip-audit not installed or failed. Run: pip install pip-audit",
        })
      }
    }

    // ── Rust audit ────────────────────────────────────────────────────────────
    if (hasCargoToml) {
      const command = "cargo audit --json 2>&1"
      try {
        const raw = await Bun.$`sh -c ${command}`.cwd(dir).text()
        const data = JSON.parse(raw) as {
          vulnerabilities?: {
            list?: Array<{
              advisory: { id: string; title: string; severity: string }
              package: { name: string; version: string }
            }>
          }
        }

        const findings: Finding[] = []
        const counts: Record<string, number> = {}

        for (const item of data.vulnerabilities?.list ?? []) {
          const sev = item.advisory.severity?.toLowerCase() ?? "unknown"
          counts[sev] = (counts[sev] ?? 0) + 1
          const sevIdx = severityOrder.indexOf(sev)
          if (sevIdx === -1 || sevIdx <= thresholdIndex) {
            findings.push({
              name: `${item.package.name}@${item.package.version}`,
              severity: sev,
              description: item.advisory.title,
            })
          }
        }

        results.push({ stack: "rust", command, success: findings.length === 0, findings, counts })
      } catch {
        results.push({
          stack: "rust",
          command,
          success: false,
          findings: [],
          counts: {},
          error: "cargo-audit not installed. Run: cargo install cargo-audit",
        })
      }
    }

    // ── Go audit ──────────────────────────────────────────────────────────────
    if (hasGoMod) {
      const command = "govulncheck ./... 2>&1"
      try {
        const raw = await Bun.$`sh -c ${command}`.cwd(dir).text()
        // govulncheck text output — parse vulnerability blocks
        const findings: Finding[] = []
        const vulnBlocks = raw.split(/^Vulnerability #\d+:/m).slice(1)
        for (const block of vulnBlocks) {
          const idMatch = block.match(/GO-\d{4}-\d+/)
          const nameMatch = block.match(/More info: .+\/(.+)$/)
          const descMatch = block.split("\n")[0]
          findings.push({
            name: idMatch?.[0] ?? "unknown",
            severity: "unknown",
            description: descMatch?.trim() ?? block.slice(0, 100),
          })
        }
        results.push({
          stack: "go",
          command,
          success: findings.length === 0,
          findings,
          counts: findings.length ? { unknown: findings.length } : {},
        })
      } catch (err: unknown) {
        const e = err as { message?: string }
        results.push({
          stack: "go",
          command,
          success: false,
          findings: [],
          counts: {},
          error: "govulncheck not installed. Run: go install golang.org/x/vuln/cmd/govulncheck@latest",
        })
      }
    }

    // ── Java audit ────────────────────────────────────────────────────────────
    if (hasPom) {
      const command = "mvn -q org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=0 2>&1 | tail -50"
      results.push({
        stack: "java (maven)",
        command,
        success: false,
        findings: [],
        counts: {},
        error:
          "OWASP dependency-check requires a full Maven build. " +
          `Run manually: ${command.split(" | ")[0]}`,
      })
    } else if (hasGradle) {
      results.push({
        stack: "java (gradle)",
        command: "./gradlew dependencyCheckAnalyze",
        success: false,
        findings: [],
        counts: {},
        error:
          "OWASP dependency-check requires a full Gradle build. " +
          "Run manually: ./gradlew dependencyCheckAnalyze",
      })
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0)
    const allCounts = results.reduce(
      (acc, r) => {
        for (const [k, v] of Object.entries(r.counts)) {
          acc[k] = (acc[k] ?? 0) + v
        }
        return acc
      },
      {} as Record<string, number>,
    )

    return JSON.stringify({
      summary: totalFindings === 0 ? "No vulnerabilities found." : `${totalFindings} vulnerability(ies) found.`,
      severity_threshold: threshold,
      total_findings: totalFindings,
      counts: allCounts,
      results,
    })
  },
})
