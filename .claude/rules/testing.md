# Testing Requirements

Project-specific testing rules for `dev-workflow-overview`.

## Status

This project does not yet have an automated test suite. Smoke testing relies on:

1. `bun run build` succeeds without TypeScript or Vite errors
2. `bun run dev` renders the workflow visualization without console errors
3. Visual inspection via the rendered SVG/HTML pipeline

## Adding Tests

When introducing tests, prefer:

- **Vitest** as the runner (Vite-native, minimal config)
- **@open-wc/testing** for Lit component tests (custom element fixtures)
- **Playwright** for end-to-end visual regression of the pipeline rendering

Reporter flags for context-efficient output:

```bash
vitest --reporter=dot --bail=1          # Fast fail, minimal output
vitest --reporter=github-actions        # One-line per failure with file:line
playwright test --reporter=line         # One line per test
```

## Pre-commit Checks

Until a full test suite exists, the minimum pre-commit verification is:

```bash
bun run build
```

This catches TypeScript errors, missing imports, and Vite build failures before they hit `main`.

## Coverage Expectations

- New Lit components: render test + property reactivity test
- Data modules (`src/data/`): smoke test confirming exports parse without throwing
- Build artifacts: verify `dist/` exists and contains an `index.html` after `bun run build`
