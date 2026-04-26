---
name: project-init
description: Initialize a new project workspace by extracting key project metadata, identifying missing setup fields, and preparing the first project summary. Use when the group or project is being bound for the first time.
---

# Project Init

## Goal

Collect the minimum viable project definition without over-questioning.

## Workflow

1. Extract project name, repository, branch, model, and collaboration intent from the latest message.
2. Ask only for the most critical missing field when information is incomplete.
3. Keep the bootstrap response structured and explicit about readiness.

## Output guidance

- Prefer a `summary` output for bootstrap exchanges.
- Focus on readiness, missing fields, and the next required input.
