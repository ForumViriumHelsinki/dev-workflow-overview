# ADR-0011: Per-source TTL cache with event-driven invalidation; fail-open-to-grey

## Status

Accepted

## Date

2026-04-16

## Context

The aggregator service (ADR-0006) amplifies one browser viewer into four or more upstream calls per app: ArgoCD, Kubernetes, GitHub (potentially multiple queries), Sentry. Without caching:

- A single viewer reloading the page would hit GitHub 6–10 times per visible stage.
- Ten concurrent viewers of the same app would multiply that by ten.
- NFR3 (≤ 20% of GitHub rate limit at steady state) would be blown through within minutes.

At the same time, status needs to feel *live*. A naïve long TTL would make the dashboard look stale and undermine the product's value proposition.

Different upstream sources have very different change characteristics:

| Source | Change frequency | Cost of a miss | Natural invalidation signal |
|--------|------------------|----------------|-----------------------------|
| ArgoCD sync status | Seconds to minutes during a deploy; rare otherwise | Cheap (in-cluster) | Kubernetes watch on Application CRD |
| Kubernetes Deployment status | Seconds during rollout; rare otherwise | Very cheap | Informer watch |
| GitHub PR / CI status | Minutes; rarely within seconds | Expensive (rate-limited) | Webhooks (future); polling otherwise |
| Release / latest-tag | Hours to days | Expensive | Webhooks (future); polling otherwise |
| Sentry error rate | Seconds during incidents | Moderate | Polling |

## Decision

Adopt a **two-tier cache** with **per-source TTL** and **event-driven invalidation where available**, backed by a **fail-open-to-grey** policy.

### Caching layers

1. **Hot path cache** — in-process `map[string]*AppStatus` keyed by Application name. Atomic read, copy-on-write update. Serves `/status` and the initial `/events` snapshot without any upstream call.
2. **Per-source fetcher caches** — each upstream adapter owns its own cache with a source-appropriate TTL:
   - ArgoCD: no TTL (driven by informer, always fresh)
   - Kubernetes: no TTL (informer)
   - GitHub PR/CI: 30s
   - GitHub releases: 5 min
   - GitHub repo files (runbooks): 10 min
   - Sentry: 60s

### Invalidation

- **Informer-driven** (ArgoCD, Kubernetes): updates to the Application CRD or Deployment object trigger an immediate recompute for that app's entry and emit an SSE `stage-update` event.
- **TTL-driven** (GitHub, Sentry): on expiry, the next read triggers a refresh; concurrent readers coalesce onto a single in-flight request (singleflight pattern).
- **Webhook-driven** (future): GitHub App webhooks (push, pull_request, release, check_run) invalidate the relevant entries in the GitHub fetcher cache and trigger SSE events. Out of v1 scope but cache structure is webhook-ready.

### Rate-limit safety

- GitHub API access uses GraphQL with a single query per app that fetches: default branch HEAD SHA, latest commit, latest N commits, check run statuses, open PRs, latest release, and `release-please` PR state — in one round-trip.
- A global token bucket limits the aggregator to 1000 GitHub requests/hour (20% of the 5000/hr budget per NFR3). Exhaustion is logged and surfaced as a Sentry warning, not an error.
- Sentry calls are capped at 1 request/app/minute regardless of viewer count.

### Fail-open-to-grey

- If any upstream fetch fails (timeout, 5xx, rate-limit), the affected stage returns status `unknown` with an explicit `staleness: "fetch-failed"` flag and the timestamp of the last successful fetch (if any).
- The client renders `unknown` as grey. Stale successful data is **never** rendered as fresh — it may be shown explicitly as "last known: 3 min ago" but with the grey indicator.
- A continuous failure window of >5 minutes for any upstream flips the `/healthz` endpoint to 503 (per PRD-002 FR7.3) and raises a Sentry issue.

## Consequences

**Positive**
- Rate-limit budget comfortably inside NFR3 even with 50 concurrent viewers across 50 apps.
- Sub-second status reads for the steady-state case (all cached).
- Live-feeling updates for the high-change-frequency sources (deploys, pod rollouts) via informers.
- Honest degradation: grey dots and explicit "fetch failed" signal are better for trust than a stale green dot.
- Webhook integration can be added later without changing the cache structure or client contract.

**Negative**
- In-memory cache is per-replica. If we scale to multiple replicas, each holds its own cache and warms separately. Acceptable — one replica is sufficient for v1, and the cache warms in seconds.
- Cold start: the first view of a previously-uncached app hits every upstream source. Mitigated by a startup warmup that prefetches every Application the aggregator can see.
- GitHub GraphQL queries are more complex to author and debug than REST. Acceptable trade-off for the rate-limit win.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Single global TTL (e.g., 60s everywhere) | Wastes freshness on cheap sources (K8s) and still over-calls expensive sources during heavy use |
| Redis-backed shared cache | Adds a dependency for a problem we don't have yet — single replica is plenty for v1 |
| Polling-only (no informers) | Loses the tight ArgoCD/K8s live-update story, which is the best part of the UX |
| Aggressive pre-caching of every repo nightly | Doesn't help during business hours when fresh data matters; just inflates GitHub calls off-hours |
| Never cache; honour every request | Blows NFR3 within a handful of concurrent viewers |
| Serve stale data with warnings instead of grey | Product judgment: grey + explicit "no data" is less misleading than "cached 20 minutes ago" rendered in its natural state |

## Evidence

- GitHub GraphQL rate-limit semantics documented at https://docs.github.com/graphql/overview/resource-limitations
- ArgoCD Application CRD updates are emitted by the Kubernetes API server as standard watch events — no special Integration needed.
- The singleflight pattern is a stable Go idiom (`golang.org/x/sync/singleflight`).

---

*Confidence: 8/10. Authored 2026-04-16 as part of PRD-002 planning. Lower confidence on exact TTL values — they are starting points informed by expected update cadence, to be tuned via NFR2 p95 measurements once deployed.*
