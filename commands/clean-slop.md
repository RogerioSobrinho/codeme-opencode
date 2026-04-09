---
description: Scan staged changes for AI slop patterns — over-explanation, hollow phrases, filler comments, verbose prose. Reports lines to remove or tighten.
agent: code-review
---

Review the following staged diff for AI-generated slop patterns. These are patterns that add verbosity without adding value:

!`git diff --staged 2>/dev/null || git diff HEAD~1 2>/dev/null`

## What to flag

Flag **only** lines that match one or more of these patterns:

**Hollow phrases (delete them):**
- "This function/method/class ..." comments that restate what the name already says
- "As you can see ...", "Note that ...", "Please note ...", "It's worth noting ..."
- "In order to ...", "So as to ..." (replace with "to")
- "Very", "quite", "really", "basically", "essentially", "simply" (delete the adverb)
- "I'll now ...", "Let me ...", "We need to ..." in comments

**Over-explanation comments (delete or tighten):**
- Comments that repeat what the next line of code already says
- TODO/FIXME left in committed code without a ticket reference
- Block comments on trivial operations (incrementing, simple assignments)

**Verbose prose in strings/messages:**
- Error messages over 80 chars that could be 20
- Log messages that include "successfully" ("saved" is enough)
- Console output that explains what is about to happen instead of what happened

**Padding in code:**
- Empty `else` blocks: `else { /* nothing */ }`
- Commented-out code left in the diff
- Redundant type annotations where inference is obvious

## Output format

For each finding:

```
FILE:LINE  [pattern type]
> offending line
FIX: what to do (one sentence, concrete)
```

Do not report style issues, naming conventions, or formatting.
End with a count: "N slop patterns found" or "No slop patterns found".
