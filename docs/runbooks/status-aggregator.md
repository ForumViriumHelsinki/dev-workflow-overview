# Runbook: status-aggregator

Operational guide for the `status-aggregator` Go service that powers
the live-mode view of `dev-workflow-overview`. This runbook closes
stage 10 (Operate) for the aggregator itself — see PRP-002 §11.

## Overview

The aggregator is a single stateless Go Deployment in the same GKE
cluster as the applications it observes. It fans out to four
upstreams (ArgoCD, Kubernetes API, GitHub, Sentry), serves a narrow
HTTP + SSE API, and is reachable only through the internal Envoy
Gateway behind Twingate (ADR-0009).

- **Namespace:** `status-aggregator`
- **ArgoCD Application:** `dev-workflow-overview` (AppProject
  `platform-automation`)
- **Hostname:** `dev-overview.fvh.internal`
- **Source repo:** [dev-workflow-overview](https://github.com/ForumViriumHelsinki/dev-workflow-overview)
- **On-call project:** `status-aggregator` Sentry project

## Healthy indicators

| Signal | Healthy |
|--------|---------|
| `kubectl get deploy -n status-aggregator status-aggregator` | 1/1 ready |
| `curl https://dev-overview.fvh.internal/healthz` (via Twingate) | 200 + `status: ok` |
| `aggregator_github_ratelimit_remaining` | > 4000/5000 |
| `aggregator_upstream_request_duration_seconds` p95 | < 2s |
| `aggregator_sse_connections` | ≤ 100 typical |

## Common failure modes

### 1. `/healthz` returns 503

`/healthz` flips to 503 when an upstream has been failing for > 5
minutes (PRD-002 FR7.3). Inspect `upstreams[*].status` in the body:

```bash
kubectl port-forward -n status-aggregator svc/status-aggregator 8080:8080
curl -s localhost:8080/healthz | jq .upstreams
```

The failing upstream name is the next lookup target. Pods stay
running; liveness probes only fail once consecutive failures exceed
the liveness threshold, so a 503 does not by itself trigger a restart.

### 2. GitHub rate-limit exhaustion

Symptom: `aggregator_github_ratelimit_remaining` < 500.

Cause: too many cold-cache reads, or the installation's private key
is in a stale rotation. Remediate by:

1. Confirming the cache TTL is the documented 120s for GitHub.
2. Restarting the Deployment: `kubectl rollout restart -n status-aggregator deploy/status-aggregator`.
3. If remaining stays low, rotate the App private key — see §5 below.

### 3. SSE clients dropping

Symptom: Log lines `dropping slow SSE subscriber`, front-end shows
"Reconnecting…" repeatedly.

Cause: a viewer is on a very slow link, or the Envoy Gateway route
has been reconfigured and is buffering responses. The aggregator drops
its own slow consumers after 256 buffered events; clients auto-reconnect
and re-sync. If the drop rate is high across all viewers, the
Gateway's `proxy-buffering` annotation has regressed — reapply
`deploy/values.yaml`.

### 4. ArgoCD Application watch stuck

Symptom: Deploy-stage status in the dashboard does not update after an
ArgoCD sync completes.

Remediate by restarting the aggregator (its informer resyncs on
startup). If the problem recurs on every restart, check the
`status-aggregator` ServiceAccount's AppProject role — a permission
regression in the infrastructure repo is the most common cause.

### 5. Sentry 401/403

Symptom: Monitor stage stuck on `unknown` with logs referencing
`sentry: status 401`.

Remediate by checking the ExternalSecret refresh:

```bash
kubectl get externalsecret -n status-aggregator status-aggregator
```

If the token has rotated in GCP Secret Manager and the ExternalSecret
has synced, restart the Deployment to pick up the new value.

## Rollback

The aggregator ships as ordinary container images. Rollback by
setting `image.tag` in `deploy/values.yaml` to the previous semver tag
and letting ArgoCD sync. Image Updater will re-bump on the next
release; the rollback is therefore always a temporary measure, not a
permanent pin.

## Scaling

- **Vertical first:** raise `resources.limits.memory` to 1Gi if the
  process approaches the current 512Mi cap under peak SSE load.
- **Horizontal with caution:** SSE breaks across replicas without a
  pub/sub hub; v1 targets one replica. If a second replica is
  required, route all browsers to a single pod via session affinity
  or introduce NATS — out of scope for v1.

## Observability

- **Dashboards:** Prometheus via the `aggregator_*` metrics; Grafana
  dashboard `Status Aggregator` (uid `fvh-status-agg`).
- **Logs:** `kubectl logs -n status-aggregator deploy/status-aggregator`
  (structured JSON).
- **Error tracking:** Sentry project `status-aggregator`.

## Secrets rotation

| Secret | Source | Rotation |
|--------|--------|----------|
| GitHub App private key | GCP Secret Manager `status-aggregator-github-app-private-key` | Every 12 months or on compromise |
| Sentry API token | GCP Secret Manager `status-aggregator-sentry-api-token` | Every 12 months |
| Sentry DSN | GCP Secret Manager `status-aggregator-sentry-dsn` | Only on Sentry project recreation |

All rotations propagate via External Secrets Operator on the next
`refreshInterval` window (1h). For immediate propagation:

```bash
kubectl annotate externalsecret -n status-aggregator status-aggregator \
    force-sync=$(date +%s) --overwrite
kubectl rollout restart -n status-aggregator deploy/status-aggregator
```

## Fail-open behaviour

The aggregator is intentionally fail-open: a dead upstream yields
`staleness: fetch-failed` stages (grey dots on the frontend) rather
than a hard error response. The dashboard remains available even when
GitHub or Sentry is fully down. Do not "fix" grey dots by making the
upstream call mandatory — the doc-gap / outage signal is the feature.

## See also

- [PRD-002](../prds/live-deployment-status.md) — requirements
- [PRP-002](../prps/live-deployment-status.md) — implementation plan
- [ADR-0006..0011](../adrs/README.md) — architecture decisions
