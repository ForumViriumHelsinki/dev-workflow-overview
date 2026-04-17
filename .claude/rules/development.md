# Development Workflow

Project-specific development rules for `dev-workflow-overview` (Vite + Lit + TypeScript + Bun).

## Build & Run

| Task | Command |
|------|---------|
| Install dependencies | `bun install` |
| Dev server | `bun run dev` |
| Production build | `bun run build` |
| Preview build | `bun run preview` |

## TDD Workflow

Follow RED -> GREEN -> REFACTOR:
1. Write a failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green

## Commit Conventions

Use conventional commits: `type(scope): description`

Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`

Common scopes (this project): `workflow-app`, `pipeline`, `tooltip`, `data`, `theme`, `build`

## Component Conventions (Lit)

- One component per file under `src/components/`
- Filename matches the custom element tag (kebab-case): `workflow-stage.ts` -> `<workflow-stage>`
- Use `@customElement('tag-name')` decorator
- Define reactive state via `@state()`, public API via `@property()`
- Co-locate styles with the component using `static styles = css\`...\``

## Data Layout

- Static workflow content lives in `src/data/` (`stages.ts`, `tooltips.ts`)
- Components consume data via imports rather than fetching at runtime
- Theme tokens live in `src/styles/theme.ts`

## TypeScript

- Strict mode enabled via `tsconfig.json`
- Prefer explicit types on exported APIs
- Avoid `any` - use `unknown` and narrow when types are uncertain
