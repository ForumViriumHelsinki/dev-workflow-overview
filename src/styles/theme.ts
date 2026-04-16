import { css } from "lit";

export const theme = css`
  :host {
    --bg: #0d1117;
    --bg-elevated: #161b22;
    --surface: #1c2333;
    --surface-hover: #262f40;
    --surface-active: #2d3a4f;
    --border: #30363d;
    --border-subtle: #21262d;
    --text: #e6edf3;
    --text-secondary: #b1bac4;
    --text-muted: #7d8590;
    --accent-blue: #58a6ff;
    --accent-green: #3fb950;
    --accent-purple: #bc8cff;
    --accent-orange: #f0883e;
    --accent-pink: #f778ba;
    --accent-cyan: #39d2f5;
    --accent-yellow: #e3b341;
    --accent-red: #f85149;

    /* Indicator badge tokens */
    --badge-gate: var(--accent-green);
    --badge-ai: var(--accent-cyan);
    --badge-manual: var(--accent-orange);
    --badge-automatable: var(--accent-purple);
    --badge-doc-gap: var(--accent-yellow);
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
    --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.4);
    --shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.5);
    --transition: 180ms ease;

    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
    color: var(--text);
  }
`;
