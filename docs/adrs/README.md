# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) documenting significant technical decisions for this project.

## What Are ADRs?

An ADR captures the context, options considered, and rationale behind a significant architectural or technical decision. They serve as a decision log that helps current and future team members understand _why_ the system is built the way it is.

## ADR Lifecycle

| Status | Meaning |
|--------|---------|
| **Proposed** | Decision under discussion, not yet finalized |
| **Accepted** | Decision made and in effect |
| **Deprecated** | Decision no longer relevant (technology removed, approach abandoned) |
| **Superseded** | Replaced by a newer ADR (links to successor) |

## Listing ADRs

Generate a table of all ADRs programmatically:

```bash
printf "| ADR | Title | Status | Date |\n|-----|-------|--------|------|\n" && \
fd '^[0-9]{4}-.*\.md$' docs/adrs -x awk '
  /^# ADR-/ {gsub(/^# ADR-[0-9]+: /, ""); title=$0}
  /^## Status/ {p_status=1; next}
  p_status && NF {status=$0; p_status=0}
  /^## Date/ {p_date=1; next}
  p_date && NF {date=$0; p_date=0}
  /^status:/ && !status {gsub(/^status:[[:space:]]*/, ""); status=$0}
  /^date:/ && !date {gsub(/^date:[[:space:]]*/, ""); date=$0}
  END {
    fname = FILENAME; sub(/.*\//, "", fname); num = substr(fname, 1, 4)
    if (title == "") title = "(untitled)"
    if (status == "") status = "-"
    if (date == "") date = "-"
    printf "| [%s](%s) | %s | %s | %s |\n", num, FILENAME, title, status, date
  }
' {} | sort
```

Or use `/blueprint:adr-list` for formatted output with summary statistics.

## When to Write an ADR

Write an ADR when making decisions that:
- Are **hard to reverse** (database choice, framework, API style)
- Affect **multiple components** (state management, authentication approach)
- Involve **meaningful trade-offs** between alternatives
- Will be **questioned later** ("why did we choose X?")

Skip ADRs for obvious or trivial choices with no real alternatives.

## Current ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-lit-typescript-componentization.md) | Use Lit + TypeScript for componentization | Accepted | 2026-04-08 |
| [0002](0002-vite-bun-build-pipeline.md) | Vite + Bun for the build pipeline | Accepted | 2026-04-08 |
| [0003](0003-github-pages-hosting.md) | Host the visualization on GitHub Pages | Accepted | 2026-04-08 |
| [0004](0004-indicators-array-data-model.md) | Use an indicators array + phase discriminator on stage cards | Accepted | 2026-04-16 |
| [0005](0005-svg-overlay-arrow-tracking.md) | SVG overlay with ResizeObserver + rAF for the Monitor → Develop feedback arrow | Accepted | 2026-04-16 |
| [0006](0006-aggregator-service-pattern.md) | In-cluster aggregator service between the browser and data sources | Accepted | 2026-04-16 |
| [0007](0007-argocd-application-as-identity-root.md) | ArgoCD Application name is the canonical deployment identity | Accepted | 2026-04-16 |
| [0008](0008-sse-for-status-push.md) | Server-Sent Events over WebSockets or polling for live status push | Accepted | 2026-04-16 |
| [0009](0009-twingate-gated-access.md) | Twingate network gating for live-status v1; defer SSO and public modes | Accepted | 2026-04-16 |
| [0010](0010-go-for-aggregator-service.md) | Go for the status-aggregator service | Accepted | 2026-04-16 |
| [0011](0011-caching-and-rate-limits.md) | Per-source TTL cache with event-driven invalidation; fail-open-to-grey | Accepted | 2026-04-16 |

ADRs 0006–0011 together define the architecture for the live deployment-status feature; see [PRD-002](../prds/live-deployment-status.md) and [PRP-002](../prps/live-deployment-status.md).

## Proposed ADRs

Decisions identified but not yet documented as full ADRs:

<!-- Add proposed decisions here as bullet points:
- [ ] Decision topic — brief context (identified YYYY-MM-DD)
-->

_No proposed ADRs at this time._

## Creating ADRs

Use `/blueprint:derive-adr` to generate ADRs from project analysis, or create manually following the [MADR template](https://adr.github.io/madr/).

ADR files follow the naming convention: `NNNN-short-title.md` (e.g., `0001-use-react.md`).

---
*Generated via /blueprint:derive-adr*
