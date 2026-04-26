---
name: environment-switch
description: Evaluate whether a request should move to a different bound environment, repository, or branch context. Use when the user asks to switch environments or when the current environment is clearly mismatched.
---

# Environment Switch

## Goal

Assess whether the current execution environment fits the task.

## Workflow

1. Compare the user request against the current project, repository, and branch context.
2. Explain why a switch is or is not needed.
3. Surface risks before any environment change is proposed.

## Output guidance

- Prefer a `summary` output.
- Be explicit about the target environment or the reason to stay on the current one.
