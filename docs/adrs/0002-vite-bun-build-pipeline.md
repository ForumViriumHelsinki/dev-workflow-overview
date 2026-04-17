# ADR-0002: Vite + Bun for the build pipeline

## Status

Accepted

## Date

2026-04-08

## Context

The visualization needs:
- TypeScript compilation (Lit decorators, strict mode)
- ESM module bundling
- A dev server with HMR for iterating on stage/tooltip content and component layout
- A production build emitting static assets to `dist/` for GitHub Pages

The project has no server-side runtime, so the build chain is the only "infrastructure" that matters. The team standard at FVH is to prefer the modern, fastest, simplest tool for each layer (see global rules: Bun for JS/TS package management).

## Decision

Use **Vite** as the dev server and bundler, with **Bun** as the package manager and lockfile authority.

- `vite.config.ts` sets `base: "/dev-workflow-overview/"` to match the GitHub Pages subpath.
- `package.json` scripts: `dev` → `vite`, `build` → `vite build`, `preview` → `vite preview`.
- `bun.lock` is the canonical lockfile; CI uses `bun install --frozen-lockfile`.
- TypeScript runs via Vite's built-in esbuild transform (no separate `tsc` build step in CI; type checking is implicit during build and explicit in editors).

## Consequences

**Positive**
- Sub-second HMR for component edits.
- Single config file (`vite.config.ts`) covers dev, build, and preview.
- Bun installs are dramatically faster than npm/yarn; small dependency tree (one runtime dep: `lit`).
- Vite's defaults handle Lit + TypeScript out-of-the-box; no Babel/Webpack config needed.

**Negative**
- Bun is younger than npm/pnpm/yarn; ecosystem edge cases occasionally surface (mostly around Node-only globals, which this project doesn't use).
- esbuild transform skips strict type-checking errors during build by default; type errors surface only in the editor or via an explicit `tsc --noEmit` if added.
- Vite 8 is recent (`^8.0.7` as of 2026-04); pinning the major may be needed if breaking changes appear.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| npm + Webpack | Slower install + slower HMR; more config surface |
| pnpm + Vite | Vite is the win; pnpm vs Bun is a tooling preference, and FVH leans Bun |
| Parcel | Less Lit-specific tooling; fewer plugins for Lit's templating |
| Plain TypeScript + esbuild scripts | Loses HMR and dev server polish |

## Evidence

- `package.json` scripts and lockfile shape (commit `15b521c`)
- `vite.config.ts` defines base path (commit `15b521c`)
- CI step in `.github/workflows/deploy.yml` uses `bun install --frozen-lockfile && bun run build`

---

*Confidence: 9/10. Derived retroactively via `/blueprint:derive-plans` on 2026-04-16.*
