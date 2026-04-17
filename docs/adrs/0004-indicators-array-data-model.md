# ADR-0004: Use an indicators array + phase discriminator on stage cards

## Status

Accepted

## Date

2026-04-16

## Context

The original prototype (commit `15b521c`) modelled each card with a single `highlight` field — a card was either highlighted (e.g., as a gate) or it wasn't. As the visualization expanded to cover the full lifecycle (commit `ddbf86f`), several orthogonal classifications emerged that a single field could not express simultaneously:

- Whether the step is **AI-driven**
- Whether it is a **gate** (human approval / quality bar)
- Whether it is currently **manual** (human-driven, automatable)
- Whether it has a **doc-gap** (missing artifact)

A card can legitimately be more than one of these (e.g., a deployment approval gate that is currently manual is both `gate` and `manual`). At the same time, the visualization needed phase grouping (Setup / Build / Ship / Run / Evolve / Sunset) for the new phase-band component to size correctly.

## Decision

Refactor the stage data model in `src/data/stages.ts`:

1. Replace single `highlight` with `indicators: Indicator[]` on each card. `Indicator` is a string-literal union: `"ai" | "gate" | "manual" | "automatable" | "doc-gap"`.
2. Cards may carry zero, one, or two indicators. Zero indicators is the default ("automated and documented"); the legend explains this.
3. Add a `phase: PhaseId` discriminator on each `StageData`. `PhaseId` is the literal union of the six phase ids.
4. Export a separate `phases` registry (id, label, colour) so the `phase-band` component can look up display metadata without hardcoding.

## Consequences

**Positive**
- Multi-faceted classification with no schema gymnastics.
- TypeScript exhaustiveness: missing or misspelled indicator values fail at compile time.
- The `phases[]` registry decouples display metadata (label, colour) from stage data, so adding/renaming a phase is a one-line change.
- Phase-band can compute its width from `stages.filter(s => s.phase === id).length` without coupling to a specific component layout.

**Negative**
- Cards with two indicators need a defined render order (handled by the order they appear in the array; consumers must be aware).
- The "default" (no badges) is implicit — readers must consult the legend to understand that an unbadged card means "automated and documented".

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Multiple boolean fields (`isGate`, `isManual`, `isAi`, ...) | Verbose; doesn't enforce mutually-exhaustive validation; awkward to render in a loop |
| Single enum with combined values (e.g., `"gate-manual"`) | Combinatorial explosion; doesn't scale as more indicators get added |
| Tag string array without a literal union | Loses TypeScript safety; typos surface only at runtime |

## Evidence

- Diff in commit `ddbf86f` showing `highlight` → `indicators[]` migration (`src/data/stages.ts:1-2`, `src/components/workflow-card.ts`)
- Phase registry and `phase-band` integration: `src/data/stages.ts`, `src/components/phase-band.ts:64-78`

---

*Confidence: 9/10. Derived retroactively via `/blueprint:derive-plans` on 2026-04-16.*
