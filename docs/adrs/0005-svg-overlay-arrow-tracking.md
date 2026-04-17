# ADR-0005: SVG overlay with ResizeObserver + rAF for the Monitor → Develop feedback arrow

## Status

Accepted

## Date

2026-04-16

## Context

The expanded lifecycle visualization (commit `ddbf86f`) needed to draw a curved arrow from the **Monitor** stage card back to the **Develop** stage card to convey the operate-loop. Unlike the inline `pipeline-arrow` components (which sit in the document flow between adjacent stages), this feedback arrow:

- Spans the full pipeline rail, crossing many stages.
- Must remain anchored to two specific cards as the layout reflows (window resize, responsive breakpoint at 900px, scrolling, dynamic content).
- Cannot disrupt grid / flex layout of the stages it visually overlaps.

A naive solution (drawing the arrow as part of the stage row's HTML flow) would have required hacking layout to account for absolute positioning while preserving stage spacing.

## Decision

Implement the feedback arrow as a separate `<feedback-arrow>` Lit component that:

1. Renders an absolutely-positioned SVG overlay sized to its parent (`.pipeline-rail`).
2. Receives **callback functions** from `workflow-app` that return live references to the source and target DOM elements (Monitor card, Develop card). This keeps the component agnostic of DOM structure and selector strings.
3. Subscribes to layout changes via:
   - `ResizeObserver` on the parent and on each anchor element
   - `scroll` and `window.resize` events
4. Uses `requestAnimationFrame` to throttle path recomputation — at most one geometric update per frame, regardless of how many events fire.
5. Recomputes the SVG path (`M ... C ... `) using `getBoundingClientRect()` deltas relative to the overlay's own bounds.

## Consequences

**Positive**
- Visual stays glued to the anchor cards across resize, scroll, and the 900px breakpoint reflow without manual tuning.
- Component is reusable: the same pattern could draw any future feedback loop (Operate → Plan, etc.) by passing different anchor callbacks.
- rAF throttling avoids layout-thrash when many resize/scroll events fire in succession.
- Decoupling via callbacks (rather than CSS selectors) keeps the contract type-safe and refactor-friendly.

**Negative**
- ResizeObserver and `getBoundingClientRect` reads can themselves trigger layout if used carelessly; rAF batching mitigates but does not eliminate the cost.
- Browser support: ResizeObserver is broadly available in evergreen browsers but absent in legacy IE / very old Safari. Acceptable given the audience (current FVH browsers).
- The component must clean up observers and event listeners in `disconnectedCallback` to avoid leaks if the page becomes long-lived.

## Alternatives Considered

| Option | Reason rejected |
|--------|-----------------|
| CSS-only curved border / pseudo-element | Cannot reach across two non-adjacent flex children; fragile at responsive breakpoints |
| Static SVG positioned with hardcoded coordinates | Breaks on every layout change; would need redesign per breakpoint |
| Canvas overlay drawn imperatively | Heavier than SVG for a single curve; loses easy CSS theming of stroke/fill via theme tokens |
| Mutation observer instead of ResizeObserver | MutationObserver doesn't fire on size changes that don't alter the DOM tree (e.g., flex reflow), making it the wrong tool here |

## Evidence

- `src/components/feedback-arrow.ts` (commit `ddbf86f`, +221 lines)
- `workflow-app` wires callback anchors and hosts the overlay (`src/components/workflow-app.ts:362-370`)
- Commit body explicitly calls out "ResizeObserver + scroll with requestAnimationFrame throttling"

---

*Confidence: 9/10. Derived retroactively via `/blueprint:derive-plans` on 2026-04-16.*
