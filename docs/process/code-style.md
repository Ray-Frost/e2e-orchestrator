# Code Style

This document records repository-wide code-style defaults for locally authored
implementation code.

## Purpose

- Keep local code easy for humans and coding agents to read linearly.
- Record repository-level style decisions without expanding `AGENTS.md` into a
  low-level style guide.

## Scope

- These defaults apply to locally authored code across the repository unless a
  scoped authority or external contract requires otherwise.
- When a lint rule enforces one of these constraints, the lint config is the
  executable authority and this document explains the intent behind it.
- Preserve externally required names from framework APIs, browser APIs,
  third-party libraries, generated types, or stable public contracts.

## Defaults

- Name boolean-returning functions as yes-or-no predicates with prefixes such
  as `is`, `has`, `can`, or `should`.
