# status-aggregator

Backend service for the live-deployment-status feature of `dev-workflow-overview`.

This directory will hold the Go implementation of the aggregator service described in:

- [PRD-002](../docs/prds/live-deployment-status.md) — product requirements
- [PRP-002](../docs/prps/live-deployment-status.md) — implementation plan
- ADRs [0006](../docs/adrs/0006-aggregator-service-pattern.md), [0007](../docs/adrs/0007-argocd-application-as-identity-root.md), [0008](../docs/adrs/0008-sse-for-status-push.md), [0009](../docs/adrs/0009-twingate-gated-access.md), [0010](../docs/adrs/0010-go-for-aggregator-service.md), [0011](../docs/adrs/0011-caching-and-rate-limits.md) — architecture decisions

## Current status

Only the API contract has been authored so far (work stream S1 from PRP-002):

- [`api/openapi.yaml`](api/openapi.yaml) — OpenAPI 3.1 spec, single source of truth for client and server types.

The Go module, source adapters, and deployment plumbing will land in subsequent PRs per the PRP's work streams.

## Generating TypeScript types for the frontend

Once the frontend picks up the spec, it will regenerate `src/services/types.ts` via:

```bash
bunx openapi-typescript aggregator/api/openapi.yaml -o src/services/types.ts
```

The generated file is committed so consumers don't need the spec toolchain.
