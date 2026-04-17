import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import type { CardData } from "../data/stages.js";
import type { StatusCode } from "../services/schemas.js";
import "./workflow-card.js";

@customElement("workflow-stage")
export class WorkflowStage extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
        flex: 0 0 auto;
        width: 228px;
        scroll-snap-align: center;
      }

      .header {
        text-align: center;
        margin-bottom: 0.7rem;
      }

      .number-wrap {
        position: relative;
        display: inline-block;
      }

      .number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        font-size: 0.82rem;
        font-weight: 700;
        margin-bottom: 0.4rem;
        color: var(--bg);
        box-shadow: 0 2px 8px color-mix(in srgb, var(--stage-color), transparent 60%);
      }

      .status-dot {
        position: absolute;
        top: -2px;
        right: -2px;
        width: var(--status-dot-size);
        height: var(--status-dot-size);
        border-radius: 50%;
        border: var(--status-dot-ring) solid var(--bg);
        background: var(--dot-color, var(--status-unknown));
        box-shadow: 0 0 4px color-mix(in srgb, var(--dot-color, var(--status-unknown)), transparent 50%);
      }
      .status-dot[data-state="ok"]      { --dot-color: var(--status-ok); }
      .status-dot[data-state="warn"]    { --dot-color: var(--status-warn); }
      .status-dot[data-state="fail"]    { --dot-color: var(--status-fail); }
      .status-dot[data-state="unknown"] { --dot-color: var(--status-unknown); }

      .title {
        font-size: 0.88rem;
        font-weight: 600;
        letter-spacing: 0.02em;
      }

      .cards {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        padding: 0 0.5rem;
      }
    `,
  ];

  @property({ type: Number }) number = 1;
  @property() stageTitle = "";
  @property() color = "";
  @property({ type: Array }) cards: CardData[] = [];
  /**
   * Optional live-mode status. Undefined means "static mode" — no dot is
   * rendered so the static bundle stays byte-identical to its pre-live
   * baseline (PRD-002 FR8.1).
   */
  @property({ attribute: false }) status?: StatusCode;

  private _handleCardClick(tooltip: string) {
    this.dispatchEvent(
      new CustomEvent("card-click", {
        detail: { tooltip },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _renderDot() {
    if (!this.status || this.status === "n/a") return nothing;
    const labels: Record<StatusCode, string> = {
      ok: "Healthy",
      warn: "Degraded",
      fail: "Failing",
      unknown: "Status unknown",
      "n/a": "",
    };
    return html`<span
      class="status-dot"
      data-state=${this.status}
      role="img"
      aria-label=${labels[this.status]}
      title=${labels[this.status]}
    ></span>`;
  }

  render() {
    return html`
      <div class="header">
        <div class="number-wrap">
          <div
            class="number"
            style="background:${this.color}; --stage-color:${this.color}"
          >
            ${this.number}
          </div>
          ${this._renderDot()}
        </div>
        <div class="title">${this.stageTitle}</div>
      </div>
      <div class="cards">
        ${this.cards.map(
          (card) => html`
            <workflow-card
              .icon=${card.icon}
              .name=${card.name}
              .role=${card.role}
              .indicators=${card.indicators ?? []}
              @click=${() => this._handleCardClick(card.tooltip)}
            ></workflow-card>
          `,
        )}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workflow-stage": WorkflowStage;
  }
}
