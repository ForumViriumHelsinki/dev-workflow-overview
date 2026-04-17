import { LitElement, css, html, nothing } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import {
  stages,
  phases,
  gateChips,
  agentCards,
  infraCards,
  stageNumberByKind,
} from "../data/stages.js";
import type {
  AppStatus,
  AppSummary,
  Stage as LiveStage,
  StageKind,
  StatusCode,
} from "../services/schemas.js";
import {
  StatusClient,
  type ConnectionState,
} from "../services/status-client.js";
import "./workflow-stage.js";
import "./workflow-card.js";
import "./workflow-tooltip.js";
import "./pipeline-arrow.js";
import "./phase-band.js";
import "./feedback-arrow.js";
import "./status-banner.js";
import "./app-switcher.js";

/** Map of stage number (1..14) → current live-mode status. */
type LiveStatusMap = Partial<Record<number, StatusCode>>;
/** Map of stage number → full live-mode stage payload for tooltip lookup. */
type LiveStageMap = Partial<Record<number, LiveStage>>;

@customElement("workflow-app")
export class WorkflowApp extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        display: block;
        min-height: 100vh;
        background: var(--bg);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      /* Header */
      header {
        text-align: center;
        padding: 3rem 1.5rem 0.5rem;
      }
      header h1 {
        font-size: 1.9rem;
        font-weight: 800;
        background: linear-gradient(
          135deg,
          var(--accent-blue),
          var(--accent-purple),
          var(--accent-cyan)
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        letter-spacing: -0.02em;
      }
      header p {
        color: var(--text-secondary);
        margin-top: 0.5rem;
        font-size: 0.95rem;
      }
      .header-note {
        color: var(--text-muted);
        font-size: 0.78rem;
        margin-top: 0.35rem;
        font-style: italic;
        opacity: 0.75;
      }

      /* Legend */
      .legend {
        display: flex;
        justify-content: center;
        gap: 1.2rem;
        flex-wrap: wrap;
        padding: 1rem 1.5rem 0;
        font-size: 0.78rem;
        color: var(--text-muted);
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .legend-dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        box-shadow: 0 0 6px color-mix(in srgb, var(--dot-color), transparent 50%);
      }
      .legend-pill {
        display: inline-flex;
        align-items: center;
        font-size: 0.6rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        padding: 0.12rem 0.4rem;
        border-radius: var(--radius-sm);
        color: var(--pill-color);
        background: color-mix(in srgb, var(--pill-color), transparent 88%);
      }

      /* Section labels */
      .section-label {
        max-width: 1400px;
        margin: 0 auto;
        padding: 1.8rem 1.5rem 0;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 0.8rem;
      }
      .section-label::after {
        content: "";
        flex: 1;
        height: 1px;
        background: linear-gradient(
          to right,
          var(--border),
          transparent
        );
      }

      /* Pipeline — outer scroller; inner rail holds the feedback arrow overlay */
      .pipeline {
        padding: 1.2rem 1.5rem 4rem;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: var(--border) transparent;
      }
      .pipeline::-webkit-scrollbar {
        height: 6px;
      }
      .pipeline::-webkit-scrollbar-track {
        background: transparent;
      }
      .pipeline::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 3px;
      }

      .pipeline-rail {
        position: relative;
        display: inline-block;
        min-width: 100%;
      }

      .phase-row,
      .stage-row {
        display: flex;
        align-items: flex-start;
      }

      .phase-row {
        align-items: stretch;
      }

      .phase-gap {
        width: 44px;
        flex: 0 0 44px;
      }

      .phase-column {
        display: flex;
        flex-direction: column;
        flex: 0 0 auto;
      }

      .phase-stages {
        display: flex;
        align-items: flex-start;
        flex: 0 0 auto;
      }

      /* Bottom sections */
      .bottom-sections {
        max-width: 1100px;
        margin: 0 auto 2rem;
        padding: 0 1.5rem;
      }

      /* Section headings */
      .section-heading {
        font-size: 1.05rem;
        font-weight: 700;
        margin-bottom: 0.8rem;
        display: flex;
        align-items: center;
        gap: 0.6rem;
      }

      .section-subtitle {
        font-size: 0.82rem;
        color: var(--text-muted);
        margin-bottom: 0.8rem;
      }

      /* Grid cards */
      .flow-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.8rem;
      }

      .flow-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 1rem 1.2rem;
        cursor: pointer;
        transition:
          background var(--transition),
          transform var(--transition),
          box-shadow var(--transition);
      }
      .flow-card:hover {
        background: var(--surface-hover);
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
      }
      .flow-card h4 {
        font-size: 0.85rem;
        font-weight: 600;
        margin-bottom: 0.35rem;
      }
      .flow-card p {
        font-size: 0.78rem;
        color: var(--text-muted);
        line-height: 1.55;
      }

      /* Gate chips */
      .gates-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.8rem;
      }
      .gate-chip {
        font-size: 0.68rem;
        font-weight: 600;
        padding: 0.28rem 0.7rem;
        border-radius: 20px;
        background: color-mix(in srgb, var(--accent-green), transparent 88%);
        color: var(--accent-green);
        border: 1px solid
          color-mix(in srgb, var(--accent-green), transparent 70%);
        transition:
          background var(--transition),
          transform var(--transition);
      }
      .gate-chip:hover {
        transform: translateY(-1px);
      }
      .gate-chip.security {
        background: color-mix(in srgb, var(--accent-red), transparent 88%);
        color: var(--accent-red);
        border-color: color-mix(
          in srgb,
          var(--accent-red),
          transparent 70%
        );
      }
      .gate-chip.ai {
        background: color-mix(in srgb, var(--accent-cyan), transparent 88%);
        color: var(--accent-cyan);
        border-color: color-mix(
          in srgb,
          var(--accent-cyan),
          transparent 70%
        );
      }

      /* Agent banner */
      .agent-banner {
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--accent-cyan), transparent 92%),
          color-mix(in srgb, var(--accent-purple), transparent 92%)
        );
        border: 1px solid
          color-mix(in srgb, var(--accent-cyan), transparent 70%);
        border-radius: var(--radius-lg);
        padding: 1.4rem 1.6rem;
        margin-bottom: 2rem;
        cursor: pointer;
        transition:
          border-color var(--transition),
          box-shadow var(--transition);
      }
      .agent-banner:hover {
        border-color: color-mix(
          in srgb,
          var(--accent-cyan),
          transparent 40%
        );
        box-shadow: 0 4px 24px
          color-mix(in srgb, var(--accent-cyan), transparent 85%);
      }
      .agent-banner h3 {
        font-size: 1rem;
        font-weight: 700;
        color: var(--accent-cyan);
        margin-bottom: 0.6rem;
      }
      .agent-banner p {
        font-size: 0.82rem;
        color: var(--text-muted);
        line-height: 1.6;
      }

      /* Flow summary spacing */
      .flow-summary {
        margin-bottom: 2rem;
      }

      /* Footer */
      footer {
        text-align: center;
        padding: 1.5rem;
        color: var(--text-muted);
        font-size: 0.72rem;
        opacity: 0.55;
        border-top: 1px solid var(--border-subtle);
        max-width: 1100px;
        margin: 0 auto;
        line-height: 1.55;
      }

      /* Responsive */
      @media (max-width: 900px) {
        .pipeline {
          padding: 1rem 0.5rem 3.5rem;
        }
        workflow-stage {
          width: 180px;
        }
      }
    `,
  ];

  @state() private _activeTooltip = "";
  @state() private _liveMode = false;
  @state() private _liveApp = "";
  @state() private _liveStatus: LiveStatusMap = {};
  @state() private _liveStages: LiveStageMap = {};
  @state() private _liveSnapshot?: AppStatus;
  @state() private _liveConnection: ConnectionState = "connecting";
  @state() private _liveApps: AppSummary[] = [];
  @state() private _refreshCooldown = false;

  private _client?: StatusClient;
  private _unsubscribe?: () => void;

  @query(".pipeline") private _pipelineEl!: HTMLElement;
  @query(".pipeline-rail") private _railEl!: HTMLElement;

  connectedCallback(): void {
    super.connectedCallback();
    this._initLiveMode();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  private _initLiveMode() {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const app = params.get("app");
    const repo = params.get("repo");
    if (!app && !repo) return; // static mode — no aggregator calls (FR8.1).
    this._liveMode = true;
    this._client = new StatusClient();

    if (app) {
      this._liveApp = app;
      void this._startSubscription(app);
      void this._fetchAppList();
      return;
    }
    if (repo) void this._resolveRepo(repo);
  }

  private async _fetchAppList() {
    try {
      const apps = await this._client!.list();
      this._liveApps = apps;
    } catch (err) {
      console.warn("status-aggregator: failed to list apps", err);
    }
  }

  private async _resolveRepo(repo: string) {
    try {
      const matches = await this._client!.list({ repo });
      if (matches.length === 1) {
        const url = new URL(window.location.href);
        url.searchParams.delete("repo");
        url.searchParams.set("app", matches[0].name);
        window.history.replaceState({}, "", url.toString());
        this._liveApp = matches[0].name;
        await this._startSubscription(matches[0].name);
        void this._fetchAppList();
      } else {
        this._liveApp = "";
        this._liveApps = matches;
      }
    } catch (err) {
      console.warn("status-aggregator: repo lookup failed", err);
      this._liveConnection = "closed";
    }
  }

  private async _startSubscription(app: string) {
    this._unsubscribe?.();
    this._unsubscribe = this._client!.subscribe(app, {
      onSnapshot: (snap) => this._applySnapshot(snap),
      onStageUpdate: (update) => {
        const n = stageNumberByKind[update.stage.kind as StageKind];
        if (!n) return;
        this._liveStatus = { ...this._liveStatus, [n]: update.stage.status };
        this._liveStages = { ...this._liveStages, [n]: update.stage };
        if (this._liveSnapshot) {
          this._liveSnapshot = StatusClient.applyStageUpdate(
            this._liveSnapshot,
            update,
          );
        }
      },
      onOverallUpdate: (overall) => {
        if (this._liveSnapshot) {
          this._liveSnapshot = { ...this._liveSnapshot, overall };
        }
      },
      onConnectionChange: (state) => {
        this._liveConnection = state;
      },
      onError: (err) => {
        console.warn("status-aggregator: stream error", err);
      },
    });
  }

  private _applySnapshot(snap: AppStatus) {
    this._liveSnapshot = snap;
    const statusMap: LiveStatusMap = {};
    const stageMap: LiveStageMap = {};
    for (const s of snap.stages) {
      const n = stageNumberByKind[s.kind as StageKind];
      if (!n) continue;
      statusMap[n] = s.status;
      stageMap[n] = s;
    }
    this._liveStatus = statusMap;
    this._liveStages = stageMap;
  }

  private _onRefreshRequest = async () => {
    if (!this._client || !this._liveApp || this._refreshCooldown) return;
    this._refreshCooldown = true;
    try {
      await this._client.refresh(this._liveApp);
    } finally {
      setTimeout(() => (this._refreshCooldown = false), 30_000);
    }
  };

  private _onExitLive = () => {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
    this._liveMode = false;
    this._liveApp = "";
    this._liveStatus = {};
    this._liveStages = {};
    this._liveSnapshot = undefined;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("app");
      url.searchParams.delete("repo");
      window.history.replaceState({}, "", url.toString());
    }
  };

  private _onAppSelect = (e: CustomEvent<{ name: string }>) => {
    const app = e.detail.name;
    if (!app || app === this._liveApp) return;
    this._liveApp = app;
    this._liveStatus = {};
    this._liveStages = {};
    this._liveSnapshot = undefined;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("app", app);
      window.history.replaceState({}, "", url.toString());
    }
    void this._startSubscription(app);
  };

  private _liveStageForActiveTooltip(): LiveStage | undefined {
    if (!this._liveMode) return undefined;
    const card = findCardByTooltip(this._activeTooltip);
    if (!card) return undefined;
    return this._liveStages[card.stageNumber];
  }

  private _onCardClick(e: CustomEvent) {
    this._activeTooltip = e.detail.tooltip;
  }

  private _onTooltipClose() {
    this._activeTooltip = "";
  }

  private _openTooltip(key: string) {
    this._activeTooltip = key;
  }

  /** Lookup helpers used by the feedback-arrow component. */
  private _getStageEl(title: string): HTMLElement | null {
    if (!this._railEl) return null;
    const el = this._railEl.querySelector<HTMLElement>(
      `workflow-stage[data-title="${CSS.escape(title)}"]`,
    );
    return el;
  }
  private _getPipelineContainer(): HTMLElement | null {
    return this._railEl ?? null;
  }

  private _renderLegendDot(color: string, label: string) {
    return html`
      <div class="legend-item">
        <div class="legend-dot" style="--dot-color:${color}; background:${color}"></div>
        ${label}
      </div>
    `;
  }

  private _renderLegendPill(color: string, label: string, caption: string) {
    return html`
      <div class="legend-item">
        <span class="legend-pill" style="--pill-color:${color}">${label}</span>
        ${caption}
      </div>
    `;
  }

  render() {
    return html`
      ${this._liveMode
        ? html`<status-banner
              .appName=${this._liveApp}
              .overall=${this._liveSnapshot?.overall}
              .connection=${this._liveConnection}
              .refreshDisabled=${this._refreshCooldown}
              @refresh-request=${this._onRefreshRequest}
              @exit-live-view=${this._onExitLive}
            ></status-banner>
            ${this._liveApps.length > 0
              ? html`<app-switcher
                  .apps=${this._liveApps}
                  .selected=${this._liveApp}
                  @app-select=${this._onAppSelect}
                ></app-switcher>`
              : nothing}`
        : nothing}
      <header>
        <h1>Forum Virium Helsinki — Project Lifecycle</h1>
        <p>From inception to sunset — the whole life of a service</p>
        <div class="header-note">
          Agentic-first: most code is written by AI agents (Claude Code,
          Gemini), reviewed by humans with automated gates
        </div>
      </header>

      <div class="legend">
        ${this._renderLegendPill("var(--badge-ai)", "AI", "AI-driven")}
        ${this._renderLegendPill(
          "var(--badge-gate)",
          "GATE",
          "Blocks on failure",
        )}
        ${this._renderLegendPill(
          "var(--badge-manual)",
          "MANUAL",
          "Human-operated today",
        )}
        ${this._renderLegendPill(
          "var(--badge-automatable)",
          "AUTOMATE",
          "Automation opportunity",
        )}
        ${this._renderLegendPill(
          "var(--badge-doc-gap)",
          "DOC",
          "Documentation gap",
        )}
      </div>

      <div class="section-label">
        Main pipeline — the full journey every service goes through
      </div>

      <div class="pipeline" @card-click=${this._onCardClick}>
        <div class="pipeline-rail">
          <!-- Top row: phase bands -->
          <div class="phase-row">
            ${phases.map((phase, phaseIdx) => {
              const phaseStages = stages.filter((s) => s.phase === phase.id);
              return html`
                ${phaseIdx > 0
                  ? html`<div class="phase-gap"></div>`
                  : null}
                <phase-band
                  .label=${phase.label}
                  .color=${phase.color}
                  .stageCount=${phaseStages.length}
                ></phase-band>
              `;
            })}
          </div>

          <!-- Bottom row: stages with inter-stage and inter-phase arrows -->
          <div class="stage-row">
            ${phases.map((phase, phaseIdx) => {
              const phaseStages = stages.filter((s) => s.phase === phase.id);
              return html`
                ${phaseIdx > 0
                  ? html`<pipeline-arrow></pipeline-arrow>`
                  : null}
                <div class="phase-stages">
                  ${phaseStages.map(
                    (stage, i) => html`
                      ${i > 0 ? html`<pipeline-arrow></pipeline-arrow>` : null}
                      <workflow-stage
                        data-title=${stage.title}
                        .number=${stage.number}
                        .stageTitle=${stage.title}
                        .color=${stage.color}
                        .cards=${stage.cards}
                        .status=${this._liveStatus[stage.number]}
                      ></workflow-stage>
                    `,
                  )}
                </div>
              `;
            })}
          </div>

          <!-- Feedback arrow overlays the rail, tracking Monitor → Develop -->
          <feedback-arrow
            .container=${() => this._getPipelineContainer()}
            .fromElement=${() => this._getStageEl("Monitor")}
            .toElement=${() => this._getStageEl("Develop")}
          ></feedback-arrow>
        </div>
      </div>

      <div class="bottom-sections">
        <!-- Quality & Security Gates -->
        <div class="flow-summary">
          <h2 class="section-heading" style="color:var(--accent-green)">
            All Quality & Security Gates
          </h2>
          <p class="section-subtitle">
            These checks run automatically. Code that fails a gate cannot be
            merged. Click any card above marked
            <span style="color:var(--accent-green);font-weight:600">GATE</span>
            for details.
          </p>
          <div class="gates-strip">
            ${gateChips.map(
              (chip) =>
                html`<span class="gate-chip ${chip.variant}"
                  >${chip.label}</span
                >`,
            )}
          </div>
        </div>

        <!-- AI Agent Layer -->
        <div class="flow-summary">
          <h2 class="section-heading" style="color:var(--accent-cyan)">
            AI Agent Layer — Claude & Gemini on GitHub
          </h2>
          <div
            class="flow-grid"
            style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))"
          >
            ${agentCards.map(
              (card) => html`
                <div
                  class="flow-card"
                  @click=${() => this._openTooltip(card.tooltip)}
                >
                  <h4>${card.title}</h4>
                  <p>${card.body}</p>
                </div>
              `,
            )}
          </div>
        </div>

        <!-- git-repo-agent -->
        <div
          class="agent-banner"
          @click=${() => this._openTooltip("gitrepoagent")}
        >
          <h3>git-repo-agent — Async Repository Quality Maintenance</h3>
          <p>
            A custom Claude Agent SDK application that autonomously maintains
            repository health across all projects. It runs independently of the
            normal development cycle — onboarding new repos, scoring health
            across 5 categories (docs, tests, security, quality, CI),
            auto-fixing safe issues, and diagnosing pipeline failures by
            correlating kubectl, ArgoCD, GitHub Actions, and Sentry data. Seven
            specialized subagents handle different aspects. The key value:
            repositories stay healthy even when no one is actively working on
            them.
          </p>
          <div class="gates-strip" style="margin-top:0.6rem">
            <span class="gate-chip ai">Onboard new repos</span>
            <span class="gate-chip ai">Health scoring</span>
            <span class="gate-chip ai">Auto-fix safe issues</span>
            <span class="gate-chip ai">Pipeline diagnostics</span>
            <span class="gate-chip ai">7 specialist subagents</span>
          </div>
        </div>

        <!-- Infrastructure Layer -->
        <div class="flow-summary">
          <h2 class="section-heading" style="color:var(--accent-purple)">
            Infrastructure Layer — managed separately via Terraform
          </h2>
          <div class="flow-grid">
            ${infraCards.map(
              (card) => html`
                <div
                  class="flow-card"
                  @click=${() => this._openTooltip(card.tooltip)}
                >
                  <h4>${card.title}</h4>
                  <p>${card.body}</p>
                </div>
              `,
            )}
          </div>
        </div>
      </div>

      <footer>
        Click any card for details. Unbadged cards are automated and documented
        by default — badges only appear where there is a gate, AI involvement,
        manual step, automation opportunity, or documentation gap worth
        surfacing.
      </footer>

      <workflow-tooltip
        .activeTooltip=${this._activeTooltip}
        .liveStage=${this._liveStageForActiveTooltip()}
        .liveEmpty=${this._liveMode && this._activeTooltip !== "" && !this._liveStageForActiveTooltip()}
        @tooltip-close=${this._onTooltipClose}
      ></workflow-tooltip>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "workflow-app": WorkflowApp;
  }
}

interface TooltipCardIndex {
  tooltip: string;
  stageNumber: number;
}

const cardIndex: TooltipCardIndex[] = stages.flatMap((s) =>
  s.cards.map((c) => ({ tooltip: c.tooltip, stageNumber: s.number })),
);

function findCardByTooltip(tooltip: string): TooltipCardIndex | undefined {
  if (!tooltip) return undefined;
  return cardIndex.find((c) => c.tooltip === tooltip);
}
