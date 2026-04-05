# Core Rules — Universal Principles

These rules apply to every agent, task, and session. Language-agnostic. Always active.

## Behavior

- Think before acting. Explore first, implement second.
- Make the minimal change that solves the problem.
- Never delete or overwrite code without reading it first.
- If uncertain, ask one focused question — do not guess.
- Prefer editing existing files over creating new ones.
- Never create documentation files unless explicitly requested.

## Code Quality

- Functions do one thing. If a function needs a comment to explain "what", split it.
- Name things for what they are, not what they do. `UserRepository`, not `handleUsers`.
- Avoid nested conditionals beyond 2 levels — extract to a named function.
- No magic numbers or strings. Use constants with descriptive names.
- No commented-out code. Delete it or keep it — never comment it out.
- Prefer explicit over implicit. Clarity beats cleverness.

## Error Handling

- All errors must be handled. No silent swallowing.
- Error messages must include context: what failed, why, what the caller can do.
- Distinguish recoverable errors (return) from unrecoverable ones (throw/panic).
- Never log and re-throw the same error. Choose one.

## Security

- No hardcoded secrets, credentials, tokens, or API keys in source code.
- All external input is untrusted until validated.
- Fail closed: when in doubt, deny access and log.

## Verification

- Always run tests after a change. Never commit without verifying.
- A fix is not complete until the original failing case passes AND no regressions.
- If there are no tests for a path you modified, write one.

## Communication

- Summarize what you did, not what you tried.
- Report blockers early — do not spin for 3 attempts without surfacing the problem.
- Keep responses short. One paragraph or a bullet list. No essays.
- When told "yes", "do it", or "proceed" — execute. Do not repeat the plan.

## Planning

- When asked to plan: output only the plan. Write zero code until explicitly told to proceed.
- For non-trivial work (3+ steps or architectural impact): ask about implementation approach, tradeoffs, and UX before coding.
- Never attempt multi-file refactors in a single response. Max 5 files per phase — commit, verify, then continue.
- Follow the plan exactly once confirmed. Flag real blockers and wait — do not silently deviate.

## Edit Safety

- Before editing any file: re-read it. After editing: read it again to confirm the change is correct and the file is coherent.
- On any rename or signature change: search separately for direct calls, type references, string literals, dynamic imports, `require()`, re-exports, barrel files, and test mocks. Assume a plain grep missed something — verify manually.
- Never delete a file without first verifying nothing imports or references it.
- Before structural refactoring on files > 300 LOC: first remove dead props, unused exports, unused imports, and debug logs in a separate commit.

## Context Management

- After 10+ messages in a session: re-read any file before editing it — context compaction may have dropped earlier reads.
- File reads are capped at 2,000 lines. For files > 500 LOC, use `offset`/`limit` to read in focused chunks rather than loading the whole file.
- Tool results > 50K chars will be truncated to a preview. Re-run the tool with a narrower scope to get the full output.
- If context degradation is noticed (repeating mistakes, forgetting earlier decisions): run `/compact` proactively before continuing.

## Self-Correction

- After any correction from the user: identify the pattern of the mistake and avoid repeating it in the same session.
- If a fix does not work after two attempts: stop. Re-read the entire relevant section from the top. State explicitly where the mental model was wrong before attempting again.
- When validating own output: adopt a new-user perspective — someone who did not participate in building it and has no assumed context.
