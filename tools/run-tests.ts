import { tool } from "@opencode-ai/plugin"
import path from "path"

/**
 * run-tests — Detects the package manager and test framework in use,
 * constructs the correct test command, and executes it.
 *
 * Eliminates the need for agents to guess `npm test` vs `pytest` vs `go test`.
 *
 * Supported stacks:
 *   Node.js:  npm / pnpm / yarn / bun  ×  jest / vitest / mocha / playwright
 *   Python:   pytest / python -m pytest
 *   Go:       go test
 *   Java:     mvn test / gradle test
 */
export default tool({
  description:
    "Detects the package manager and test framework in the current project and runs the test suite. " +
    "Supports Node.js (npm/pnpm/yarn/bun + jest/vitest/mocha/playwright), Python (pytest), Go, and Java (Maven/Gradle). " +
    "Pass an optional filter pattern to run a subset of tests.",
  args: {
    filter: tool.schema
      .string()
      .optional()
      .describe(
        "Optional test filter / file pattern. E.g. 'auth' runs only auth-related tests.",
      ),
    coverage: tool.schema
      .boolean()
      .optional()
      .describe("Whether to collect coverage. Defaults to false."),
  },
  async execute(args, context) {
    const dir = context.worktree || context.directory

    // ── 1. Detect package manager (Node) ──────────────────────────────────────
    const hasBunLock = await Bun.file(path.join(dir, "bun.lockb")).exists()
    const hasPnpmLock = await Bun.file(path.join(dir, "pnpm-lock.yaml")).exists()
    const hasYarnLock = await Bun.file(path.join(dir, "yarn.lock")).exists()
    const hasPackageJson = await Bun.file(path.join(dir, "package.json")).exists()

    let pm: "bun" | "pnpm" | "yarn" | "npm" | null = null
    if (hasBunLock) pm = "bun"
    else if (hasPnpmLock) pm = "pnpm"
    else if (hasYarnLock) pm = "yarn"
    else if (hasPackageJson) pm = "npm"

    // ── 2. Detect test framework (Node) ───────────────────────────────────────
    let nodeTestCmd: string | null = null
    if (pm && hasPackageJson) {
      const pkg = await Bun.file(path.join(dir, "package.json")).json()
      const scripts: Record<string, string> = pkg.scripts || {}
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      } as Record<string, string>

      const runner = pm === "bun" ? "bunx" : "npx"

      if (scripts.test && !scripts.test.includes("no test specified")) {
        const coverageFlag = args.coverage
          ? deps.vitest ? " --coverage" : deps.jest ? " --coverage" : ""
          : ""
        const filterFlag = args.filter
          ? deps.vitest ? ` ${args.filter}` : ` --testPathPattern="${args.filter}"`
          : ""
        nodeTestCmd = `${pm} ${pm === "npm" ? "run " : ""}test${coverageFlag}${filterFlag}`
      } else if (deps.vitest) {
        const coverageFlag = args.coverage ? " --coverage" : ""
        const filterFlag = args.filter ? ` ${args.filter}` : ""
        nodeTestCmd = `${runner} vitest run${coverageFlag}${filterFlag}`
      } else if (deps.jest || deps["@jest/core"]) {
        const coverageFlag = args.coverage ? " --coverage" : ""
        const filterFlag = args.filter ? ` --testPathPattern="${args.filter}"` : ""
        nodeTestCmd = `${runner} jest${coverageFlag}${filterFlag}`
      } else if (deps["@playwright/test"]) {
        const filterFlag = args.filter ? ` --grep "${args.filter}"` : ""
        nodeTestCmd = `${runner} playwright test${filterFlag}`
      } else if (deps.mocha) {
        const filterFlag = args.filter ? ` --grep "${args.filter}"` : ""
        nodeTestCmd = `${runner} mocha${filterFlag}`
      }
    }

    // ── 3. Detect Python ──────────────────────────────────────────────────────
    const hasPyproject = await Bun.file(path.join(dir, "pyproject.toml")).exists()
    const hasSetupPy = await Bun.file(path.join(dir, "setup.py")).exists()
    const hasRequirements = await Bun.file(path.join(dir, "requirements.txt")).exists()
    const isPython = hasPyproject || hasSetupPy || hasRequirements

    let pythonTestCmd: string | null = null
    if (isPython && !nodeTestCmd) {
      const coverageFlag = args.coverage ? "--cov=. --cov-report=term " : ""
      const filterFlag = args.filter ? `-k "${args.filter}" ` : ""
      pythonTestCmd = `pytest ${coverageFlag}${filterFlag}-v 2>&1 || python -m pytest ${coverageFlag}${filterFlag}-v`
    }

    // ── 4. Detect Go ──────────────────────────────────────────────────────────
    const hasGoMod = await Bun.file(path.join(dir, "go.mod")).exists()
    let goTestCmd: string | null = null
    if (hasGoMod && !nodeTestCmd && !pythonTestCmd) {
      const coverageFlag = args.coverage ? " -cover" : ""
      const filterFlag = args.filter ? ` -run "${args.filter}"` : ""
      goTestCmd = `go test ./...${coverageFlag}${filterFlag}`
    }

    // ── 5. Detect Java ────────────────────────────────────────────────────────
    const hasPom = await Bun.file(path.join(dir, "pom.xml")).exists()
    const hasGradle =
      (await Bun.file(path.join(dir, "build.gradle")).exists()) ||
      (await Bun.file(path.join(dir, "build.gradle.kts")).exists())

    let javaTestCmd: string | null = null
    if (!nodeTestCmd && !pythonTestCmd && !goTestCmd) {
      if (hasPom) {
        const filterFlag = args.filter ? ` -Dtest="${args.filter}"` : ""
        javaTestCmd = `mvn test -q${filterFlag}`
      } else if (hasGradle) {
        const filterFlag = args.filter ? ` --tests "${args.filter}"` : ""
        javaTestCmd = `./gradlew test${filterFlag} 2>/dev/null || gradle test${filterFlag}`
      }
    }

    // ── 6. Build final command ────────────────────────────────────────────────
    const command = nodeTestCmd ?? pythonTestCmd ?? goTestCmd ?? javaTestCmd

    if (!command) {
      return JSON.stringify({
        success: false,
        error:
          "Could not detect a test framework. " +
          "Ensure you have package.json (jest/vitest/mocha/playwright), " +
          "pyproject.toml/setup.py (pytest), go.mod (go test), " +
          "or pom.xml/build.gradle (Maven/Gradle).",
        detected: { pm, isPython, hasGoMod, hasPom, hasGradle },
      })
    }

    // ── 7. Execute ────────────────────────────────────────────────────────────
    let output = ""
    let exitCode = 0

    try {
      output = await Bun.$`sh -c ${command}`.cwd(dir).text()
    } catch (err: unknown) {
      exitCode = (err as { exitCode?: number }).exitCode ?? 1
      const e = err as { stdout?: string; stderr?: string }
      output = [e.stdout, e.stderr].filter(Boolean).join("\n")
    }

    return JSON.stringify({
      success: exitCode === 0,
      command,
      detected: { pm, isPython, hasGoMod, hasPom, hasGradle },
      output: output.trim(),
      exitCode,
    })
  },
})
