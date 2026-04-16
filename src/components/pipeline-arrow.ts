import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";
import { theme } from "../styles/theme.js";

@customElement("pipeline-arrow")
export class PipelineArrow extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: flex;
        flex: 0 0 auto;
        width: 44px;
        align-items: center;
        justify-content: center;
        padding-top: 2.8rem;
        color: var(--border);
        user-select: none;
      }

      svg {
        width: 36px;
        height: 18px;
        opacity: 0.6;
        transition: opacity var(--transition);
      }

      :host(:hover) svg {
        opacity: 1;
      }
    `,
  ];

  render() {
    return html`
      <svg viewBox="0 0 40 20">
        <path
          d="M2 10 L28 10 M23 4 L30 10 L23 16"
          stroke="currentColor"
          stroke-width="2"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pipeline-arrow": PipelineArrow;
  }
}
