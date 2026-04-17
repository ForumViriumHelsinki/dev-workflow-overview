# PRD-002: Live Deployment Status — Product Requirements Document

**Status:** Proposed
**Created:** 2026-04-16
**Author:** Lauri Gates
**Related:** PRD-001 (`project-overview.md`), ADR-0006..0011

## 1. Problem & Purpose

The existing `dev-workflow-overview` visualization (PRD-001) is *prescriptive*: it describes how services at Forum Virium Helsinki should be built, shipped, and operated. It does not yet describe the current state of any individual service.

Stakeholders, developers, and leadership currently have no single-pane view of where a given service is in its lifecycle: is a release pending? Is the deployment healthy? Are CI gates passing on main? Is Sentry on fire? Answering those questions today requires hopping between GitHub, ArgoCD UI, Sentry, and kubectl.

**Purpose:** Extend the existing static visualization with an optional *live mode* that, given a deployment identifier via the URL (`?app=fvh-tfds`), renders real-time status against each of the 14 lifecycle stages. The component hierarchy, visual grammar, and static landing experience stay intact; live data augments the existing stage cards with status indicators and enriched tooltips.

This turns the diagram from a one-time onboarding poster into a persistent transparency dashboard, and — by honestly rendering stages with missing data as grey "unknown" — it surfaces the org's documentation and automation gaps visually.

## 2. Audience

| Audience | Primary use |
|----------|-------------|
| Technical leadership | At-a-glance health and lifecycle position of every service |
| On-call engineers | Triage entry point: see CI / deploy / monitor status in one place |
| Developers (existing & onboarding) | Understand how their service is progressing through the pipeline right now |
| Stakeholders / partners (behind Twingate) | Visibility into operational posture without granting access to individual tools |

## 3. Functional Requirements

### FR1 — Deployment identity and discovery
- **FR1.1** The app accepts a deployment identifier via the query string: `?app=<argocd-application-name>`.
- **FR1.2** Fallback identifier `?repo=<owner>/<repo>` is supported for projects that exist in GitHub but do not yet have an ArgoCD Application (pre-deploy).
- **FR1.3** The app provides a discovery UI: a combobox listing all ArgoCD Applications the viewer is permitted to see, populated from the aggregator service.
- **FR1.4** The default (no query parameter) view is identical to today's static educational diagram.
- **FR1.5** An invalid or unknown identifier renders a clear "not found" state with a link back to the static view.

### FR2 — Per-stage status indication
- **FR2.1** Each of the 14 `<workflow-stage>` components renders a status dot in addition to its existing content: `ok` (green) / `warn` (amber) / `fail` (red) / `unknown` (grey) / `n/a` (hidden).
- **FR2.2** Status is derived from live data per stage. Mapping from data source to status is defined in §6 below and codified in the aggregator service.
- **FR2.3** Status dots include an accessible label reflecting state (`aria-label="Healthy"` etc.).
- **FR2.4** An overall header badge summarizes the worst-case status across non-`n/a` stages (e.g., `Degraded — Monitor failing`).

### FR3 — Enriched tooltips with live values
- **FR3.1** When a live mode is active, each tooltip shows a "Current state" section at the top containing concrete values for that stage (e.g., ArgoCD sync revision, last release tag, open PR count).
- **FR3.2** Every live value displays a "fetched at" timestamp in UTC, relative age (e.g., "32s ago"), and a deep link to the underlying source (GitHub PR, ArgoCD app, Sentry project).
- **FR3.3** The existing static educational body is preserved below the live section.
- **FR3.4** Stages with no available live data render an explicit "No live data available" note plus the existing educational content — they must never render stale values as fresh.

### FR4 — Real-time updates
- **FR4.1** The page subscribes to a server-sent events stream scoped to the requested deployment; on each event, affected stages re-render without a full page reload.
- **FR4.2** A visible "Connected · last update 12s ago" indicator reflects stream health. On disconnect, the client attempts reconnection with exponential backoff and shows a clear disconnected state.
- **FR4.3** An explicit "Refresh" button forces a resync and bypasses the server-side cache for that one request (rate-limited).

### FR5 — Aggregator service
- **FR5.1** A dedicated backend service (`status-aggregator`) is deployed in the same GKE cluster as the applications it observes.
- **FR5.2** The service exposes a minimal HTTP API (see §6) authenticated by origin (same-cluster, Envoy Gateway).
- **FR5.3** The service fans out to ArgoCD, the Kubernetes API, the GitHub API, and the Sentry API; credentials live in Kubernetes Secrets sourced from Google Secret Manager via External Secrets Operator.
- **FR5.4** Responses are cached per-application with a short TTL (default 30s, per-source overrides). The cache is in-memory; no Redis dependency.
- **FR5.5** GitHub API access uses a GitHub App installation token with per-app GraphQL queries that coalesce multi-stage lookups into one round-trip.
- **FR5.6** The service emits Prometheus metrics: cache hit rate, upstream latency per source, error rate per source, SSE connection count.

### FR6 — Access control
- **FR6.1** The live status view and the aggregator API are exposed only through the FVH Twingate network for v1.
- **FR6.2** The aggregator service does not enforce per-user authorization in v1; it trusts the Twingate perimeter. Per-user authz (OneLogin SSO) is deferred to a follow-up (see Open Questions).
- **FR6.3** ArgoCD read permissions are granted to the service via an AppProject role; the service may only *read* Applications and Projects, never mutate.
- **FR6.4** Kubernetes RBAC is minimal: `get`/`list`/`watch` on `deployments`, `pods`, `replicasets`, and `events` cluster-wide (or per-namespace — see ADR-0009). No `secrets` access.

### FR7 — Observability of the aggregator itself
- **FR7.1** Structured JSON logs for every upstream call (source, duration, status, cache-hit).
- **FR7.2** Sentry integration for the aggregator service — errors on the status dashboard must themselves surface in Sentry like any other FVH service.
- **FR7.3** Health endpoint `/healthz` that returns `503` if any upstream has been failing continuously for >5 minutes, else `200`.

### FR8 — Static mode preserved
- **FR8.1** Loading `/` with no query parameter renders the existing static visualization byte-identically to today's build — no aggregator calls, no SSE connection.
- **FR8.2** Live-mode adds an "Exit live view" action that returns the user to the static diagram.

## 4. Non-functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Live status first paint ≤ 1s on warm cache; ≤ 3s on cold cache |
| NFR2 | Status updates propagate from source change to browser within 60s p95 (bounded by cache TTL and SSE fan-out latency) |
| NFR3 | GitHub API consumption stays under 20% of the installation's hourly rate-limit budget at steady state (one concurrent viewer per app) |
| NFR4 | Aggregator service runs in <256Mi memory and <200m CPU at steady state for up to 50 tracked applications |
| NFR5 | No secrets, tokens, or cluster-internal URLs are present in any client-delivered asset |
| NFR6 | Accessibility: status indicators must not rely on colour alone (paired text label and ARIA attributes) |
| NFR7 | Live mode must degrade gracefully to static mode if the aggregator service is unreachable (show a banner, render grey dots) |

## 5. Out of Scope

- Write operations (triggering deploys, rolling back, closing PRs from the UI) — read-only v1
- Per-user RBAC; all viewers with Twingate access see the same data
- Historical/time-series status (sparklines, uptime %, etc.) — current state only
- Multi-cluster support — single GKE cluster only
- Mobile-first layout — responsive rendering works but desktop is primary
- Alerting or notification features — the dashboard is passive
- Localization — English only (matches PRD-001)

## 6. Data Source Mapping

Each stage derives status from one or more upstream data sources. The aggregator service owns this mapping; clients do not consult sources directly.

| # | Stage | Source(s) | Status rule |
|---|---|---|---|
| 1 | Inception | GitHub issues (labels `project:*`) | `ok` if at least one active issue in last 90d; `unknown` otherwise |
| 2 | Provision | ArgoCD Application existence + `status.conditions` | `ok` if Application exists and has no `*Error` conditions |
| 3 | Develop | GitHub — commits on default branch last 30d | `ok` ≥1 commit/7d; `warn` last commit 7–30d; `fail` >30d; `unknown` no data |
| 4 | Commit & Push | GitHub — most recent commit conventional-format compliance | `ok` if last 10 commits match `type(scope): desc`; `warn` otherwise |
| 5 | AI Review | GitHub — `claude[bot]` review on latest open PR | `ok` approved; `warn` changes requested; `n/a` no open PR |
| 6 | CI Gates | GitHub Checks API on default-branch HEAD | `ok` all required checks green; `fail` any required check red |
| 7 | Release | `release-please` PR state + latest release | `ok` latest release < 30d; `warn` release PR open >7d |
| 8 | Deploy | ArgoCD `status.sync.status` + `status.health.status` | `ok` Synced+Healthy; `warn` OutOfSync; `fail` Degraded/Missing |
| 9 | Run | K8s Deployment `.status.readyReplicas/.spec.replicas` | `ok` readyReplicas == spec.replicas; `warn` partial; `fail` zero |
| 10 | Operate | Repo file presence: `docs/RUNBOOK.md` / `docs/runbooks/` | `ok` present; `unknown` absent (honest doc-gap signal) |
| 11 | Monitor | Sentry — unresolved issues + event rate last 24h | `ok` no new unresolved; `warn` 1–10; `fail` >10 or >2× 7d baseline |
| 12 | Evolve | GitHub — issues labelled `migration`, `breaking-change` | `ok` count 0; `warn` ≥1 open |
| 13 | Deprecate | Annotation `fvh.deprecated-on` on Application or repo topic `deprecated` | `n/a` by default; `warn` when set; counts down to sunset date |
| 14 | Decommission | Application `deletionTimestamp` / GitHub repo `archived` | `n/a` unless in progress; `ok` when both complete |

Full JSON schema for the per-stage payload is specified in PRP-002.

## 7. Architecture Summary

```
Browser (Lit app, served statically from the aggregator)
  │  GET /api/v1/apps                     (list)
  │  GET /api/v1/apps/:name/status        (snapshot)
  │  GET /api/v1/apps/:name/events (SSE)  (stream)
  ▼
Aggregator service (Go, one Deployment in-cluster)
  ├── ArgoCD API     (in-cluster gRPC/REST via ServiceAccount token)
  ├── Kubernetes API (in-cluster, RBAC-scoped)
  ├── GitHub API     (App installation token, GraphQL batched)
  └── Sentry API     (project-scoped token)
```

Key decisions captured as ADRs:

- ADR-0006: Aggregator service pattern (vs. direct browser calls)
- ADR-0007: ArgoCD Application as the identity root
- ADR-0008: SSE over WebSockets for push updates
- ADR-0009: Twingate-gated access for v1
- ADR-0010: Go for the aggregator service
- ADR-0011: Cache layering and rate-limit strategy

## 8. Open Questions / Future Considerations

- **Per-user authorization.** v1 trusts the Twingate perimeter. A follow-up should layer OneLogin SSO + AppProject-scoped viewing once the dashboard graduates to broader use.
- **Public read-only view.** Stakeholder-facing sanitized mode (opaque stage names, red/amber/green only) is attractive but needs explicit review of what is safe to reveal externally.
- **Write actions.** "Retry deploy", "requeue image update", "resolve Sentry issue" are natural next steps but expand the threat model significantly; intentionally deferred.
- **Historical state.** Sparklines ("healthy 29 of last 30 days") would require a time-series store; scope creep for v1.
- **Multi-tenancy.** If used beyond FVH org, data-source adapters and identity resolution need to become pluggable.

## 9. Success Signals

| Signal | How measured |
|--------|--------------|
| Adoption | ≥50% of active FVH services viewed via `?app=` in any given week by ≥3 distinct viewers |
| Incident triage acceleration | On-call reports using the dashboard as the first stop in ≥50% of incidents |
| Documentation gap closure | Grey "unknown" Operate/Monitor dots decrease over two quarters as runbooks/alerts get authored |
| Stability | Aggregator service ≥ 99.5% availability over any 30-day window |
| Performance | NFR1–NFR4 continuously met |

---

*Authored 2026-04-16. Skips MVP per project direction; targets full-stack delivery in one planned effort. See PRP-002 for the implementation plan.*
