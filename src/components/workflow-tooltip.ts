import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import { tooltips } from "../data/tooltips.js";
import type { TooltipDetail } from "../data/tooltips.js";
import type { Stage } from "../services/schemas.js";

@customElement("workflow-tooltip")
export class WorkflowTooltip extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: contents;
      }

      .overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 999;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .overlay.active {
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.15s ease;
      }

      .panel {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 1.6rem 2rem;
        max-width: 560px;
        width: 92%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: var(--shadow-lg);
        animation: slideUp 0.2s ease;
        position: relative;
      }

      .panel h3 {
        font-size: 1.15rem;
        font-weight: 700;
        margin-bottom: 0.15rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .subtitle {
        color: var(--text-muted);
        font-size: 0.82rem;
        margin-bottom: 1rem;
        padding-bottom: 0.8rem;
        border-bottom: 1px solid var(--border-subtle);
      }

      .body {
        font-size: 0.88rem;
        line-height: 1.65;
        color: var(--text-secondary);
      }

      .details {
        margin-top: 0.8rem;
        padding-left: 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
      }

      .details li {
        font-size: 0.82rem;
        color: var(--text-muted);
        padding: 0.35rem 0;
        padding-left: 1.3rem;
        position: relative;
        line-height: 1.45;
        border-radius: var(--radius-sm);
        transition: background var(--transition);
      }
      .details li:hover {
        background: color-mix(in srgb, var(--surface), transparent 50%);
      }

      .details li::before {
        content: "\u2192";
        position: absolute;
        left: 0;
        color: var(--accent-blue);
        font-weight: 600;
      }
      .details li.gate::before {
        content: "\u2713";
        color: var(--accent-green);
      }

      /* Callout blocks for doc-gap / automation-opportunity */
      .callout {
        margin-top: 1rem;
        padding: 0.8rem 1rem;
        border-radius: var(--radius-md);
        border: 1px solid var(--callout-color);
        background: color-mix(in srgb, var(--callout-color), transparent 92%);
      }
      .callout-heading {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--callout-color);
        margin-bottom: 0.45rem;
      }
      .callout-body {
        font-size: 0.82rem;
        color: var(--text-secondary);
        line-height: 1.55;
      }
      .callout-list {
        margin-top: 0.4rem;
        padding-left: 1rem;
        list-style: disc;
        display: flex;
        flex-direction: column;
        gap: 0.18rem;
      }
      .callout-list li {
        font-size: 0.8rem;
        color: var(--text-muted);
        line-height: 1.45;
      }
      .callout-meta {
        margin-top: 0.5rem;
        font-size: 0.74rem;
        color: var(--text-muted);
      }
      .callout-meta b {
        color: var(--text-secondary);
        font-weight: 600;
      }

      /* Live values section */
      .live {
        margin-bottom: 0.9rem;
        padding: 0.75rem 0.9rem;
        background: var(--surface);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
      }
      .live-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.35rem;
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .live-summary {
        font-size: 0.88rem;
        color: var(--text);
        margin-bottom: 0.3rem;
      }
      .live-meta {
        font-size: 0.72rem;
        color: var(--text-muted);
        display: flex;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .live-links {
        margin-top: 0.45rem;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .live-links a {
        font-size: 0.75rem;
        color: var(--accent-blue);
        text-decoration: none;
      }
      .live-links a:hover {
        text-decoration: underline;
      }
      .live-empty {
        font-size: 0.82rem;
        color: var(--text-muted);
        font-style: italic;
      }
      .live-state-ok   { color: var(--status-ok); }
      .live-state-warn { color: var(--status-warn); }
      .live-state-fail { color: var(--status-fail); }
      .live-state-unknown { color: var(--status-unknown); }

      .close-btn {
        position: absolute;
        top: 1rem;
        right: 1.2rem;
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 1.4rem;
        cursor: pointer;
        line-height: 1;
        padding: 0.25rem;
        border-radius: var(--radius-sm);
        transition:
          color var(--transition),
          background var(--transition);
      }
      .close-btn:hover {
        color: var(--text);
        background: var(--surface);
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ];

  @property() activeTooltip = "";
  /**
   * Optional live-stage payload surfaced when the app is in live mode.
   * Rendered above the static educational body per PRD-002 FR3.1.
   * When undefined no live section is shown.
   */
  @property({ attribute: false }) liveStage?: Stage;
  /** True when live mode is active but the aggregator returned no data. */
  @property({ type: Boolean }) liveEmpty = false;

  connectedCallback() {
    super.connectedCallback();
    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener("keydown", this._onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this._onKeyDown);
  }

  private _onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") this._close();
  }

  private _close() {
    this.activeTooltip = "";
    this.dispatchEvent(
      new CustomEvent("tooltip-close", { bubbles: true, composed: true }),
    );
  }

  private _onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("overlay")) this._close();
  }

  private _renderDetail(d: string | TooltipDetail) {
    if (typeof d === "string") {
      return html`<li>${d}</li>`;
    }
    return html`<li class=${d.gate ? "gate" : ""}>${d.text}</li>`;
  }

  private _renderLive() {
    if (this.liveEmpty) {
      return html`<div class="live">
        <div class="live-header">Current state</div>
        <div class="live-empty">No live data available.</div>
      </div>`;
    }
    const stage = this.liveStage;
    if (!stage) return nothing;

    const stateClass = `live-state-${stage.status === "n/a" ? "unknown" : stage.status}`;
    const rel = formatRelative(stage.fetchedAt);
    const stale =
      stage.staleness === "fetch-failed"
        ? "Fetch failed"
        : stage.staleness === "stale"
          ? "Stale"
          : stage.staleness === "cached"
            ? "Cached"
            : "Fresh";
    return html`
      <div class="live">
        <div class="live-header">
          <span>Current state</span>
          <span class=${stateClass}>${stage.status.toUpperCase()}</span>
        </div>
        <div class="live-summary">${stage.summary || "—"}</div>
        <div class="live-meta">
          <span>Fetched ${rel}</span>
          <span>· ${stale}</span>
          ${stage.failureReason
            ? html`<span>· ${stage.failureReason}</span>`
            : null}
        </div>
        ${stage.links && stage.links.length
          ? html`<div class="live-links">
              ${stage.links.map(
                (l) => html`<a href=${l.href} target="_blank" rel="noopener"
                  >${l.label} &rarr;</a
                >`,
              )}
            </div>`
          : null}
      </div>
    `;
  }

  render() {
    const data = tooltips[this.activeTooltip];
    if (!data) return nothing;

    return html`
      <div class="overlay active" @click=${this._onOverlayClick}>
        <div class="panel">
          <button class="close-btn" @click=${this._close}>&times;</button>
          <h3>${data.title}</h3>
          <div class="subtitle">${data.subtitle}</div>
          ${this._renderLive()}
          <p class="body">${data.body}</p>
          <ul class="details">
            ${data.details.map((d) => this._renderDetail(d))}
          </ul>
          ${data.docGap
            ? html`
                <div
                  class="callout"
                  style="--callout-color: var(--badge-doc-gap)"
                >
                  <div class="callout-heading">
                    <span class="legend-pill"></span>
                    Missing documentation
                  </div>
                  <div class="callout-body">
                    These documents do not yet exist and should be authored to
                    close the gap.
                  </div>
                  <ul class="callout-list">
                    ${data.docGap.missing.map(
                      (m) => html`<li>${m}</li>`,
                    )}
                  </ul>
                  ${data.docGap.suggestedLocation
                    ? html`
                        <div class="callout-meta">
                          Suggested location:
                          <b>${data.docGap.suggestedLocation}</b>
                        </div>
                      `
                    : null}
                </div>
              `
            : null}
          ${data.automationOpportunity
            ? html`
                <div
                  class="callout"
                  style="--callout-color: var(--badge-automatable)"
                >
                  <div class="callout-heading">Automation opportunity</div>
                  <div class="callout-body">
                    ${data.automationOpportunity.what}
                  </div>
                  ${data.automationOpportunity.blockedBy
                    ? html`
                        <div class="callout-meta">
                          Blocked by:
                          <b>${data.automationOpportunity.blockedBy}</b>
                        </div>
                      `
                    : null}
                </div>
              `
            : null}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workflow-tooltip": WorkflowTooltip;
  }
}

/** Human-friendly "Xs ago" / "Xm ago" relative-time string. */
function formatRelative(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "just now";
  const deltaSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  if (deltaSec < 3600) return `${Math.round(deltaSec / 60)}m ago`;
  if (deltaSec < 86_400) return `${Math.round(deltaSec / 3600)}h ago`;
  return `${Math.round(deltaSec / 86_400)}d ago`;
}
