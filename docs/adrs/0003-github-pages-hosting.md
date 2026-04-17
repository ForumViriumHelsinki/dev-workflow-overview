# ADR-0003: Host the visualization on GitHub Pages

## Status

Accepted

## Date

2026-04-08

## Context

`dev-workflow-overview` produces a single static bundle. Hosting requirements:

- Public, low-friction URL accessible to FVH staff and partners
- Automatic redeploy on merge to `main`
- No backend, database, or auth
- Zero per-month cost
- Visible from inside FVH's normal documentation surface (the org already lives on GitHub)

FVH application services typically deploy to GKE Autopilot via ArgoCD with Helm + GHCR images (see `~/repos/ForumViriumHelsinki/CLAUDE.md`). That stack is appropriate for production services with secrets, scaling, and observability needs — none of which apply here.

## Decision

Deploy via **GitHub Pages** using the official `actions/deploy-pages` workflow.

- Workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main` and manual `workflow_dispatch`
- Build: `bun install --frozen-lockfile` → `bun run build`
- Artifact: `dist/` uploaded via `actions/upload-pages-artifact`
- Deploy: `actions/deploy-pages@v4`
- Vite `base` is set to `/dev-workflow-overview/` to match the Pages subpath.

## Consequences

**Positive**
- Zero infrastructure to maintain; no Helm chart, no ArgoCD application, no ExternalSecret declarations.
- Deploy time on the order of one minute from push to live.
- Visible URL aligns with the org's GitHub identity (`forumviriumhelsinki.github.io/dev-workflow-overview/`).
- No GHAS / Code Security dependencies (see FVH constraints in `~/repos/ForumViriumHelsinki/CLAUDE.md`).

**Negative**
- Public-only by default; any future need for access control would require migrating off Pages.
- No server-side features (form submissions, dynamic data) without an external backend.
- Custom domain requires DNS work and a `CNAME` file in the artifact.
- GitHub Pages has soft bandwidth and storage limits (100 GB / month, 1 GB site); not a concern at current scale.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| GKE Autopilot + Helm (FVH standard) | Gross overkill for a static page; introduces ops burden and ArgoCD app definition for zero benefit |
| Netlify / Vercel | Requires a separate account/integration outside the GitHub org; no advantage over Pages for a static site |
| Cloud Storage (GCS) bucket + Cloud Load Balancer | Costs money; requires Terraform; not justified for a static doc |

## Evidence

- `.github/workflows/deploy.yml` (commit `15b521c`)
- `vite.config.ts` `base: "/dev-workflow-overview/"` (commit `15b521c`)

---

*Confidence: 9/10. Derived retroactively via `/blueprint:derive-plans` on 2026-04-16.*
