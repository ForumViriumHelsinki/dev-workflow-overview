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
    this.dispatchEvent(new CustomEvent("tooltip-close", { bubbles: true, composed: true }));
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
