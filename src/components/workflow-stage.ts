import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import type { CardData } from "../data/stages.js";
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

  private _handleCardClick(tooltip: string) {
    this.dispatchEvent(
      new CustomEvent("card-click", {
        detail: { tooltip },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    return html`
      <div class="header">
        <div
          class="number"
          style="background:${this.color}; --stage-color:${this.color}"
        >
          ${this.number}
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
              .highlight=${card.highlight}
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
