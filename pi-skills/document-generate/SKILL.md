---
name: document-generate
description: Draft or refine structured project documents such as PRDs, technical plans, design notes, or implementation outlines. Use when the user asks for a formal document, proposal, or written plan.
---

# Document Generate

## Goal

Turn the available project context into a clean, decision-ready document.

## Workflow

1. Read the most relevant existing documents, recent runs, and artifacts before drafting.
2. Reuse established terminology from the repository or project documents.
3. State assumptions when requirements are incomplete.
4. Prefer a structure with summary, current context, proposal, risks, and next steps.

## Output guidance

- Produce a `document` output when a durable document should be stored.
- Produce a `summary` output when the request only needs a concise answer.
- Keep sections explicit and easy to scan.
