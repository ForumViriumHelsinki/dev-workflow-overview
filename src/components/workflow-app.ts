import { LitElement, css, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { theme } from "../styles/theme.js";
import {
  stages,
  gateChips,
  agentCards,
  infraCards,
} from "../data/stages.js";
import "./workflow-stage.js";
import "./workflow-card.js";
import "./workflow-tooltip.js";
import "./pipeline-arrow.js";

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
        gap: 1.4rem;
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

      /* Pipeline */
      .pipeline {
        display: flex;
        align-items: flex-start;
        gap: 0;
        padding: 1.2rem 1.5rem 1.8rem;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
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
        opacity: 0.5;
        border-top: 1px solid var(--border-subtle);
        max-width: 1100px;
        margin: 0 auto;
      }

      /* Responsive */
      @media (max-width: 900px) {
        .pipeline {
          padding: 1rem 0.5rem 1.5rem;
        }
        workflow-stage {
          width: 180px;
        }
      }
    `,
  ];

  @state() private _activeTooltip = "";

  private _onCardClick(e: CustomEvent) {
    this._activeTooltip = e.detail.tooltip;
  }

  private _onTooltipClose() {
    this._activeTooltip = "";
  }

  private _openTooltip(key: string) {
    this._activeTooltip = key;
  }

  private _renderLegendDot(color: string, label: string) {
    return html`
      <div class="legend-item">
        <div class="legend-dot" style="--dot-color:${color}; background:${color}"></div>
        ${label}
      </div>
    `;
  }

  render() {
    return html`
      <header>
        <h1>Forum Virium Helsinki — Development Workflow</h1>
        <p>The journey of a code change from intent to production</p>
        <div class="header-note">
          Agentic-first: most code is written by AI agents (Claude Code,
          Gemini), reviewed by humans with automated gates
        </div>
      </header>

      <div class="legend">
        ${this._renderLegendDot("var(--accent-cyan)", "AI agents")}
        ${this._renderLegendDot("var(--accent-green)", "Quality / security gates")}
        ${this._renderLegendDot("var(--accent-blue)", "Developer tools")}
        ${this._renderLegendDot("var(--accent-purple)", "Infrastructure")}
        ${this._renderLegendDot("var(--accent-orange)", "Runtime")}
        ${this._renderLegendDot("var(--accent-pink)", "Monitoring")}
      </div>

      <div class="section-label">
        Main pipeline — the path every change follows
      </div>

      <div class="pipeline" @card-click=${this._onCardClick}>
        ${stages.map(
          (stage, i) => html`
            ${i > 0 ? html`<pipeline-arrow></pipeline-arrow>` : null}
            <workflow-stage
              .number=${stage.number}
              .stageTitle=${stage.title}
              .color=${stage.color}
              .cards=${stage.cards}
            ></workflow-stage>
          `,
        )}
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
        Click any card for details &middot; Cards marked GATE block merges if
        they fail &middot; Cards marked AI are powered by Claude or Gemini
      </footer>

      <workflow-tooltip
        .activeTooltip=${this._activeTooltip}
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
