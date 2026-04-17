# ADR-0006: In-cluster aggregator service between the browser and data sources

## Status

Accepted

## Date

2026-04-16

## Context

PRD-002 (`live-deployment-status.md`) requires the browser app to render live status against ArgoCD, the Kubernetes API, the GitHub API, and Sentry. Each of those sources has different authentication, rate-limit, and exposure characteristics:

- **ArgoCD and Kubernetes APIs** are cluster-internal and must not be reachable from the public internet.
- **GitHub API** has a 5000 requests/hour rate limit per installation; fan-out from untrusted browsers would blow through the budget in seconds.
- **Sentry API** credentials are privileged project tokens that must not leave the cluster.
- **CORS** would need to be permissive on every source, which several of them (Kubernetes, ArgoCD) do not offer.

The visualization is meant to be consumed by 5–50 FVH employees at any time, not thousands of anonymous users. The problem is *data aggregation and credential boundary*, not raw scale.

## Decision

Introduce a single-purpose backend service — `status-aggregator` — that:

1. Runs as a Deployment in the same GKE cluster as the workloads it observes.
2. Owns all upstream credentials (GitHub App installation, Sentry project token) and all upstream connections (ArgoCD in-cluster service, Kubernetes API via its own ServiceAccount).
3. Serves both the static Lit bundle and a narrow JSON/SSE API to the browser from the same origin.
4. Enforces a per-app TTL cache in front of every upstream source (see ADR-0011).
5. Is reached by the browser exclusively through Envoy Gateway, gated by Twingate for v1 (ADR-0009).

The browser only ever talks to `status-aggregator`. It has no awareness of GitHub, Sentry, ArgoCD, or Kubernetes URLs, tokens, or schemas.

## Consequences

**Positive**
- Single credential boundary: no tokens ship to browsers; all secrets live in GSM → ESO → Kubernetes Secrets, consistent with the org's established secrets architecture.
- Rate-limit safety: one request/minute/app hitting GitHub regardless of how many viewers are watching.
- CORS and origin concerns collapse to a single same-origin contract.
- Upstream API changes (GitHub deprecations, ArgoCD version bumps) are absorbed in one place without shipping new browser bundles.
- Observability lives in one service — Prometheus metrics, structured logs, Sentry errors — instead of being scattered across five client-side integrations.
- Reuses existing FVH infrastructure patterns: `helm-webapp` chart, ArgoCD-managed deploy, External Secrets, reusable CI workflows.

**Negative**
- Introduces a new service that must be operated, patched, and monitored. Mitigated by using the standard `helm-webapp` chart and the Sentry/log stack every other FVH service already uses.
- Adds one network hop to every live data read. Mitigated by in-cluster ArgoCD/K8s latency (<10ms) and aggressive caching.
- Single point of failure for live mode — if the aggregator is down, no live status is visible. Acceptable because the static view remains available and an outage produces an explicit disconnected state rather than stale data.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Browser calls GitHub/Sentry directly with short-lived tokens | Short-lived tokens for GitHub App installations still leak rate-limit budget per viewer; Sentry tokens aren't scoped finely enough; doesn't solve ArgoCD/K8s which aren't reachable at all |
| Serverless functions per source (Cloud Run) | Multiplies auth surfaces; loses the in-cluster free tier for ArgoCD/K8s calls; adds cold-start latency; harder to coordinate caching |
| Embed status rendering inside ArgoCD's own dashboard | Only covers ArgoCD-owned concerns (sync/health); cannot reach GitHub PR state or Sentry rates; would not preserve the PRD-001 visualization |
| Build a GraphQL gateway in front of everything | Over-engineered for a read-only, narrow surface; the aggregator's API is ~4 endpoints — GraphQL schema and tooling would outweigh the payload surface |
| Static site polls GitHub only; skip live K8s/ArgoCD data | Defeats the "transparency" value proposition; Deploy and Run stages are exactly where live signal matters most |

## Evidence

- PRD-002 §7 (architecture diagram) codifies this shape.
- FVH CLAUDE.md documents the existing GSM → ESO → Kubernetes Secret pattern the aggregator adopts.
- `helm-webapp` chart already handles every operational concern the aggregator needs (Ingress, SSE-compatible probes, ExternalSecret integration).

---

*Confidence: 9/10. Authored 2026-04-16 as part of PRD-002 planning.*
