export interface TooltipDetail {
  text: string;
  gate?: boolean;
}

export interface TooltipData {
  title: string;
  subtitle: string;
  body: string;
  details: (string | TooltipDetail)[];
}

export const tooltips: Record<string, TooltipData> = {
  /* Stage 1: Develop */
  agentic: {
    title: "Agentic Development",
    subtitle: "Stage 1 — AI-first code generation",
    body: "Most code changes originate from AI agents rather than manual editing. Claude Code and Gemini CLI write code from GitHub issues, @-mentions, or direct prompts. The developer's role shifts to directing intent, reviewing output, and approving changes.",
    details: [
      "Claude Code runs in terminal or Cowork desktop app",
      "@claude on a GitHub issue triggers autonomous implementation",
      "Gemini CLI provides an alternative agent for code generation",
      "MCP integrations connect agents to Sentry, GitHub, and more",
      "Project rules in .claude/rules/ constrain agent behavior per repo",
    ],
  },
  plugins: {
    title: "Claude Plugins",
    subtitle: "Stage 1 — Standards enforcement at generation time",
    body: "60+ plugin skills guide AI agents as they write code. Instead of catching problems later in CI, the plugins ensure standards are followed during code generation — container patterns, commit conventions, testing strategies, Helm values, and more.",
    details: [
      "Plugins cover: git, containers, Terraform, Kubernetes, testing, CI/CD",
      "Skills like deploy-values.md teach Claude correct Helm patterns",
      "Pre-commit, conventional commits, and branch naming enforced inline",
      "Custom marketplace: laurigates/claude-plugins",
      "This is why human review can be quick — standards are built in",
    ],
  },
  skaffold: {
    title: "Skaffold Dev",
    subtitle: "Stage 1 — Local development loop",
    body: "For changes that need local testing, Skaffold watches source files and auto-redeploys to a local Kubernetes cluster via OrbStack. Changes appear in seconds.",
    details: [
      "File sync copies changed files without rebuilding the image",
      "OrbStack provides local K8s — access services via k8s.orb.local",
      "Mimics production environment for realistic local testing",
    ],
  },

  /* Stage 2: Commit & Push */
  precommit: {
    title: "Pre-commit Hooks",
    subtitle: "Stage 2 — Local quality gate",
    body: "Before any commit is created, pre-commit hooks catch issues locally. This prevents broken code from reaching GitHub and wasting CI minutes.",
    details: [
      {
        text: "Gitleaks scans for accidentally committed secrets",
        gate: true,
      },
      {
        text: "Terraform fmt/validate checks infrastructure code",
        gate: true,
      },
      { text: "YAML linting, Helm lint, Trivy IaC scanning", gate: true },
      { text: "Runs automatically — no developer action needed" },
    ],
  },
  conventional: {
    title: "Conventional Commits",
    subtitle: "Stage 2 — Structured commit messages",
    body: 'Every commit follows type(scope): description format. This drives automated versioning — "feat:" bumps minor, "fix:" bumps patch. AI agents follow this convention automatically via plugin rules.',
    details: [
      "feat: → minor version bump (new feature)",
      "fix: → patch version bump (bug fix)",
      "chore:, docs:, refactor: → no version bump",
      "BREAKING CHANGE in footer → major version bump",
      "PR titles also enforced — auto-fixed if wrong",
    ],
  },
  pr: {
    title: "Pull Request",
    subtitle: "Stage 2 — Review gate",
    body: "All changes to main go through a Pull Request. Opening a PR triggers the full suite of automated checks, AI review, and enables human review. This is the gateway to the release pipeline.",
    details: [
      "Opening a PR triggers all CI checks + Claude review automatically",
      "PR titles must follow conventional commit format",
      "Labels, assignees, and milestones tracked for hygiene",
      "GitHub Actions: 21 reusable workflows available",
    ],
  },

  /* Stage 3: AI Review */
  claudereview: {
    title: "Claude PR Review",
    subtitle: "Stage 3 — Automated code review",
    body: "Every PR is automatically reviewed by Claude when opened or updated. It examines the diff, checks against project rules, and leaves actionable review comments. Bot PRs and release-please PRs are skipped.",
    details: [
      "Triggers on PR open, synchronize, and reopen events",
      "Concurrent reviews with cancel-in-progress for rapid iteration",
      "Skips release-please PRs and bot-authored PRs",
      "Review prompt is configurable per repository",
      "Uses the same project rules that guided code generation",
    ],
  },
  conventionalfix: {
    title: "Conventional Commit Title Enforcer",
    subtitle: "Stage 3 — Auto-fix PR titles",
    body: "If a PR title doesn't follow conventional commit format, this workflow automatically fixes it. Since PR titles become commit messages on merge (and drive versioning), this ensures correct automated releases.",
    details: [
      "Runs on every PR open and title edit",
      "Rewrites titles to feat:, fix:, chore:, etc. format",
      "Critical for release-please to calculate version bumps correctly",
      "No manual intervention needed",
    ],
  },
  humanreview: {
    title: "Human Review",
    subtitle: "Stage 3 — Efficient oversight",
    body: "The developer reviews changes, but doesn't need to go line-by-line. Since Claude plugins enforce standards during generation and automated gates catch regressions, human review focuses on intent, architecture, and business logic.",
    details: [
      "Standards already enforced by 60+ plugin skills at generation time",
      "Security scanning, linting, and tests run in parallel",
      "Claude's PR review highlights key concerns",
      "Developer focuses on: does this solve the right problem?",
      "Much faster than traditional code review",
    ],
  },

  /* Stage 4: CI Gates */
  securitygates: {
    title: "Security Gates (3 workflows)",
    subtitle: "Stage 4 — Automated vulnerability detection",
    body: "Three specialized security scanning workflows run on every PR. Each targets a different attack surface. They can optionally block merges on critical findings.",
    details: [
      {
        text: "reusable-security-secrets.yml — leaked API keys, tokens, private keys, hardcoded credentials",
        gate: true,
      },
      {
        text: "reusable-security-deps.yml — dependency CVE audit via npm/bun/pip/cargo native tools",
        gate: true,
      },
      {
        text: "reusable-security-owasp.yml — OWASP Top 10 2021 static analysis (A01–A10)",
        gate: true,
      },
      {
        text: "All 3 use Claude (haiku model) to analyze results and comment on PRs",
      },
      { text: "Optional fail-on-high / fail-on-critical flags to block merges" },
    ],
  },
  qualitygates: {
    title: "Quality Gates (3 workflows)",
    subtitle: "Stage 4 — Code quality enforcement",
    body: "Three quality-focused workflows detect patterns that hurt maintainability. Each targets a specific class of issues found in real codebases.",
    details: [
      {
        text: "reusable-quality-code-smell.yml — long functions, deep nesting, magic numbers, empty catches",
        gate: true,
      },
      {
        text: "reusable-quality-async.yml — unhandled promise rejections, missing .catch(), fire-and-forget",
        gate: true,
      },
      {
        text: "reusable-quality-typescript.yml — explicit any, @ts-ignore, non-null assertions",
        gate: true,
      },
      { text: "Severity thresholds configurable per repo" },
      { text: "Outputs structured counts (TOTAL_ISSUES, HIGH_SEVERITY)" },
    ],
  },
  a11ygates: {
    title: "Accessibility Gates (2 workflows)",
    subtitle: "Stage 4 — Inclusive by default",
    body: "Two accessibility workflows ensure web applications meet standards. Running these in CI means accessibility is verified on every change, not just during periodic audits.",
    details: [
      {
        text: "reusable-a11y-aria.yml — validates ARIA role values, required attributes, state management",
        gate: true,
      },
      {
        text: "reusable-a11y-wcag.yml — WCAG 2.1 Levels A, AA, AAA: contrast, keyboard, focus visible",
        gate: true,
      },
      {
        text: "Outputs: TOTAL_ISSUES, CRITICAL_ISSUES, LEVEL_A, LEVEL_AA counts",
      },
    ],
  },

  /* Stage 5: Release */
  releaseplease: {
    title: "release-please",
    subtitle: "Stage 5 — Automated versioning",
    body: "When commits land on main, release-please reads conventional commit messages and creates a Release PR with the correct version bump and generated changelog. Merging it publishes a GitHub Release.",
    details: [
      "Changelog auto-generated from commit messages",
      "Supports linked versions across monorepo packages",
      "Manages extra-files for version references in configs",
      "Tag format: .*-v(\\d+.\\d+.\\d+) for Docker metadata",
    ],
  },
  containerbuild: {
    title: "Container Build",
    subtitle: "Stage 5 — Build-once pattern",
    body: "When a release-please PR is open, a pre-release image is built with :next-{version} tag and pushed to GHCR. This means the image is ready before the release is even approved.",
    details: [
      { text: "Multi-stage Dockerfiles for minimal, secure images" },
      { text: "Non-root users enforced in all containers", gate: true },
      { text: "Trivy scans the final image for vulnerabilities", gate: true },
      { text: "Images pushed to ghcr.io/forumviriumhelsinki/*" },
    ],
  },
  promote: {
    title: "Image Promotion",
    subtitle: "Stage 5 — Seconds, not minutes",
    body: "When the Release PR merges and a GitHub Release is published, the pre-built :next image is retagged with the final semver version. No rebuild — just a manifest-only retag operation.",
    details: [
      "Tags: :latest, :1.2.3, :1.2, :1, :sha-abc1234",
      "Falls back to full rebuild if pre-built not found",
      "Cosign signs the released image",
      "Release takes seconds instead of minutes",
    ],
  },

  /* Stage 6: Deploy */
  imageupdater: {
    title: "ArgoCD Image Updater",
    subtitle: "Stage 6 — Zero-touch deployment",
    body: "Image Updater watches GHCR continuously. When a new semver tag appears, it commits the updated tag to the app repo's deploy/values.yaml. An auto-merge workflow merges it immediately.",
    details: [
      'Commit message: "build: automatic update of {app}"',
      "Updates image.tag in deploy/values.yaml",
      "Auto-merge workflow merges these commits immediately",
      "No human intervention for routine deployments",
    ],
  },
  argocd: {
    title: "ArgoCD (GitOps)",
    subtitle: "Stage 6 — Declarative deployment",
    body: "ArgoCD watches Git and ensures the Kubernetes cluster matches the desired state. If someone changes something manually, ArgoCD reverts it. The infrastructure repo defines all apps via the App of Apps pattern.",
    details: [
      "Multi-source: Helm chart from GHCR + values from app repo",
      "Automatic sync ensures cluster always matches Git",
      "AppProject RBAC controls namespace and resource access",
      "Drift detection reverts manual changes",
    ],
  },
  helm: {
    title: "Helm Charts",
    subtitle: "Stage 6 — Shared templates",
    body: "The helm-webapp chart provides a standard template for all web applications. Each app just provides its own values.yaml. Charts are versioned OCI artifacts stored in GHCR.",
    details: [
      "helm-webapp is the primary shared chart",
      "Supports ingress, secrets, probes, autoscaling, and more",
      "Renovate keeps chart versions current in infrastructure repo",
      "Charts tested via chart-testing (ct.yaml) in CI",
    ],
  },

  /* Stage 7: Run */
  gke: {
    title: "GKE Autopilot",
    subtitle: "Stage 7 — Managed Kubernetes",
    body: "Applications run on GKE Autopilot. Google manages nodes, scaling, and cluster health — the team focuses on applications.",
    details: [
      "Autopilot = Google manages nodes and scaling automatically",
      "Envoy Gateway handles ingress (migrating from NGINX)",
      "Workload Identity connects pods to GCP securely",
      "Cloud SQL provides managed PostgreSQL",
    ],
  },
  secrets: {
    title: "Secrets & Config",
    subtitle: "Stage 7 — No secrets in Git",
    body: "Secrets live in Google Secret Manager. External Secrets Operator syncs them into Kubernetes Secrets automatically. Kyverno auto-injects imagePullSecrets.",
    details: [
      "Google Secret Manager is the single source for secrets",
      "External Secrets Operator creates K8s Secrets from GSM",
      "Workload Identity authenticates pods to GCP",
      "Kyverno auto-injects imagePullSecrets for GHCR",
    ],
  },
  featureflags: {
    title: "Feature Flags",
    subtitle: "Stage 7 — Safe rollouts",
    body: "GoFeatureFlag enables gradual rollouts without redeploying. Features can be toggled or rolled out to a percentage of users.",
    details: [
      "Self-hosted GoFeatureFlag (no vendor lock-in)",
      "OpenFeature SDK — standard API for flag evaluation",
      "Replaces environment-variable feature toggles",
      "Enables canary releases and A/B testing",
    ],
  },

  /* Stage 8: Monitor */
  sentry: {
    title: "Sentry",
    subtitle: "Stage 8 — Error monitoring",
    body: "Sentry captures runtime errors, performance issues, and unhandled exceptions. Each app has its own Sentry project, provisioned via Terraform.",
    details: [
      "Real-time alerts with full stack traces",
      "Performance monitoring with transaction tracing",
      "Sentry projects managed via Terraform workspace",
      "MCP integration lets Claude query Sentry directly",
    ],
  },
  kyverno: {
    title: "Kyverno Policies",
    subtitle: "Stage 8 — Runtime security gate",
    body: "Kyverno validates and mutates resources inside the cluster. Non-compliant deployments are blocked before they can run.",
    details: [
      { text: "Validates containers don't run as root", gate: true },
      { text: "Enforces resource limits and security contexts", gate: true },
      { text: "Blocks non-compliant deployments", gate: true },
      { text: "Auto-injects imagePullSecrets for GHCR" },
    ],
  },
  autofix: {
    title: "Auto-Fix Agent",
    subtitle: "Stage 8 — Self-healing CI",
    body: "When a GitHub Actions workflow fails, this reusable workflow triggers Claude to analyze the failure logs. For auto-fixable issues (lint, type errors, formatting), it commits a fix. For design issues, it opens a GitHub issue with analysis.",
    details: [
      "Triggered by workflow_run failure event",
      "Auto-fixes: linting, type errors, formatting issues",
      "Opens issues for: infrastructure, permissions, design problems",
      "Flood guard: max 2 open auto-fix PRs at a time",
      "Deduplication: skips if recent fix(auto): commit exists",
      "Commits use fix(auto): prefix for traceability",
    ],
  },

  /* AI Agent Layer */
  claudemention: {
    title: "@claude on Issues & PRs",
    subtitle: "AI Agent Layer — Interactive coding",
    body: "Mention @claude on any GitHub issue or PR comment and it starts working autonomously. It reads the context, writes code, commits partial progress, and asks for feedback. Each invocation gets up to 30 turns.",
    details: [
      "Works on issues (implement feature) and PRs (address feedback)",
      "Commits partial progress mid-task for visibility",
      'If it exhausts turns, posts a "continue" prompt for follow-up',
      "Has write access to contents, PRs, and issues",
      "Configurable runner and max_turns per repo",
    ],
  },
  claudereviewdetail: {
    title: "Automated PR Review",
    subtitle: "AI Agent Layer — Every PR reviewed",
    body: "A reusable workflow that automatically reviews every PR when opened or updated. It checks the diff against project rules and leaves review comments. Cancel-in-progress means rapid pushes don't stack up reviews.",
    details: [
      "Triggers: opened, synchronize, reopened",
      "Skips release-please PRs and bot authors by default",
      "Configurable: skip_release_please, skip_bots, review_prompt",
      "Concurrent with cancel-in-progress for fast feedback",
    ],
  },
  autofixdetail: {
    title: "Auto-Fix Workflow",
    subtitle: "AI Agent Layer — Self-healing CI",
    body: "Analyzes failed workflow runs, determines if the issue is auto-fixable, applies the fix and pushes, or opens a GitHub issue with detailed analysis for issues that need human decision-making.",
    details: [
      "Auto-fixable: linting, type errors, formatting, import ordering",
      "Not auto-fixable: infra issues, permission errors, design decisions",
      "Flood guard: configurable max open auto-fix PRs (default 2)",
      "Dedup: skips if recent fix(auto): commit exists",
      "Commits with fix(auto): prefix for traceability",
    ],
  },
  rulesync: {
    title: "AI Rules Sync",
    subtitle: "AI Agent Layer — One source of truth",
    body: "Canonical coding rules live in .rulesync/rules/ in the .github repo. A sync workflow generates tool-specific configs for Claude Code (.claude/rules/), Gemini (.gemini/memories/), GitHub Copilot, and Cursor — then opens a PR if anything changed.",
    details: [
      "Source: ForumViriumHelsinki/.github/.rulesync/rules/",
      "Targets: Claude Code, Gemini CLI, GitHub Copilot, Cursor",
      "Keeps all AI tools aligned on the same standards",
      "Auto-creates PR when rules change",
    ],
  },

  /* git-repo-agent */
  gitrepoagent: {
    title: "git-repo-agent",
    subtitle: "Async Quality Maintenance — Claude Agent SDK",
    body: "A custom CLI tool built on the Claude Agent SDK that maintains repository health autonomously. It runs outside the normal development cycle — onboarding new repos with standards, auditing existing ones, and diagnosing pipeline failures.",
    details: [
      "Onboard mode: analyze tech stack → init blueprint → configure standards → generate docs → create PR",
      "Maintain mode: score health 0–100 across docs, tests, security, quality, CI → auto-fix safe issues",
      "Diagnose mode: correlate errors from kubectl, ArgoCD, GitHub Actions, Sentry, Chrome DevTools",
      "Health mode: quick local scoring without API calls",
      "7 subagents: blueprint, configure, quality, security, docs, test-runner, diagnose",
      "Safety hooks block: force push to protected branches, .env modification, unsafe rm -rf",
      "Built with Python + Typer + Rich, installable via uv tool install",
    ],
  },

  /* Infrastructure Layer */
  terraform: {
    title: "Terraform Cloud",
    subtitle: "Infrastructure Layer — IaC",
    body: "5 Terraform Cloud workspaces manage all infrastructure as code. Changes follow plan → review → apply with full audit trail.",
    details: [
      "infrastructure-github: repos, teams, secrets, GHCR auth",
      "infrastructure-gcp: Cloud SQL, Secrets, DNS, Workload Identity",
      "infrastructure-sentry: Sentry projects per application",
      "infrastructure-onelogin: SSO configuration",
      "infrastructure-twingate: Zero Trust network access",
    ],
  },
  renovate: {
    title: "Renovate Bot",
    subtitle: "Infrastructure Layer — Dependency automation",
    body: "Self-hosted Renovate runs only in the infrastructure repo (not per-app, saving ~1000 monthly CI minutes). It keeps Helm charts, GitHub Actions, and Terraform providers up to date.",
    details: [
      "Self-hosted in infrastructure repo (centralized)",
      "Updates Helm chart versions in ArgoCD manifests",
      "Pins GitHub Actions to SHA for security",
      "Updates Terraform provider versions",
    ],
  },
  reusableworkflows: {
    title: "21 Reusable Workflows",
    subtitle: "Infrastructure Layer — Centralized CI",
    body: "The .github org repo provides 21 reusable workflow templates. App repos call these with minimal config. One update to a template improves every repository at once.",
    details: [
      "Release: release-please, container-build, container-release, image-updater auto-merge",
      "Claude: @-mention handler, PR review, auto-fix, rules sync",
      "Security: secrets scan, dependency audit, OWASP analysis",
      "Quality: code smells, async patterns, TypeScript strictness",
      "Accessibility: ARIA validation, WCAG compliance",
      "Maintenance: conflict resolution, conventional commit enforcement",
    ],
  },
};
