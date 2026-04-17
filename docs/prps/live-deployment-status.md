# PRP-002: Live Deployment Status — Implementation Plan

**Status:** Proposed
**Created:** 2026-04-16
**Source PRD:** [`docs/prds/live-deployment-status.md`](../prds/live-deployment-status.md)
**Related ADRs:** 0006, 0007, 0008, 0009, 0010, 0011
**Scope:** Full implementation — no MVP slice. Ship frontend + aggregator service + deployment together.

## 1. Overview

This PRP operationalizes PRD-002. It describes the entire system end-to-end:

- A new backend service (`status-aggregator`, Go, in-cluster) that fans out to ArgoCD, Kubernetes, GitHub, and Sentry and serves a narrow JSON + SSE API.
- Frontend changes to the existing Lit app to consume the aggregator, render status dots, and enrich tooltips.
- Packaging, deployment, and operational plumbing using FVH's standard `helm-webapp` chart, ArgoCD Application manifest, and External Secrets.

The plan is organized into work streams; within each stream, steps are sequenced by dependency. Streams themselves may proceed in parallel once their prerequisites are met.

## 2. Architecture Recap

```
                                 ┌──────────────────────────────────────┐
                                 │ GKE cluster                          │
                                 │                                      │
Browser (Lit) ──► Envoy Gateway ─┼─► status-aggregator (Deployment)     │
   ▲   ▲                         │        │                             │
   │   └── SSE ──────────────────┼────────┘                             │
   │                             │        ├── ArgoCD API (in-cluster)   │
   │                             │        ├── K8s API (in-cluster, RBAC)│
   │                             │        ├── GitHub API (App install)  │
   │                             │        └── Sentry API                │
   │                             │                                      │
   │                             │  ExternalSecret ── GSM               │
   └──────── Twingate ───────────┘                                      │
                                 └──────────────────────────────────────┘
```

## 3. Repository Structure Changes

```
dev-workflow-overview/
├── src/                       # existing Lit frontend
│   ├── data/
│   │   └── stages.ts          # +StageStatus type, +mapping helpers
│   ├── services/              # NEW
│   │   ├── status-client.ts   # fetch + SSE wrapper
│   │   └── types.ts           # TS types generated from OpenAPI
│   ├── components/
│   │   ├── workflow-app.ts    # wires live mode; URL parsing
│   │   ├── workflow-stage.ts  # +status dot
│   │   ├── workflow-tooltip.ts# +live-values section
│   │   ├── status-banner.ts   # NEW — header summary + connection state
│   │   └── app-switcher.ts    # NEW — combobox of known apps
│   └── styles/theme.ts        # +status colour tokens
├── aggregator/                # NEW — Go service
│   ├── cmd/aggregator/main.go
│   ├── internal/
│   │   ├── api/               # HTTP handlers + SSE hub
│   │   ├── cache/             # two-tier cache + singleflight
│   │   ├── sources/
│   │   │   ├── argocd/
│   │   │   ├── kubernetes/
│   │   │   ├── github/
│   │   │   └── sentry/
│   │   ├── domain/            # Stage, AppStatus, StatusCode
│   │   └── observability/     # metrics, logs, sentry
│   ├── api/openapi.yaml       # source of truth for client types
│   ├── Dockerfile
│   ├── go.mod
│   └── README.md
├── deploy/
│   ├── values.yaml            # helm-webapp values (REPLACES static-only deploy)
│   └── service-monitor.yaml   # Prometheus scrape
└── docs/
    ├── prds/live-deployment-status.md
    ├── adrs/0006–0011
    └── prps/live-deployment-status.md  # this file
```

Note: the existing GitHub Pages deploy path (`.github/workflows/deploy.yml`) is retained as a secondary distribution so the static landing experience survives independently of the aggregator.

## 4. Aggregator Service

### 4.1 API Surface

All routes are prefixed `/api/v1`. OpenAPI 3.1 spec at `aggregator/api/openapi.yaml`; TypeScript types for the frontend are generated from it at build time.

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/apps` | List known Applications + current overall status (cached) |
| `GET` | `/apps/:name/status` | Full snapshot for one Application |
| `GET` | `/apps/:name/events` | SSE stream (snapshot on connect, partial updates thereafter) |
| `POST`| `/apps/:name/refresh` | Force cache bypass on next read; rate-limited to 1/30s/app |
| `GET` | `/healthz` | 200 OK unless an upstream has been down >5m |
| `GET` | `/metrics` | Prometheus metrics |

### 4.2 Response schema (snapshot)

```json
{
  "app": "fvh-tfds",
  "source": {
    "repo": "ForumViriumHelsinki/tfds",
    "namespace": "tfds",
    "argocdProject": "apps",
    "sentryProject": "tfds"
  },
  "overall": {
    "status": "ok",
    "summary": "Running · Healthy"
  },
  "stages": [
    {
      "id": 8,
      "title": "Deploy",
      "status": "ok",
      "summary": "Synced · Healthy",
      "details": {
        "syncRevision": "abc123f",
        "syncedAt": "2026-04-16T09:30:12Z",
        "health": "Healthy"
      },
      "links": [
        { "label": "ArgoCD", "href": "https://argocd.../applications/fvh-tfds" }
      ],
      "fetchedAt": "2026-04-16T09:30:17Z",
      "staleness": "fresh"
    }
  ]
}
```

`status`: `ok` | `warn` | `fail` | `unknown` | `n/a`.
`staleness`: `fresh` | `cached` | `stale` | `fetch-failed`.

### 4.3 Source adapters

Each adapter implements:

```go
type Source interface {
    Name() string
    Fetch(ctx context.Context, ref AppRef) (StageUpdates, error)
    Watch(ctx context.Context, ref AppRef, ch chan<- StageUpdate) error // optional
}
```

Adapter responsibilities:

- **argocd**: resolve Application → source repo + namespace + sentry project (via label `fvh.io/sentry-project` on the Application, falling back to repo name). Populate stages 2 (Provision), 8 (Deploy). Uses Kubernetes watch on `applications.argoproj.io` CRD.
- **kubernetes**: shared informer on Deployments + Pods in the target namespace. Populates stage 9 (Run).
- **github**: per-app GraphQL query (single round-trip) populating stages 1, 3, 4, 5, 6, 7, 10, 12, 14.
- **sentry**: REST wrapper populating stage 11 (Monitor). Maps event rate + unresolved count → status.

### 4.4 Cache and concurrency

Implementation per ADR-0011:

- `cache.Hot` — `sync.Map` keyed by app name, holds the current `AppStatus`.
- `cache.Fetcher` — per source, per key TTL cache with `singleflight.Group`.
- Informer updates call back into `cache.Hot`, produce a diff, and fan out SSE events to subscribers of that app.

SSE hub (`api/sse.go`):

- One goroutine per connection.
- Broadcast via a buffered channel per app; slow consumers are dropped after a 256-message buffer fills, with a warning log. Client auto-reconnects and re-syncs.

### 4.5 Config (env vars)

| Variable | Purpose |
|----------|---------|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_INSTALLATION_ID` | Installation ID for the FVH org |
| `GITHUB_APP_PRIVATE_KEY` | Private key (from ExternalSecret) |
| `SENTRY_API_TOKEN` | Sentry auth token (from ExternalSecret) |
| `SENTRY_ORG_SLUG` | FVH Sentry org slug |
| `ARGOCD_SERVER` | Defaults to `argocd-server.argocd.svc:443` |
| `KUBECONFIG` | Empty — uses in-cluster config |
| `APPPROJECTS_ALLOWED` | Comma-separated list of AppProjects the aggregator may read; empty = all it has RBAC for |
| `LOG_LEVEL` | `info` / `debug` |
| `SENTRY_DSN` | For the aggregator's own error reporting |
| `GOFF_CLIENT_ID` | For future feature flags (not used in v1) |

### 4.6 Observability

- **Metrics** (Prometheus):
  - `aggregator_upstream_request_duration_seconds{source,status}` histogram
  - `aggregator_cache_events_total{source,result}` counter (`hit`|`miss`|`expired`|`failed`)
  - `aggregator_sse_connections` gauge
  - `aggregator_github_ratelimit_remaining` gauge
- **Logs**: structured JSON; fields `app`, `source`, `duration_ms`, `status`, `cache`.
- **Sentry**: aggregator errors are sent to a dedicated Sentry project `status-aggregator`.
- **Tracing**: OpenTelemetry hooks wired but disabled by default; enabled via `OTEL_EXPORTER_OTLP_ENDPOINT`.

### 4.7 Testing strategy

- Adapter unit tests: table-driven, with `httptest` servers for GitHub and Sentry; `fake.NewSimpleClientset` for Kubernetes; recorded fixtures for ArgoCD.
- API handler tests: in-process HTTP + SSE.
- Cache tests: concurrency harness hammering singleflight coalescing.
- Integration tests: a `kind` cluster, a mock GitHub API, a mock Sentry API; verify status mapping end-to-end.
- Load test: 100 concurrent SSE connections for 10 minutes, monitor memory + goroutine leaks.

## 5. Frontend Changes

### 5.1 URL handling (`workflow-app.ts`)

- On connected, parse `?app=` / `?repo=` from `window.location.search`.
- If neither present → static mode (today's behaviour).
- If `?app=` present → enter live mode, instantiate the status client, open SSE stream.
- If `?repo=` present → call `/api/v1/apps?repo=<value>`; on exactly-one-match, rewrite URL to `?app=<name>`; otherwise render a pre-deploy view with Build-phase-only stages populated.

### 5.2 New services

`src/services/status-client.ts` — a small class wrapping:

```ts
class StatusClient {
  async list(): Promise<AppSummary[]>
  async snapshot(app: string): Promise<AppStatus>
  subscribe(app: string, handlers: {
    onSnapshot(s: AppStatus): void
    onStageUpdate(u: StageUpdate): void
    onConnectionChange(state: 'connecting' | 'open' | 'closed'): void
  }): () => void // returns unsubscribe
}
```

Implementation details:
- `EventSource` with automatic reconnect + `Last-Event-ID` resume.
- Exponential backoff with jitter on fatal reconnects.
- Types imported from `src/services/types.ts` (generated from `aggregator/api/openapi.yaml` via `openapi-typescript`).

### 5.3 Component updates

- `workflow-stage.ts`: add optional `status` property (`'ok' | 'warn' | 'fail' | 'unknown' | 'n/a' | undefined`); render a status dot in the header with `aria-label`. Undefined renders no dot (static mode).
- `workflow-tooltip.ts`: when the active tooltip's stage has live data, render a "Current state" block above the existing body, including the "fetched Xs ago" relative time, deep links, and an explicit "No live data available" state when `status === 'unknown'` and details are absent.
- `workflow-app.ts`: when in live mode, receive snapshot + stage-update events from the status client and pipe status into the matching stage component by `number`.

### 5.4 New components

- `<status-banner>` — header-area component showing the app name, overall summary, connection state ("Connected · updated 2s ago" / "Reconnecting…"), refresh button, and "Exit live view" link.
- `<app-switcher>` — combobox listing Applications from `GET /api/v1/apps`, allowing the viewer to jump between services.

### 5.5 Theme additions (`styles/theme.ts`)

- Add tokens: `--status-ok`, `--status-warn`, `--status-fail`, `--status-unknown` (consistent with existing badge tokens but distinct hues).
- Add `--status-dot-size` (10px) and `--status-dot-ring` utilities.

### 5.6 Build-time type sync

- Add an `openapi:types` npm script that runs `openapi-typescript aggregator/api/openapi.yaml -o src/services/types.ts`.
- Wire into `prebuild` so `bun run build` regenerates types from the spec.
- Generated file is committed to guarantee reproducible builds without Go toolchain.

### 5.7 Tests (frontend)

PRD-002 is the moment to introduce the test harness that has been deferred until now (per `project-overview.md` §7):

- Add Vitest + `@open-wc/testing` dev deps.
- Unit tests for `status-client.ts` (SSE parsing, reconnection).
- Component tests for `workflow-stage` status-dot rendering.
- Playwright smoke test: load with `?app=fake`, mock SSE, assert status dot colours match a fixture.

## 6. Deployment

### 6.1 Helm values (`deploy/values.yaml`)

Uses the org `helm-webapp` chart. Key values:

```yaml
image:
  repository: ghcr.io/forumviriumhelsinki/status-aggregator
  tag: # set by Image Updater

service:
  port: 8080
  sessionAffinity: None   # SSE works without sticky sessions (ADR-0008)

ingress:
  enabled: true
  className: envoy-gateway-internal   # Twingate-gated route
  hosts:
    - host: dev-overview.fvh.internal
      paths: [{ path: /, pathType: Prefix }]

externalSecret:
  enabled: true
  name: status-aggregator
  data:
    - secretKey: GITHUB_APP_PRIVATE_KEY
      remoteRef: { key: status-aggregator-github-app-private-key }
    - secretKey: SENTRY_API_TOKEN
      remoteRef: { key: status-aggregator-sentry-api-token }

serviceAccount:
  create: true
  name: status-aggregator

rbac:
  # consumed by a custom template in this chart version — verify during integration
  rules:
    - apiGroups: ["apps"]
      resources: ["deployments", "replicasets"]
      verbs: ["get", "list", "watch"]
    - apiGroups: [""]
      resources: ["pods", "events"]
      verbs: ["get", "list", "watch"]
    - apiGroups: ["argoproj.io"]
      resources: ["applications", "appprojects"]
      verbs: ["get", "list", "watch"]

resources:
  requests: { cpu: 50m, memory: 128Mi }
  limits:   { cpu: 500m, memory: 512Mi }

readinessProbe: { httpGet: { path: /healthz, port: 8080 } }
livenessProbe:  { httpGet: { path: /healthz, port: 8080 } }

serviceMonitor:
  enabled: true
  path: /metrics

featureFlags:
  enabled: true   # inject GOFF endpoint for future use
```

### 6.2 ArgoCD Application manifest

Add to `infrastructure/argocd/apps/templates/platform-automation/dev-workflow-overview.yaml`:

- Multi-source: `helm-webapp` chart from GHCR + values from this repo's `deploy/values.yaml`.
- AppProject: `platform-automation` (per `project:platform-automation` label convention in FVH org CLAUDE.md).
- Image Updater annotations mirroring the standard pattern.

### 6.3 Terraform changes

Coordinated PRs against `infrastructure/`:

1. **GitHub App**: create "FVH Status Aggregator" App with read-only permissions on Actions, Checks, Contents, Issues, Metadata, Pull Requests. Install it on the ForumViriumHelsinki org. Store App ID + private key in GSM.
2. **Sentry**: provision an internal integration token with `project:read` and `event:read`. Store in GSM.
3. **ArgoCD AppProject**: grant the `status-aggregator` ServiceAccount a read-only role spanning the AppProjects the aggregator should observe.
4. **DNS**: `dev-overview.fvh.internal` CNAME to the internal Envoy Gateway.
5. **Twingate**: add the new internal hostname to the appropriate resource group.
6. **GitHub labels**: no new labels needed; existing `project:*` labels are already Terraform-managed.

### 6.4 CI/CD

- Reuse the org `reusable-container-build.yml` workflow for the Go service (build, scan with Trivy per FVH constraint — no SARIF upload).
- `release-please` configuration to produce conventional-commit-driven tags scoped per component (`aggregator-v*`, `web-v*`) or a single project version (prefer single version for simplicity in v1).
- The existing `.github/workflows/deploy.yml` (GitHub Pages) continues to publish the static bundle; when live mode is used, the bundle is served from the aggregator itself.

## 7. Work Streams and Ordering

Streams run in parallel once `S1` is complete.

**S1 — Foundations (prerequisite for everything else)**
1. Author `aggregator/api/openapi.yaml` (the contract everything else derives from).
2. Generate TypeScript types; commit them.
3. Scaffold Go module, Dockerfile, base CI.

**S2 — Aggregator core**
1. Domain model + in-memory cache + singleflight.
2. SSE hub + HTTP handlers (against a fake source).
3. ArgoCD adapter + Kubernetes informer.
4. GitHub adapter (GraphQL).
5. Sentry adapter.
6. Observability: metrics, structured logs, Sentry integration, healthz.
7. Integration tests (kind + mocks).

**S3 — Frontend**
1. Status client + types wiring.
2. `<workflow-stage>` status dot + theme tokens.
3. `<workflow-tooltip>` live-values section.
4. `<status-banner>` + `<app-switcher>`.
5. Live-mode wiring in `workflow-app`.
6. Test harness introduction (Vitest + @open-wc/testing + Playwright).

**S4 — Deployment**
1. Terraform PRs: GitHub App, Sentry token, AppProject role, DNS, Twingate.
2. `deploy/values.yaml`.
3. ArgoCD Application manifest PR in `infrastructure/`.
4. End-to-end smoke in cluster against one real Application.

**S5 — Rollout & docs**
1. Enable for a curated list of Applications (AppProjects `platform-automation`, `reusable-workflows` first).
2. Internal launch email + updated README.
3. Add `docs/adrs/README.md` to include 0006–0011.
4. Update `docs/prds/project-overview.md` to reference PRD-002 from the Open Questions section.

## 8. Follow-up Work (Post-Launch, Tracked as Issues)

Each item below will be opened as a separate GitHub issue per the FVH CLAUDE.md rule on post-merge follow-ups:

1. GitHub App webhooks → cache invalidation (remove TTL polling for push/PR/release).
2. OneLogin SSO via Envoy Gateway OIDC filter.
3. Per-user AppProject-scoped visibility.
4. Public, sanitized read-only variant.
5. Historical state (time-series) for healthy-percentage sparklines.
6. Write actions (retry deploy, resolve Sentry issue) — requires threat-model review first.
7. Multi-cluster support.
8. Mobile layout polish.

## 9. Acceptance Criteria (PRD-002 → PRP-002 mapping)

| PRD req | Acceptance check |
|---------|------------------|
| FR1.1/1.2 | `?app=` and `?repo=` routes resolve in Playwright test |
| FR1.3 | `<app-switcher>` populates from `/apps` |
| FR1.4 | Root URL (no query) renders byte-identical bundle to static build hash |
| FR2.1–2.4 | Stage status dots render for each of 14 stages; overall badge summary derived correctly |
| FR3.1–3.4 | Tooltip shows "Current state" block with `fetched Xs ago`, deep links, and "No live data" empty state |
| FR4.1–4.3 | SSE reconnect behaves correctly under network interruption; manual refresh is rate-limited |
| FR5.1–5.6 | Integration tests cover all four adapters; Prometheus metrics emitted |
| FR6.1–6.4 | Envoy Gateway route is Twingate-only; RBAC manifests match the declared minimum |
| FR7.1–7.3 | Structured logs + Sentry issues on upstream failures; `/healthz` flips to 503 correctly |
| FR8.1–8.2 | Static mode works with aggregator entirely offline |
| NFR1–NFR7 | Load test fixture asserts first-paint latency, memory footprint, and no-secret-in-asset invariants |

## 10. Risks

| Risk | Mitigation |
|------|------------|
| GitHub GraphQL query drift (schema changes break status mapping) | Pin schema fetch to CI, regenerate client, caught by integration test |
| ArgoCD Go client API instability | Pin to a known-good version; cover with integration test that uses the real CRD via kind |
| SSE breakage through a future Envoy Gateway config | Contract test in staging verifies `text/event-stream` passthrough |
| Aggregator OOM under unexpected scale | Informer buffer sizing + SSE slow-consumer drop; Prometheus alert on memory |
| Terraform/manifest drift between repos | Single-PR-per-change with explicit cross-repo references in descriptions; use conventional-commit scopes `(aggregator)` and `(infra)` |
| Browser-side stale types (OpenAPI drift) | `bun run build` regenerates types; CI fails on uncommitted diff |

## 11. Definition of Done

- All acceptance checks in §9 pass.
- Aggregator deployed via ArgoCD to production cluster, reachable at `dev-overview.fvh.internal`.
- Dashboard renders correct live status for at least 5 real FVH Applications end-to-end.
- Runbook committed at `docs/runbooks/status-aggregator.md` (because the aggregator itself is now an operated service and must close its own doc-gap).
- Follow-up issues in §8 filed and linked.
- Static GitHub Pages deploy still green.

---

*Authored 2026-04-16 as the implementation plan for PRD-002. Full-stack scope — no MVP cut. Confidence 7/10: bulk of risk is in the integration points (ArgoCD client, GitHub App install, Envoy Gateway SSE), all of which are mitigated by integration tests and a kind-based smoke harness.*
