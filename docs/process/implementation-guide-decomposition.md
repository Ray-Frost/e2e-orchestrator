# Implementation Guide Decomposition

This document records the transition model for decomposing `IMPLEMENTATION_GUIDE.md` into feature-level planning assets and narrower long-lived documents.

## Purpose

- Give the maintainer a stable in-repo reference for the current decomposition approach.
- Give coding agents a shared rule set for where to look and where to write.
- Replace the current "one large implementation guide" workflow with a layered model that is easier to evolve feature by feature.

## Scope

This document is intentionally narrow.

It covers:

- how to break down `IMPLEMENTATION_GUIDE.md`,
- where extracted feature-planning content should go,
- how this transition relates to ADRs, process docs, and optional lookup-oriented docs,
- and when migrated content can be removed from the guide.

It does not replace:

- `docs/README.md` for docs-tree navigation,
- `docs/process/markdown-style.md` for Markdown writing rules,
- `AGENTS.md` for repository navigation and current source-of-truth rules,
- or the platform principles document for product and runtime invariants.

## Status of This Document

This is a transition process document, not a permanent requirement by default.

The goal is to keep it while at least one of these conditions is true:

- the repository is still actively decomposing `IMPLEMENTATION_GUIDE.md`,
- the maintainer still needs a written reminder of the model,
- or coding agents still benefit from one explicit transition reference.

This document does not need a forced deletion target. Once the model is stable, one of these outcomes is acceptable:

- keep this file as a short process doc,
- merge its lasting rules into better-fit docs,
- or delete it after its useful content has been redistributed.

Deletion is not a goal by itself. Clear ownership and low overlap are the goals.

## Goals

- Plan implementation work around independently scoped features, not around one monolithic guide.
- Keep long-lived decisions, feature plans, and optional stable lookup material in different document types.
- Reduce source-of-truth conflicts and make handoff to coding agents more direct.
- Allow `IMPLEMENTATION_GUIDE.md` to shrink over time and eventually be deleted or replaced.

## Current Problem

`IMPLEMENTATION_GUIDE.md` was useful as an early macro plan, but it currently mixes several different kinds of content:

- platform-wide constraints,
- feature planning,
- API and behavior details,
- implementation sequencing,
- decided rules,
- and still-open details.

That mixed role is acceptable in a bootstrap phase, but it becomes a poor primary input for coding agents once feature work starts because:

- the context is too broad,
- the authority boundaries are unclear,
- and a new feature spec can easily conflict with the guide if both are treated as authoritative.

## Relationship to Existing Docs

This document should be read as a transition-layer process note.

- The current docs root index defines the `docs/` structure and browsing entrypoints.
- The current Markdown style guide defines how Markdown content should be written.
- The ADR area keeps its existing role for architecture decision history.
- `AGENTS.md` keeps its existing role for repository navigation and current source-of-truth rules.
- `IMPLEMENTATION_GUIDE.md` still acts as the current macro planning source during transition.

This file exists because none of the documents above, on their own, describe how to migrate from the current monolithic guide to a feature-spec workflow.

## Model Summary

Use a layered model with different document types for different purposes.

- Platform principles document:
  Holds cross-feature goals, boundaries, non-goals, terminology, and stable invariants.
- Feature specs:
  Hold the planning assets for one feature at a time.
- ADRs:
  Hold durable decisions with meaningful tradeoffs.
- Optional reference docs:
  Hold stable implemented facts only when repeated lookup value justifies a separate document.
- Process docs:
  Hold contributor workflows, quality gates, and documentation rules.

In the transition period, `IMPLEMENTATION_GUIDE.md` temporarily acts as the platform principles document plus migration index. In the target state, that role should move to a better-named stable document such as `CONSTITUTION.md` or `PLATFORM_PRINCIPLES.md`.

## Target Document Roles

### Platform Principles Document

Recommended long-term role:

- project goals and system boundaries,
- non-goals,
- cross-repo boundaries,
- platform-wide invariants,
- shared terminology,
- documentation model and source-of-truth rules,
- and links to feature specs or optional lookup docs when useful.

This document should not hold feature-by-feature execution plans once decomposition is underway.

### Feature Specs

Recommended location:

- `docs/specs/<id>-<feature-slug>/`

If `docs/specs/` is introduced as a new root docs area, register it in the docs root index in the same change.

Recommended minimum files:

- `spec.md`
- `plan.md`
- `tasks.md`

Optional file:

- `contracts.md`

Use feature specs for one vertical slice that can be planned, implemented, and validated with a clear acceptance boundary.

### Optional Reference Docs

No dedicated directory is required up front.

Introduce reference docs only when a topic has all of these properties:

- it describes stable implemented facts or contracts,
- it is likely to be looked up repeatedly,
- and it would be awkward to keep rediscovering from feature specs or scattered code.

Reference docs are not implementation intent and not line-by-line code explanation.

Examples of good reference-doc content, when they become worthwhile:

- API reference,
- runtime artifact conventions,
- parsing rules that are intentionally stable,
- operational behavior that is already implemented and worth looking up later.

Avoid using reference docs to mirror volatile implementation detail.

If a detail changes frequently with the code, prefer the code as the source of truth and keep the reference doc at the level of stable behavior, contract, or lookup guidance.

## Authority Model

This document does not redefine the repository source-of-truth hierarchy.

### Transition Rule

Until the repository truth hierarchy is updated, follow the current rules in `AGENTS.md`.

In practice, that means `IMPLEMENTATION_GUIDE.md` remains the active high-authority source for runtime behavior and API intent during this transition, and new feature specs must not silently conflict with it.

Before feature specs become the primary implementation input for coding agents, update the repository source-of-truth rules so the hierarchy is explicit and non-contradictory.

## Feature Planning Workflow

Use this flow when starting a new feature.

1. Pick one vertical feature slice from `IMPLEMENTATION_GUIDE.md` or from a later roadmap source.
2. Confirm the slice is independently meaningful and has a clear acceptance boundary.
3. If the feature introduces a new root docs area such as `docs/specs/`, update the docs root index in the same change.
4. Extract only the relevant content into `docs/specs/<id>-<feature-slug>/spec.md`.
5. Resolve or explicitly record critical TBD items before coding starts.
6. If the feature raises a cross-feature decision, write or update an ADR before implementation depends on it.
7. Write `plan.md` with implementation approach, affected areas, testing strategy, and risks.
8. Write `tasks.md` as an execution-oriented breakdown that a coding agent can consume directly.
9. Use `tasks.md` as the primary implementation input for the coding thread.
10. After implementation, create a reference doc only when a durable lookup document is genuinely useful.
11. Remove the migrated feature-planning content from `IMPLEMENTATION_GUIDE.md` once the removal criteria are met.

## Feature Spec Requirements

A feature spec is ready for coding-agent use only when it answers these questions clearly:

- Why is this feature being implemented now?
- What is in scope?
- What is out of scope?
- Which APIs, DB structures, runtime artifacts, or UI surfaces are affected?
- Which global constraints must be inherited from higher-authority docs?
- What are the acceptance criteria?
- What are the validation or test expectations?
- Which open questions remain, and do any of them block implementation?

If key behavior is still unresolved, do not treat the feature as ready for implementation.

## Spec Writing Guardrails

Use these rules to keep `spec.md` feature-facing instead of migration-facing.

- `spec.md` should describe the feature itself, not the act of extracting or
  rewriting documentation.
- `Purpose` should explain what the feature covers or locks, not why the doc
  was created.
- `Why This Feature Exists Now` should explain product, operator, or runtime
  value, not guide-maintenance or decomposition reasons.
- Do not put extraction history, "coding thread" guidance, or "without
  rereading the guide" wording in `spec.md`.
- Put migration notes in process docs, the docs index, commit messages, or PR
  descriptions instead.
- Put execution and handoff wording in `tasks.md`, not in the spec body.

## Suggested Feature Spec Structure

### `spec.md`

Recommended sections:

- purpose,
- scope,
- non-goals,
- user-visible behavior,
- API or behavior expectations,
- acceptance criteria,
- open questions.

### `plan.md`

Recommended sections:

- implementation approach,
- affected files or modules,
- DB or migration impact,
- API impact,
- artifact or runtime impact,
- test strategy,
- risks and rollback notes.

### `tasks.md`

Recommended structure:

- small ordered tasks,
- each task scoped to a concrete outcome,
- each task naming the main file or module area,
- each task including a validation note where useful.

Tasks should be written so a coding agent can execute them without re-reading a large macro document.

## Feature Slicing Rules

Prefer these properties when deciding whether something is one feature:

- vertically scoped across layers when needed,
- independently testable,
- independently reviewable,
- and small enough that one planning thread can define it without carrying the whole project in context.

Do not split by document chapter alone. Split by meaningful capability slice.

Good candidate slices for this repository include:

- run lifecycle core,
- run termination,
- artifacts and `meta.json`,
- results ingest,
- failure statistics,
- stdout logs API,
- restart recovery,
- web runs and details views.

## Migration Rules for `IMPLEMENTATION_GUIDE.md`

When a feature is extracted, treat `IMPLEMENTATION_GUIDE.md` as a migration source, not as the permanent home of that feature plan.

Remove a feature-specific section from `IMPLEMENTATION_GUIDE.md` only when all of the following are true:

- an independent feature spec exists,
- blocking decisions have been resolved or moved to ADRs,
- the feature can be implemented from the spec and tasks without depending on the old guide section,
- and any lasting implemented facts have a clear home if they need one.

During the transition, it is acceptable for `IMPLEMENTATION_GUIDE.md` to retain short summary links or migration notes instead of full feature detail.

## Adoption Phases

Use the model in phases rather than rewriting all docs at once.

### Phase 1

- Record this model.
- Stop expanding `IMPLEMENTATION_GUIDE.md` with new feature-level implementation detail.
- Keep using the guide as the macro migration source.

### Phase 2

- Start feature work from extracted feature specs.
- Use one feature as the pilot pattern.
- Refine the spec, plan, and tasks format based on actual implementation use.

### Phase 3

- Update repository source-of-truth rules so feature specs have an explicit place in the authority model.
- Introduce reference docs only where repeated stable lookup needs justify them.

### Phase 4

- Remove feature-planning content from `IMPLEMENTATION_GUIDE.md` as features migrate.
- Delete or replace `IMPLEMENTATION_GUIDE.md` once its useful content has been redistributed.

## End State

The target end state is:

- no monolithic implementation guide acting as the default planning input,
- one stable platform principles document,
- one feature-spec directory for implementation planning,
- ADRs for durable decisions,
- and optional lookup docs only where they earn their maintenance cost.

At that point, the current `IMPLEMENTATION_GUIDE.md` should either be deleted or replaced by a narrower, better-named stable document.

This transition document may then remain, be shortened, be merged elsewhere, or be deleted. The correct choice depends on whether it still carries unique value.

## Working Conventions

Recommended conventions for future feature-spec work:

- Use zero-padded numeric prefixes for feature directories when ordering matters.
- Keep one feature per directory.
- Keep file names predictable: `spec.md`, `plan.md`, `tasks.md`.
- Do not copy large unchanged sections from the platform principles document into every feature spec.
- Link to higher-authority documents instead of duplicating stable rules.
- Keep feature specs focused on what is needed to implement that feature.

## Notes for Coding Agents

When this model is in use:

- read the platform principles document first for invariants,
- read the active feature spec second for feature scope and acceptance,
- read ADRs for decisions referenced by the feature,
- and avoid treating old macro-planning text as the primary implementation source once a migrated feature spec exists.

In the current transition period, check whether a feature already has a dedicated spec before relying on `IMPLEMENTATION_GUIDE.md` alone.
