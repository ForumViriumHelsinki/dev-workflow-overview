# dev-workflow-overview

Interactive single-page visualization of Forum Virium Helsinki's full
service-delivery lifecycle (Setup → Build → Ship → Run → Evolve →
Sunset). Static site built with Lit 3 + Vite 8, deployed to GitHub
Pages.

From April 2026 the site also supports a **live mode** that renders
real-time deployment status for any FVH service — see below.

## Tech stack

| Layer | Choice |
|-------|--------|
| UI | Lit 3 web components (TypeScript, Shadow DOM) |
| Build | Vite 8 |
| Package manager | Bun |
| Hosting (static) | GitHub Pages |
| Hosting (live mode) | `dev-overview.fvh.internal` via Twingate |

## Local development

```bash
bun install
bun run dev       # Vite dev server with HMR
bun run build     # Production build (regenerates OpenAPI types first)
bun run preview   # Preview the production build locally
bun run test      # Vitest unit tests
```

## Project structure

```
src/            Lit frontend (components, data, services, styles)
aggregator/     Go backend that powers live mode
  api/          OpenAPI 3.1 spec — source of truth for types
  cmd/          Go entry point
  internal/     Domain model, cache, source adapters, HTTP + SSE
deploy/         Helm values for the in-cluster deployment
docs/           PRDs, ADRs, PRPs, runbooks
```

## Live mode

The static page is prescriptive — it describes how services *should*
be built. Live mode extends it with real-time status against the 14
lifecycle stages for a given service.

### Viewing a service

Visit `https://dev-overview.fvh.internal/?app=<argocd-application-name>`
to see live status for a known service. For a repo that doesn't yet
have an ArgoCD Application (pre-deploy), use
`?repo=<owner>/<repo>` — the aggregator looks up the repo and renders
the build-phase stages only.

Loading the page with no query parameter gives the static diagram with
no backend calls (PRD-002 FR8.1). The static build is byte-identical
to the pre-live-mode baseline; CI enforces this via a byte-identity
check.

### How it works

A backend service (`status-aggregator`, Go, in-cluster) fans out to
ArgoCD, the Kubernetes API, GitHub, and Sentry, serves a narrow JSON
API, and pushes changes over Server-Sent Events. The browser keeps
static rendering for the educational content and overlays status dots
plus a "Current state" block in each tooltip.

See the blueprint documents for the full picture:

- [PRD-002 — Live Deployment Status](docs/prds/live-deployment-status.md)
- [PRP-002 — Implementation Plan](docs/prps/live-deployment-status.md)
- [ADRs 0006–0011](docs/adrs/README.md)
- [Runbook](docs/runbooks/status-aggregator.md)

## Contributing

- Conventional commits drive release-please versioning
  (`feat(aggregator):`, `feat(web):`, `fix(…):` etc.).
- Every PR runs lint + type check + test; `bun run build` is the
  regression gate for the static site, and `go test ./...` is the gate
  for the aggregator.
- New features that touch the aggregator/frontend contract should
  update `aggregator/api/openapi.yaml` first; `bun run build`
  regenerates `src/services/types.ts` from the spec.
