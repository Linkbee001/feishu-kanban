---
name: code-analysis
description: Analyze repository structure, code modules, technical risks, or implementation patterns using read-only inspection. Use when the user asks about code, architecture, modules, repository status, or impact analysis.
---

# Code Analysis

## Goal

Produce a grounded assessment based on repository evidence.

## Workflow

1. Inspect the repository before making claims.
2. Read the most relevant files instead of relying on directory names alone.
3. Distinguish confirmed facts from inferences.
4. Highlight risks, dependencies, and likely impact areas.

## Output guidance

- Prefer a `summary` output for direct analysis.
- Use a `document` output when the analysis should become a reusable design or review note.
- Quote file paths or module names in the content when helpful.
