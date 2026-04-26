---
name: task-breakdown
description: Break requirements, documents, or implementation goals into actionable tasks with priorities, owners, risks, and sequencing hints. Use when the user asks to split work into tasks or execution steps.
---

# Task Breakdown

## Goal

Convert a requirement or plan into trackable execution items.

## Workflow

1. Read the source requirement, design note, or recent discussion first.
2. Group tasks by milestone or workstream when that improves clarity.
3. Call out dependencies, blockers, and missing owners.
4. Prefer concrete tasks over vague placeholders.

## Output guidance

- Prefer a `task` output with a populated `tasks` array.
- Each task should have a clear title and, when possible, description, priority, assignee hint, due date hint, and AI suggestion.
- If the source is too ambiguous, emit a `summary` that explains the missing information.
