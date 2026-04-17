# ADR-0001: Use Lit + TypeScript for componentization

## Status

Accepted

## Date

2026-04-08

## Context

The original prototype lived in a single 1200-line standalone file (`dev-workflow-overview.html`, see commit `15b521c`). To make the visualization maintainable, testable, and extensible (e.g., the later expansion to a 14-stage / 6-phase model in commit `ddbf86f`), the markup, styling, and behaviour needed to be decomposed into discrete units.

Constraints:

- Static deployment target (GitHub Pages); no server runtime allowed.
- Single contributor; framework with low ceremony preferred over enterprise-grade options (React/Angular).
- Output should be small enough to load instantly on a single landing-page visit.
- TypeScript desired for compile-time validation of the stage / tooltip data structures (which grew to 14 stages × 3 cards = 42 entries plus ~40 tooltips).

## Decision

Use [Lit](https://lit.dev) as the component framework with TypeScript decorators (`@customElement`, `@property`, `@state`).

Conventions:
- One component per file under `src/components/`.
- Filename matches the custom element tag in kebab-case (`workflow-stage.ts` → `<workflow-stage>`).
- Co-locate styles via `static styles = css\`...\``.
- Root element `<workflow-app>` is registered in `index.html` and owns top-level state (e.g., `_activeTooltip`).

## Consequences

**Positive**
- Native web components; no virtual DOM runtime overhead.
- Strict TypeScript catches data-shape regressions across the indicators / tooltip records.
- Component boundaries match the visual model (stage, card, tooltip, arrow), making the codebase easy to navigate.
- Small dependency footprint (Lit ~5 KB gzipped + project code).

**Negative**
- Custom element registration is global; multiple instances of the app on one page would conflict (not a real constraint here).
- Shadow DOM styling means Tailwind / global utility CSS is not directly applicable; theme tokens must be exposed as CSS custom properties (handled by `src/styles/theme.ts`).
- Smaller ecosystem than React; some patterns (testing, devtools) require choosing tooling explicitly.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Plain HTML + vanilla TS (continue prototype) | Prototype already showed this scales poorly past ~1000 lines |
| React + Vite | Heavier runtime; overkill for a single-page static visualization with no client routing |
| Svelte | Viable, but Lit's standards-aligned web component output was a tighter fit for a static, framework-agnostic embed |

## Evidence

- Initial componentization: commit `15b521c` (`feat: initial dev workflow overview visualization`)
- Subsequent expansion benefiting from the structure: commit `ddbf86f` (`feat: expand workflow overview to full project lifecycle`)
- Component files: `src/components/workflow-app.ts`, `workflow-stage.ts`, `workflow-card.ts`, `workflow-tooltip.ts`, `phase-band.ts`, `pipeline-arrow.ts`, `feedback-arrow.ts`

---

*Confidence: 9/10. Derived retroactively via `/blueprint:derive-plans` on 2026-04-16.*
