# Markdown Style

This document is the canonical writing guide for Markdown content in this repository.

## Purpose

- Keep repository docs easy for humans and coding agents to read linearly.
- Prefer low-noise structures that preserve clarity without spending tokens on layout syntax.
- Keep Markdown writing rules easy to find and apply.

## Default Rule

- Default to headings, bullet lists, numbered lists, and code blocks.
- Do not use Markdown tables by default.

## Guidance Style

- State the preferred form directly.
- Prefer one clear default over paired positive/negative examples when the default is already clear.
- Add a counterexample only when the wrong pattern is common, the cost of misuse is meaningful, or the preferred rule could still be misread.
- When a counterexample is necessary, keep it brief and pair it with the preferred form or replacement pattern.

## Preferred Formats

- Use headings to separate major topics.
- Use bullet lists for navigation, indexes, inventories, and fixed-field reference entries.
- Use numbered lists for ordered procedures and checklists with sequence-sensitive steps.
- Use code blocks for commands, file trees, JSON, and other structured examples.

## Allowed Exceptions

- A Markdown table is allowed only when the task explicitly requests one.
- A Markdown table is allowed when the content is inherently two-dimensional reference data and list form would materially reduce clarity.
- When a table is allowed, keep it small, simple, and easy to read linearly.

## Anti-Patterns

- Do not use tables for navigation.
- Do not use tables for indexes or catalogs that can be expressed as one item per bullet.
- Do not use tables for checklists, workflows, or step-by-step procedures.
- Prefer linear rule lists over tables for trigger rules and simple condition-to-result mappings.
- Do not use tables for simple lists with only one meaningful field per row.

## Common Linear Patterns

Use these patterns when choosing a linear format for new or existing content.

- Navigation or index: rewrite as a flat bullet list with one item per entry.
- Condition matrix or trigger rules: rewrite as `If <condition>, then <result>.`
- Catalog or index: rewrite as one bullet per item with a fixed field order.
