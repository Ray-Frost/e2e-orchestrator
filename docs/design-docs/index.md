# Design Docs Index

## Purpose

This directory stores architecture and implementation decisions in ADR form so major technical choices are explicit, reviewable, and traceable over time.

## ADR Quick Definition

An ADR (Architecture Decision Record) is a concise record of a significant technical decision, including context, alternatives, final choice, and consequences.

## Scope

Use this directory for decisions that materially affect architecture, interfaces, data ownership, operational behavior, or cross-team maintenance cost.

## When to Write an ADR

Create an ADR when at least one condition is true:

- Multiple viable options exist with non-trivial tradeoffs.
- The decision changes ownership boundaries, data shape, or lifecycle.
- The decision will require follow-up migrations or compatibility handling.
- Future contributors would otherwise need historical context to avoid regressions.

## ADR Status Lifecycle

- Proposed: under review, not yet approved.
- Accepted: approved and normative for future work.
- Superseded: replaced by a newer accepted ADR.
- Rejected: evaluated and explicitly not chosen.

## Naming and Numbering

- Filename format: `ADR-<id>-<slug>.md`
- `<id>` rule: minimum 4-digit zero-padded sequence with no upper bound.
- Examples: `ADR-0001`, `ADR-0002`, ..., `ADR-9999`, `ADR-10000`.
- Title rule: keep IDs in filename and index; H1 titles do not need IDs.

## New ADR Workflow

1. Copy `ADR-TEMPLATE.md` to a new file with the next ADR ID.
2. Fill required metadata and sections.
3. Include at least two realistic options and explicit migration/compatibility impacts.
4. Set status according to review outcome.
5. Update the ADR index table in this file.

## Section Semantics

- **Decision Drivers**: factors used to rank options (`why` one option is preferred).
- **Implementation Constraints**: constraints that govern how the selected option must be implemented.
- **Consequences**: impacts after the decision, including follow-up tasks.

## ADR Index

| ADR ID   | Title                                          | Status   | Date       | File                                                                                         |
| -------- | ---------------------------------------------- | -------- | ---------- | -------------------------------------------------------------------------------------------- |
| ADR-0001 | Prisma Schema and Migration Artifacts Location | Accepted | 2026-03-05 | [ADR-0001-prisma-schema-location.md](./ADR-0001-prisma-schema-location.md)                   |
| ADR-0002 | ESLint Typed-Linting Boundaries in Monorepo    | Accepted | 2026-03-06 | [ADR-0002-eslint-typed-linting-boundaries.md](./ADR-0002-eslint-typed-linting-boundaries.md) |

## Reference Reading

- [Architecture Decision Records (ADR official site)](https://adr.github.io/)
- [Documenting Architecture Decisions (Michael Nygard)](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
- [AWS: What are architecture decision records?](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/what-are-adrs.html)
