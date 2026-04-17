import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import type { OverallStatus, StatusCode } from "../services/schemas.js";
import type { ConnectionState } from "../services/status-client.js";

@customElement("status-banner")
export class StatusBanner extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
        max-width: 1400px;
        margin: 0 auto;
        padding: 1rem 1.5rem 0;
      }

      .wrap {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.7rem 1rem;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
      }

      .left {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex: 1;
        min-width: 0;
      }

      .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        flex: 0 0 14px;
        background: var(--dot-color, var(--status-unknown));
        box-shadow: 0 0 6px color-mix(in srgb, var(--dot-color, var(--status-unknown)), transparent 40%);
      }
      .dot[data-state="ok"]      { --dot-color: var(--status-ok); }
      .dot[data-state="warn"]    { --dot-color: var(--status-warn); }
      .dot[data-state="fail"]    { --dot-color: var(--status-fail); }
      .dot[data-state="unknown"] { --dot-color: var(--status-unknown); }

      .name {
        font-size: 0.95rem;
        font-weight: 700;
        color: var(--text);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .summary {
        font-size: 0.82rem;
        color: var(--text-muted);
      }

      .right {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.76rem;
      }
      .connection[data-state="connecting"] { color: var(--accent-yellow); }
      .connection[data-state="open"]       { color: var(--accent-green); }
      .connection[data-state="closed"]     { color: var(--accent-red); }

      button, a.exit {
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.28rem 0.6rem;
        font-size: 0.76rem;
        cursor: pointer;
        text-decoration: none;
        transition: background var(--transition);
      }
      button:hover, a.exit:hover { background: var(--surface-hover); }
      button[disabled] { opacity: 0.5; cursor: not-allowed; }
    `,
  ];

  @property() appName = "";
  @property({ attribute: false }) overall?: OverallStatus;
  @property() connection: ConnectionState = "connecting";
  @property({ type: Boolean }) refreshDisabled = false;

  private _onRefresh() {
    this.dispatchEvent(new CustomEvent("refresh-request", { bubbles: true, composed: true }));
  }

  private _onExit() {
    this.dispatchEvent(new CustomEvent("exit-live-view", { bubbles: true, composed: true }));
  }

  render() {
    const status: StatusCode = this.overall?.status ?? "unknown";
    const dotState = status === "n/a" ? "unknown" : status;
    const connectionLabel =
      this.connection === "open"
        ? "Connected"
        : this.connection === "connecting"
          ? "Reconnecting…"
          : "Disconnected";

    return html`
      <div class="wrap" role="status" aria-live="polite">
        <div class="left">
          <span class="dot" data-state=${dotState}></span>
          <div>
            <div class="name">${this.appName || "Live deployment status"}</div>
            <div class="summary">
              ${this.overall?.summary ?? "Waiting for initial snapshot"}
            </div>
          </div>
        </div>
        <div class="right">
          <span class="connection" data-state=${this.connection}>${connectionLabel}</span>
          <button
            type="button"
            @click=${this._onRefresh}
            ?disabled=${this.refreshDisabled}
            aria-label="Force refresh"
          >Refresh</button>
          <a
            class="exit"
            href="./"
            @click=${(e: MouseEvent) => { e.preventDefault(); this._onExit(); }}
            >Exit live view</a
          >
        </div>
      </div>
      ${this.connection === "closed"
        ? html`<div style="margin-top:0.5rem;font-size:0.78rem;color:var(--text-muted)">
            Live updates paused — check your network or the aggregator service.
          </div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "status-banner": StatusBanner;
  }
}
