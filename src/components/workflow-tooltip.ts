import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import { tooltips } from "../data/tooltips.js";
import type { TooltipDetail } from "../data/tooltips.js";

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

  render() {
    const data = tooltips[this.activeTooltip];
    if (!data) return nothing;

    return html`
      <div class="overlay active" @click=${this._onOverlayClick}>
        <div class="panel">
          <button class="close-btn" @click=${this._close}>&times;</button>
          <h3>${data.title}</h3>
          <div class="subtitle">${data.subtitle}</div>
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
