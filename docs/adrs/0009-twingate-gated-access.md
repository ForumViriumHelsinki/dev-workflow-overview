# ADR-0009: Twingate network gating for live-status v1; defer SSO and public modes

## Status

Accepted

## Date

2026-04-16

## Context

The live-status dashboard (PRD-002) exposes aggregated information about FVH services: deployment health, release cadence, Sentry error trends, open PR counts, CI status. Much of this is *internally unremarkable* but not something the org would publish externally without review.

The org already provides two access-control layers:

- **Twingate** — zero-trust network access. Already used for internal tools. Users who are not on the FVH Twingate tenant cannot reach Twingate-gated resources at the network layer.
- **OneLogin SSO via Envoy Gateway OIDC filter** — per-user authentication at the HTTP layer. Already used by at least one other internal tool.

v1 does not enforce per-user authorization: any authenticated viewer sees the same data, gated only by ArgoCD AppProject visibility on the aggregator side.

## Decision

**For v1, gate the live-status dashboard and the aggregator API exclusively via Twingate.**

- The Ingress/Gateway route for the service is tagged `internal-only` and reachable only from within the Twingate network.
- OneLogin SSO is **not** enforced at the HTTP layer in v1.
- The aggregator service trusts all traffic that reaches it at the network layer and does not perform per-user authorization.
- A public or partially-public variant is explicitly out of scope for v1.

Per-user authorization (OneLogin SSO integration, per-user AppProject scoping) and public/sanitized modes are deferred to later iterations; they are tracked in PRD-002 §8 Open Questions.

## Consequences

**Positive**
- Zero new authentication code — the aggregator can focus on aggregation correctness.
- Matches the risk profile: v1 viewers are FVH employees and trusted partners on Twingate. Making them re-authenticate twice adds friction without adding safety.
- Twingate access is revocable org-wide with no change to the aggregator deployment.
- Aligns with existing FVH internal-tool pattern — no new doors to knock on.

**Negative**
- Anyone on Twingate sees every Application the aggregator can see. For v1 this is a feature ("transparency") not a bug, but it means a contractor on Twingate could view production status of projects outside their scope. Documented limitation.
- Puts Twingate in the critical path — if Twingate is down, the dashboard is unreachable even for admins. Acceptable: Twingate outage also breaks every other internal tool.
- Adds work later when SSO becomes necessary — but that work is bounded (Envoy Gateway OIDC filter + a simple group check); deferring it is reasonable.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| OneLogin SSO at the Gateway from day one | Doubles v1 scope without addressing a concrete v1 threat; can be layered on later without code changes |
| Per-user RBAC inside the aggregator | Requires an identity source, group membership lookup, and per-Application authz rules — none of which exist yet |
| Public (unauthenticated) read-only mode | Safe only after an explicit review of every field in every response; punts the "what is shareable" question that the org has not answered |
| API key per viewer | Shifts secret-management burden to viewers; impractical for a browser tool; revocation is manual |

## Consequences for Deprecation

When per-user SSO is introduced in a future ADR:

- This ADR will be marked `Superseded by ADR-XXXX`.
- The aggregator will continue to support network-only mode as a fallback during the transition.

## Evidence

- FVH org already uses Twingate as the primary internal network boundary (documented in infrastructure-wiki).
- OneLogin tenant and Envoy Gateway OIDC filter patterns exist in the infrastructure repo and can be adopted later without code changes in this service.

---

*Confidence: 8/10. Authored 2026-04-16 as part of PRD-002 planning. Lower confidence because per-user authz remains the most likely area of scope creep.*
