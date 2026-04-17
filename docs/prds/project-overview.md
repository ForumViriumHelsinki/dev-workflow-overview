# PRD-001: dev-workflow-overview — Product Requirements Document

**Status:** Active (retroactively derived)
**Created:** 2026-04-16
**Confidence:** 9/10 (single contributor, 100% conventional commits, comprehensive audit)
**Source commits:** `15b521c`, `ddbf86f`

## 1. Problem & Purpose

Forum Virium Helsinki delivers cloud-native services through a multi-team, multi-tool pipeline (GitHub Actions, ArgoCD, Helm, GCP, Sentry, Kyverno, Terraform, Renovate, release-please). New hires, technical leadership, and stakeholders need a single canonical view of how a service moves from idea to sunset, where the gates are, what is automated vs. manual, and which artifacts are missing.

`dev-workflow-overview` is an interactive, single-page web visualization of that lifecycle. It is **prescriptive** (this is how services should be built) rather than descriptive of any individual project's state. It surfaces documentation gaps and automation opportunities directly in the visual, making the meta-roadmap actionable.

## 2. Audience

| Audience | Primary use |
|----------|-------------|
| Technical leadership at FVH | Single source of truth for lifecycle governance |
| Developers (existing & onboarding) | Reference for stage ownership, gates, and automation posture |
| Stakeholders / partners | High-level view of FVH's delivery model |

## 3. Functional Requirements

### FR1 — Lifecycle visualization
- **FR1.1** Render 14 sequential stages organized into 6 phases: Setup → Build → Ship → Run → Evolve → Sunset.
- **FR1.2** Each stage exposes 3 capability cards (icon, name, role).
- **FR1.3** Phases are visually grouped via tinted phase-band labels sized to span their stages.
- **FR1.4** Inter-stage flow is shown via right-pointing pipeline arrows.
- **FR1.5** A curved feedback arrow runs from Monitor back to Develop, labelled as the operate loop.

### FR2 — Multi-indicator badge system
- **FR2.1** Each card may carry zero to two badges from the set: `ai`, `gate`, `manual`, `automatable`, `doc-gap`.
- **FR2.2** Unbadged cards represent the automated-and-documented default and require no annotation.
- **FR2.3** A footer legend explains each badge variant; badge colours align with theme tokens.

### FR3 — Tooltip detail panel
- **FR3.1** Clicking a card opens a fixed-position tooltip with title, subtitle, narrative body, and detailed bullet list.
- **FR3.2** Tooltips may include a `docGap` callout listing missing documents and a suggested location.
- **FR3.3** Tooltips may include an `automationOpportunity` callout describing what could be automated and what currently blocks it.
- **FR3.4** Doc-gap callouts visually take precedence (dashed yellow border, higher z-index) over automation callouts.

### FR4 — Responsive layout
- **FR4.1** Pipeline rail collapses gracefully below 900px viewport width (reduced stage width, two-row arrangement preserved).
- **FR4.2** Phase-band widths recompute when the window resizes.

### FR5 — Static deployment
- **FR5.1** The site is statically generated; no runtime data fetching.
- **FR5.2** All content (stages, tooltips, theme) is type-checked at build time via TypeScript.
- **FR5.3** Production build deploys to GitHub Pages on push to `main`.

### FR6 — Theming
- **FR6.1** Dark theme based on a GitHub-inspired palette is the default and only theme.
- **FR6.2** Components consume colour, spacing, radius, shadow, and badge tokens from a single theme module.

## 4. Non-functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Initial render must complete without runtime errors in evergreen browsers (Chrome/Firefox/Safari current) |
| NFR2 | Build must succeed via `bun run build` with zero TypeScript errors |
| NFR3 | Feedback arrow must track DOM rect changes within one animation frame of layout updates |
| NFR4 | Site must be navigable via mouse; keyboard navigation is a stretch goal (see Open Questions) |

## 5. Out of Scope

- User authentication or per-user state
- Server-side rendering or dynamic content
- Live integration with FVH services (no real-time deployment status)
- Editable content (data is compile-time)
- Dark/light theme toggle
- Localization (English only)

## 6. Architecture Summary

See ADRs for full rationale:

- [ADR-0001: Lit + TypeScript for componentization](../adrs/0001-lit-typescript-componentization.md)
- [ADR-0002: Vite + Bun for the build pipeline](../adrs/0002-vite-bun-build-pipeline.md)
- [ADR-0003: GitHub Pages for hosting](../adrs/0003-github-pages-hosting.md)
- [ADR-0004: Indicators array + phase discriminator data model](../adrs/0004-indicators-array-data-model.md)
- [ADR-0005: SVG overlay with ResizeObserver + rAF for cross-component arrows](../adrs/0005-svg-overlay-arrow-tracking.md)

Component hierarchy:

```
workflow-app (root, state owner)
├── phase-band × 6
├── workflow-stage × 14
│   └── workflow-card × 3
├── pipeline-arrow × 13
├── feedback-arrow (SVG overlay)
└── workflow-tooltip (fixed overlay, single instance)
```

Data lives entirely in `src/data/` (`stages.ts`, `tooltips.ts`); theme tokens in `src/styles/theme.ts`.

## 7. Open Questions / Future Considerations

- Keyboard navigation and screen-reader support are not yet implemented (NFR4).
- No automated test suite exists; build-success is the only regression gate (see `.claude/rules/testing.md`). Test harness introduction is planned as part of PRD-002 delivery.
- The visualization's content (stage definitions, doc-gap callouts) is itself a meta-roadmap for FVH's process maturity — content updates likely outpace structural changes.
- Multi-language or alternative theme support would require theme/data refactor before being added.
- **Live-status extension** — turning the prescriptive diagram into an optional live dashboard per deployment is specified in [PRD-002: Live Deployment Status](live-deployment-status.md) (architecture in ADRs 0006–0011, implementation plan in [PRP-002](../prps/live-deployment-status.md)).

## 8. Success Signals

| Signal | How measured |
|--------|--------------|
| Adoption | Visualization linked from FVH internal docs / onboarding material |
| Accuracy | Stage definitions match current org practice (reviewed when policies change) |
| Doc-gap closure | Items flagged with `doc-gap` indicator decrease over time as missing artifacts are authored |

---

*Generated retroactively via `/blueprint:derive-plans` on 2026-04-16. Confidence 9/10.*
