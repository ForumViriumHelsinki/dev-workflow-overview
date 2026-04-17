# dev-workflow-overview

Interactive Lit-based visualization of Forum Virium Helsinki's full service-delivery lifecycle (Setup → Build → Ship → Run → Evolve → Sunset). Static site, deployed to GitHub Pages.

This project sits inside the FVH org repo tree, so org-level instructions in `~/repos/ForumViriumHelsinki/CLAUDE.md` already apply. Project-specific context follows below.

## Tech Stack

| Layer | Choice |
|-------|--------|
| UI | Lit 3 web components (TypeScript, decorators, Shadow DOM) |
| Build | Vite 8 |
| Package manager | Bun (`bun.lock` is the lockfile authority) |
| Hosting | GitHub Pages (subpath `/dev-workflow-overview/`) |
| CI/CD | `.github/workflows/deploy.yml` — push to `main` deploys |

Rationale for each choice lives in the ADRs (see imports below).

## Common Commands

```bash
bun install                  # Install dependencies (use --frozen-lockfile in CI)
bun run dev                  # Vite dev server with HMR
bun run build                # Production build to dist/
bun run preview              # Preview the production build locally
```

There is no automated test suite yet. `bun run build` succeeding (no TypeScript errors, no Vite errors) is the current regression gate. See `.claude/rules/testing.md` for the recommended Vitest + @open-wc/testing direction when tests are added.

## Architecture at a Glance

```
workflow-app (root, owns _activeTooltip state)
├── phase-band × 6        (tinted phase labels, width = stage count)
├── workflow-stage × 14   (number circle + 3 capability cards)
│   └── workflow-card × 3 (icon, name, role, badges)
├── pipeline-arrow × 13   (inline SVG arrows between stages)
├── feedback-arrow        (curved SVG overlay: Monitor → Develop)
└── workflow-tooltip      (fixed overlay, single instance)
```

- All content (stages, tooltips) is compile-time data in `src/data/`. No runtime fetching.
- Theme tokens (colours, badge variants, spacing, shadows) live in `src/styles/theme.ts` and are exposed as CSS custom properties on the root element.
- Cards may carry zero to two indicators from `"ai" | "gate" | "manual" | "automatable" | "doc-gap"`. Unbadged is the "automated and documented" default.

## Blueprint Documents

@docs/prds/project-overview.md

ADRs covering the substantive decisions:

@docs/adrs/README.md

## Project Rules

@.claude/rules/development.md

@.claude/rules/testing.md

@.claude/rules/document-management.md

## What This Project Is Not

- Not a multi-tenant or per-user app — single static page, no auth
- Not deployed to GKE / ArgoCD (unlike most FVH services) — see ADR-0003 for why
- Not a live status dashboard — content is prescriptive (how services *should* be built), not descriptive of any individual project's state
- Not yet covered by automated tests — build success is the only gate

## Editing Content

The visualization's content is its main artifact. To update what readers see:

| Change | File |
|--------|------|
| Add / rename / reorder a stage or phase | `src/data/stages.ts` |
| Edit a tooltip body, doc-gap callout, or automation opportunity | `src/data/tooltips.ts` |
| Add a new badge type | `src/data/stages.ts` (Indicator union) + `src/styles/theme.ts` (token) + `src/components/workflow-card.ts` (render) |
| Adjust colours / spacing | `src/styles/theme.ts` |
| Change layout breakpoint | `src/components/workflow-app.ts` (currently 900px) |

## See Also

- `docs/blueprint/manifest.json` — Blueprint version, task registry, document index
- `docs/blueprint/feature-tracker.json` — Feature progress tracking (placeholder; populate when concrete feature work begins)
- `~/repos/ForumViriumHelsinki/CLAUDE.md` — FVH org-level conventions (already loaded by Claude)
