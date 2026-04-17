# ADR-0008: Server-Sent Events over WebSockets or polling for live status push

## Status

Accepted

## Date

2026-04-16

## Context

The live-status dashboard (PRD-002) needs to update stage status dots and tooltip values as underlying state changes: a new release is cut, ArgoCD flips to OutOfSync, Sentry event rate spikes, CI turns red. The server already observes those changes via upstream-source watches and cache invalidation (ADR-0011).

Three transport options considered:

1. **Client polling** of `GET /api/v1/apps/:name/status` every N seconds.
2. **WebSockets** from the browser to the aggregator, bidirectional messages.
3. **Server-Sent Events (SSE)** — one-way, server-to-client, over standard HTTP.

The traffic shape is strongly asymmetric: the browser needs to *receive* status changes; it has no data of its own to push back other than "connected". There are likely 5–50 concurrent viewers per aggregator instance. Envoy Gateway and Twingate are already in the path.

## Decision

Use SSE as the push transport. Endpoint: `GET /api/v1/apps/:name/events` with `Content-Type: text/event-stream`.

- On connect, the server sends a full snapshot event (`event: snapshot`) so the client has complete state without an additional HTTP round-trip.
- Subsequent partial updates arrive as `event: stage-update` events carrying a single stage's new status + values.
- A `ping` event every 20s keeps the connection alive through intermediate proxies and lets the client detect disconnection.
- The client uses the standard `EventSource` API with a small wrapper for exponential backoff on reconnect; on reconnect it fetches a fresh snapshot and resumes.

## Consequences

**Positive**
- Matches the one-way nature of the data flow — no wasted machinery for a send channel that would never be used.
- Works natively over plain HTTP/1.1 and HTTP/2 — no Connection-upgrade negotiation, no special Envoy Gateway configuration, no Twingate quirks to work around. FVH's existing Ingress path handles it unchanged.
- `EventSource` in the browser handles reconnection, last-event-id replay, and connection lifecycle for free.
- Trivially load-balanceable: sticky sessions are not required because any replica can produce the same snapshot from the same cache.
- Human-readable wire format — curl-debuggable in production (`curl -N https://.../events`).

**Negative**
- Browser concurrency limit: HTTP/1.1 browsers cap at ~6 connections per origin, so opening the dashboard in 7+ tabs of the same app starves the 7th. HTTP/2 (already in use via Envoy Gateway) lifts this limit to ~100 per origin, making the issue academic.
- No binary frame support — not a problem for JSON status payloads but would rule SSE out for other uses.
- Some corporate proxies strip `text/event-stream`. Not a concern behind Twingate, which preserves it.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| Plain polling every 5–10s | Wastes request budget; creates coarse-grained UI updates; doesn't benefit from the server's cache-invalidation events; status lags change by up to the polling interval |
| WebSockets | Bidirectional capability is unused; adds handshake complexity, Envoy Gateway tuning, and a heavier client library; reconnection logic is DIY |
| Long polling | Feels like SSE but without the browser API support; the aggregator would still need to hold requests open; SSE wins on ergonomics |
| gRPC-Web server streaming | Heavier client dependency; proto churn; adds build complexity for a tiny payload surface |
| Push via ArgoCD webhooks to the browser | Can't — browsers aren't reachable; would still need the aggregator in between |

## Evidence

- PRD-002 FR4 (real-time updates) — matches exactly the SSE programming model.
- Envoy Gateway documentation confirms no special config needed for `text/event-stream`; already used in at least one other FVH service.
- SSE reconnection primitives (`Last-Event-ID`) provide the resume semantics needed by the cache-invalidation pattern in ADR-0011.

---

*Confidence: 9/10. Authored 2026-04-16 as part of PRD-002 planning.*
