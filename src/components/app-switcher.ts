import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import type { AppSummary } from "../services/schemas.js";

@customElement("app-switcher")
export class AppSwitcher extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
        max-width: 1400px;
        margin: 0.6rem auto 0;
        padding: 0 1.5rem;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.82rem;
        color: var(--text-muted);
      }
      label {
        font-weight: 600;
        color: var(--text-secondary);
      }
      select {
        flex: 1;
        max-width: 480px;
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.3rem 0.5rem;
        font-family: inherit;
        font-size: 0.82rem;
      }
      .pill {
        font-size: 0.66rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.1rem 0.45rem;
        border-radius: 10px;
      }
      .pill[data-state="ok"]      { color: var(--status-ok); background: color-mix(in srgb, var(--status-ok), transparent 85%); }
      .pill[data-state="warn"]    { color: var(--status-warn); background: color-mix(in srgb, var(--status-warn), transparent 85%); }
      .pill[data-state="fail"]    { color: var(--status-fail); background: color-mix(in srgb, var(--status-fail), transparent 85%); }
      .pill[data-state="unknown"] { color: var(--status-unknown); background: color-mix(in srgb, var(--status-unknown), transparent 85%); }
    `,
  ];

  @property({ attribute: false }) apps: AppSummary[] = [];
  @property() selected = "";
  @state() private _loading = false;

  private _onChange(e: Event) {
    const name = (e.target as HTMLSelectElement).value;
    if (name) {
      this.dispatchEvent(
        new CustomEvent("app-select", {
          detail: { name },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  render() {
    const selectedApp = this.apps.find((a) => a.name === this.selected);
    return html`
      <div class="row">
        <label for="app-select">Application</label>
        <select id="app-select" @change=${this._onChange}>
          ${!this.selected
            ? html`<option value="">— select —</option>`
            : nothing}
          ${this.apps.map(
            (a) => html`<option
              value=${a.name}
              ?selected=${a.name === this.selected}
            >
              ${a.name} · ${a.source.repo}
            </option>`,
          )}
        </select>
        ${selectedApp
          ? html`<span
              class="pill"
              data-state=${selectedApp.overall.status === "n/a"
                ? "unknown"
                : selectedApp.overall.status}
              >${selectedApp.overall.status}</span
            >`
          : nothing}
        ${this._loading ? html`<span>loading…</span>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "app-switcher": AppSwitcher;
  }
}
