# ADR-0010: Go for the status-aggregator service

## Status

Accepted

## Date

2026-04-16

## Context

The aggregator service (ADR-0006) fans out to ArgoCD, the Kubernetes API, GitHub, and Sentry, holds long-lived SSE connections, maintains per-app in-memory caches, and watches cluster events for cache invalidation. It is a small service with strict requirements:

- Native, high-quality clients for Kubernetes and ArgoCD.
- Low memory / CPU footprint (NFR4: <256Mi / <200m).
- Comfortable with concurrent I/O — hundreds of SSE connections, dozens of background watchers.
- Long-running, tight loop; minimal cold-start concerns.
- A language the FVH team can maintain.

Candidate implementation languages:

| Language | Notes |
|----------|-------|
| Go | First-class K8s and ArgoCD client libraries (`client-go`, `argo-cd/pkg/apiclient`); excellent concurrency primitives; small binary; cheap memory; Kubernetes operators and controllers are routinely written in Go at FVH |
| Python | Familiar to FVH team; good GitHub SDK; Kubernetes client exists but is second-tier; async Python (`asyncio`) works but the ArgoCD story is manual-HTTP; larger runtime footprint |
| TypeScript / Node | Reasonable SDK coverage; shares language with the frontend; Node SSE is well-trodden; Kubernetes and ArgoCD clients are acceptable but less maintained than Go's |

## Decision

Implement `status-aggregator` in Go.

- Framework: standard library `net/http` + [chi](https://github.com/go-chi/chi) for routing. Keep the server minimal.
- Kubernetes client: upstream `k8s.io/client-go` with shared informers for Deployment/Pod watches.
- ArgoCD client: `github.com/argoproj/argo-cd/v2/pkg/apiclient` in-cluster.
- GitHub client: [`go-github`](https://github.com/google/go-github) via `githubv4` for GraphQL batching, authenticating through a GitHub App installation (`bradleyfalzon/ghinstallation`).
- Sentry client: plain HTTP wrapper; Sentry's API surface is small enough that a generated client is overkill.
- Config: `kelseyhightower/envconfig` for environment variables; no config files.
- Build: distroless multi-stage Dockerfile; static binary.
- Testing: standard library + `testify`; table-driven tests per data-source adapter.

## Consequences

**Positive**
- Best-in-class Kubernetes and ArgoCD client libraries — the parts of the service with the most operational weight.
- Informer-based cluster watches are a solved problem in Go; in Python or Node they would be hand-rolled.
- Single static binary, small container image (target <20 MB), startup in milliseconds — sizing fits NFR4 comfortably.
- Concurrency is idiomatic: goroutines per SSE connection, a single background fanout goroutine per upstream, channels for update propagation.
- The Go toolchain produces deterministic builds and integrates cleanly with the existing FVH container CI workflow.

**Negative**
- FVH's application repos skew Python and TypeScript; introducing Go means one service with a different language and review mental model. Mitigated by the narrow scope (one service) and by Go already being present in cluster tooling (operators, CLI tools).
- `client-go` has a steep initial learning curve for informers and caches. Mitigated by well-trodden examples in controller-runtime and ArgoCD itself.
- No shared types with the TypeScript frontend. Mitigated by keeping the API surface small and generating TypeScript types from a hand-written OpenAPI spec checked into the repo (see PRP-002).

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Python with FastAPI | Weak Kubernetes/ArgoCD client story; GIL issues for hundreds of SSE connections; larger memory footprint; async ecosystem still fragmented for upstream-watch style workloads |
| TypeScript / Node | Acceptable but no K8s/ArgoCD library match for `client-go`; would require more handwritten upstream integration; Node's long-running SSE works but memory-per-connection is higher |
| Rust | Would meet every requirement but the team has no Rust in production; onboarding cost exceeds benefit for this service |
| Java / Kotlin | Existing Kubernetes client is mature but JVM footprint conflicts with NFR4 |

## Evidence

- `client-go` and ArgoCD Go clients are the de-facto choices in the Kubernetes ecosystem; ArgoCD itself is a Go project.
- NFR4 (<256Mi memory at steady state) is comfortable for a Go service with ~50 concurrent SSE connections; tight for Python/Node.
- FVH's infrastructure-wiki already documents Go-based operational tooling in cluster.

---

*Confidence: 8/10. Authored 2026-04-16 as part of PRD-002 planning. Confidence deduction because team-language-fit is a real consideration that could tilt this toward Python with sufficient care.*
