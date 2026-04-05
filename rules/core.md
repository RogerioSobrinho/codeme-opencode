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
