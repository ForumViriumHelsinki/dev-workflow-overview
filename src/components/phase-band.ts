import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.js";

/**
 * Phase band — a tinted label that visually groups the stages inside a phase.
 * Sits on the top row of the pipeline, directly above its phase's stages.
 */
@customElement("phase-band")
export class PhaseBand extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: flex;
        flex: 0 0 auto;
        align-items: stretch;
      }

      .band {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        padding: 0.35rem 0.8rem;
        margin-bottom: 0.6rem;
        background: color-mix(in srgb, var(--band-color), transparent 90%);
        border: 1px solid
          color-mix(in srgb, var(--band-color), transparent 70%);
        border-radius: var(--radius-md);
        color: var(--band-color);
        font-size: 0.68rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        user-select: none;
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--band-color);
        box-shadow: 0 0 6px
          color-mix(in srgb, var(--band-color), transparent 50%);
      }
    `,
  ];

  @property() label = "";
  @property() color = "var(--accent-blue)";
  @property({ type: Number }) stageCount = 1;

  connectedCallback() {
    super.connectedCallback();
    this._applyWidth();
  }

  updated() {
    this._applyWidth();
  }

  /**
   * Width = sum of N stage widths + (N-1) arrow widths.
   * Matches the sizing used in workflow-stage + pipeline-arrow.
   */
  private _applyWidth() {
    const stageWidth = this._currentStageWidth();
    const arrowWidth = 44;
    const count = Math.max(1, this.stageCount);
    const total = stageWidth * count + arrowWidth * (count - 1);
    this.style.width = `${total}px`;
  }

  private _currentStageWidth(): number {
    return window.matchMedia("(max-width: 900px)").matches ? 180 : 228;
  }

  render() {
    return html`
      <div class="band" style="--band-color:${this.color}">
        <span class="dot"></span>
        <span>${this.label}</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "phase-band": PhaseBand;
  }
}
