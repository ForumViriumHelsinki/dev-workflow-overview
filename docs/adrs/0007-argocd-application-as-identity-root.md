# ADR-0007: ArgoCD Application name is the canonical deployment identity

## Status

Accepted

## Date

2026-04-16

## Context

The live-status feature (PRD-002) needs a single identifier in the URL (`?app=<id>`) that unambiguously points at "a service at FVH" and from which every other relevant handle can be derived: GitHub repository, GHCR image, Helm values file, Kubernetes Deployment, Sentry project, etc.

At FVH the candidate identifiers are:

| Candidate | Notes |
|-----------|-------|
| GitHub `owner/repo` | Natural for developers; exists for *every* project, even pre-deploy; but does not encode environment or whether it is actually deployed |
| Kubernetes Deployment name | Exists only for running workloads; one repo may produce multiple Deployments; no canonical reverse-lookup to the repo |
| ArgoCD Application name | Exists 1:1 with a deployed service; already references a source repo + path; already scoped by AppProject |
| Free-form "service name" from an FVH registry | No such registry exists; building one is out of scope |

The ArgoCD Application CRD already encodes, as part of its normal operation:

- The source Git repo and revision (`spec.source.repoURL`, `spec.source.path`)
- The values file (`deploy/values.yaml`) pointing at the image tag, which in turn points at the GHCR repo, which maps 1:1 to the GitHub repo
- The target namespace and cluster (`spec.destination`)
- Ownership via AppProject (`spec.project`)
- Health, sync status, last operation — all data the aggregator needs anyway

## Decision

Use the ArgoCD Application name as the canonical deployment identifier in the live-status feature. URL: `?app=<argocd-application-name>`.

- Primary handle: `?app=fvh-tfds` → `Application{name: fvh-tfds, namespace: argocd}`.
- Fallback handle: `?repo=<owner>/<repo>` → search for an Application whose source URL matches; if exactly one match, redirect to `?app=<name>`; if zero, render a "pre-deploy" view that only populates Build-phase stages.
- Discovery endpoint (`GET /api/v1/apps`) returns the list of Application names the aggregator can see, along with their repo URL and current health, for autocomplete in the UI.

The aggregator performs the ArgoCD lookup once per request, caches the derived handles (repo URL, namespace, image repo, Sentry project inferred from repo topic), and fans out from there to the other sources.

## Consequences

**Positive**
- Exactly one source of truth for "what is this service?". If ArgoCD doesn't know about it, we honestly cannot show a deployed state, and that is the correct answer.
- Reuses existing Application metadata — no new registry or mapping service to maintain.
- AppProject-scoped RBAC (ADR-0009) naturally gates visibility: the aggregator's ServiceAccount only sees Applications in projects it is allowed to read.
- Clean mental model: the URL corresponds to a real, visible object in ArgoCD UI.
- Pre-deploy projects still get a useful (Build-phase-only) view via the `?repo=` fallback.

**Negative**
- Services deployed outside ArgoCD (if any — currently none at FVH) cannot be represented. Documented limitation.
- Multi-environment deployments (e.g., `fvh-tfds-staging` and `fvh-tfds-prod`) become two separate URLs. Tolerable and arguably correct — their states legitimately differ.
- If an Application is renamed in ArgoCD, bookmarked URLs break. Acceptable — renames are rare and already break other things (ArgoCD history, external links).

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| GitHub `owner/repo` as primary | Loses environment distinction; requires building the repo → Application lookup ourselves; weaker visibility story (who can view what?) |
| Composite `?repo=X&env=prod` identifier | Requires a new environment registry; ArgoCD Applications already encode this by their naming convention |
| Kubernetes `namespace/deployment` tuple | Noisy (ReplicaSets, multiple Deployments per service); doesn't reach non-running projects |
| UUID assigned by the aggregator | Adds a stateful component (UUID → handles mapping) for no real benefit over a human-readable name that already exists |

## Evidence

- ArgoCD Application manifests already exist for every deployed FVH service (`infrastructure/argocd/apps/templates/`).
- FVH org CLAUDE.md documents the "multi-source deployment pattern" where each Application points at the app repo's `deploy/values.yaml`.
- AppProject-based RBAC is already in use; this ADR leverages it rather than introducing new access control.

---

*Confidence: 9/10. Authored 2026-04-16 as part of PRD-002 planning.*
