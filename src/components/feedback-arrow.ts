import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { theme } from "../styles/theme.js";

/**
 * Feedback arrow — a curved SVG that loops from Monitor back to Develop to
 * visualize the operate → next-iteration cycle. Positioned as an absolute
 * overlay inside the pipeline container, tracking the live bounding-boxes of
 * the two anchor stages via ResizeObserver + scroll events.
 */
@customElement("feedback-arrow")
export class FeedbackArrow extends LitElement {
  static styles = [
    theme,
    css`
      :host {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      svg {
        position: absolute;
        top: 0;
        left: 0;
        overflow: visible;
        color: color-mix(in srgb, var(--accent-cyan), transparent 30%);
      }

      .path {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-dasharray: 6 4;
        stroke-linecap: round;
      }

      .label {
        fill: var(--accent-cyan);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        pointer-events: none;
      }

      .label-bg {
        fill: var(--bg);
        stroke: color-mix(in srgb, var(--accent-cyan), transparent 60%);
        stroke-width: 1;
        rx: 4;
      }
    `,
  ];

  /**
   * Functions returning the live bounding rects of the two anchor elements.
   * Computed by the parent (workflow-app) so this component stays agnostic
   * about how the stages are looked up in the shadow DOM.
   */
  @property({ attribute: false })
  fromElement: (() => HTMLElement | null) | null = null;

  @property({ attribute: false })
  toElement: (() => HTMLElement | null) | null = null;

  /** Container used for coordinate translation (the pipeline). */
  @property({ attribute: false })
  container: (() => HTMLElement | null) | null = null;

  @state() private _geom: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    width: number;
    height: number;
  } | null = null;

  private _resizeObserver: ResizeObserver | null = null;
  private _scrollTarget: HTMLElement | null = null;
  private _rafHandle = 0;

  connectedCallback() {
    super.connectedCallback();
    this._onWindowResize = this._onWindowResize.bind(this);
    this._onScroll = this._onScroll.bind(this);
    window.addEventListener("resize", this._onWindowResize);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this._onWindowResize);
    this._scrollTarget?.removeEventListener("scroll", this._onScroll);
    this._resizeObserver?.disconnect();
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
  }

  firstUpdated() {
    this._wireUp();
    this._scheduleRecompute();
  }

  updated() {
    this._wireUp();
  }

  private _wireUp() {
    const container = this.container?.() ?? null;
    if (container && container !== this._scrollTarget) {
      this._scrollTarget?.removeEventListener("scroll", this._onScroll);
      this._scrollTarget = container;
      container.addEventListener("scroll", this._onScroll, { passive: true });

      this._resizeObserver?.disconnect();
      this._resizeObserver = new ResizeObserver(() =>
        this._scheduleRecompute(),
      );
      this._resizeObserver.observe(container);
    }
  }

  private _onWindowResize() {
    this._scheduleRecompute();
  }

  private _onScroll() {
    this._scheduleRecompute();
  }

  private _scheduleRecompute() {
    if (this._rafHandle) cancelAnimationFrame(this._rafHandle);
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = 0;
      this._recompute();
    });
  }

  private _recompute() {
    const from = this.fromElement?.() ?? null;
    const to = this.toElement?.() ?? null;
    const container = this.container?.() ?? null;
    if (!from || !to || !container) {
      this._geom = null;
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();

    // Translate into container-local coordinates, adjusted for scroll.
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    this._geom = {
      fromX: fromRect.right - containerRect.left + scrollLeft,
      fromY: fromRect.bottom - containerRect.top + scrollTop,
      toX: toRect.left - containerRect.left + scrollLeft,
      toY: toRect.bottom - containerRect.top + scrollTop,
      width: container.scrollWidth,
      height: container.scrollHeight,
    };
  }

  render() {
    const g = this._geom;
    if (!g) return html``;

    // Arc dropping below the pipeline and looping back.
    const dropY = Math.max(g.fromY, g.toY) + 56;
    const path = `M ${g.fromX} ${g.fromY}
                  C ${g.fromX} ${dropY}, ${g.toX} ${dropY}, ${g.toX} ${g.toY}`;

    // Label placed at the bottom of the arc.
    const labelX = (g.fromX + g.toX) / 2;
    const labelY = dropY + 4;
    const label = "operate loop";
    const labelWidth = 88;

    return html`
      <svg
        width=${g.width}
        height=${g.height + 80}
        viewBox="0 0 ${g.width} ${g.height + 80}"
      >
        <defs>
          <marker
            id="fb-head"
            viewBox="0 0 10 10"
            refX="7"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M 0 0 L 8 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        <path class="path" d=${path} marker-end="url(#fb-head)" />
        <rect
          class="label-bg"
          x=${labelX - labelWidth / 2}
          y=${labelY - 12}
          width=${labelWidth}
          height="18"
          rx="9"
        />
        <text class="label" x=${labelX} y=${labelY} text-anchor="middle">
          ${label}
        </text>
      </svg>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "feedback-arrow": FeedbackArrow;
  }
}
