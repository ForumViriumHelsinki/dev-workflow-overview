export interface CardData {
  icon: string;
  name: string;
  role: string;
  tooltip: string;
  highlight?: "gate" | "ai";
}

export interface StageData {
  number: number;
  title: string;
  color: string;
  cards: CardData[];
}

export const stages: StageData[] = [
  {
    number: 1,
    title: "Develop",
    color: "var(--accent-cyan)",
    cards: [
      {
        icon: "robot",
        name: "Claude Code / Gemini",
        role: "Agents write code from issues, prompts, or @-mentions",
        tooltip: "agentic",
        highlight: "ai",
      },
      {
        icon: "puzzle",
        name: "Claude Plugins",
        role: "60+ skills enforce standards as code is generated",
        tooltip: "plugins",
      },
      {
        icon: "refresh",
        name: "Skaffold Dev",
        role: "Live-reload in a local K8s cluster",
        tooltip: "skaffold",
      },
    ],
  },
  {
    number: 2,
    title: "Commit & Push",
    color: "var(--accent-blue)",
    cards: [
      {
        icon: "shield",
        name: "Pre-commit Hooks",
        role: "Lint, format, scan secrets locally",
        tooltip: "precommit",
        highlight: "gate",
      },
      {
        icon: "document",
        name: "Conventional Commits",
        role: "feat:, fix:, chore: drives auto-versioning",
        tooltip: "conventional",
      },
      {
        icon: "merge",
        name: "Pull Request",
        role: "Review gate — triggers all checks",
        tooltip: "pr",
      },
    ],
  },
  {
    number: 3,
    title: "AI Review",
    color: "var(--accent-cyan)",
    cards: [
      {
        icon: "eye",
        name: "Claude PR Review",
        role: "Auto-reviews every PR on open/sync",
        tooltip: "claudereview",
        highlight: "ai",
      },
      {
        icon: "pencil",
        name: "Title Enforcer",
        role: "Auto-fixes PR titles to conventional format",
        tooltip: "conventionalfix",
        highlight: "ai",
      },
      {
        icon: "user",
        name: "Human Review",
        role: "Quick scan — standards are already enforced",
        tooltip: "humanreview",
      },
    ],
  },
  {
    number: 4,
    title: "CI Gates",
    color: "var(--accent-green)",
    cards: [
      {
        icon: "lock",
        name: "Security Gates (3)",
        role: "Secrets, dependency CVEs, OWASP Top 10",
        tooltip: "securitygates",
        highlight: "gate",
      },
      {
        icon: "check",
        name: "Quality Gates (3)",
        role: "Code smells, async patterns, TS strictness",
        tooltip: "qualitygates",
        highlight: "gate",
      },
      {
        icon: "accessibility",
        name: "Accessibility Gates (2)",
        role: "ARIA correctness, WCAG 2.1 compliance",
        tooltip: "a11ygates",
        highlight: "gate",
      },
    ],
  },
  {
    number: 5,
    title: "Release",
    color: "var(--accent-green)",
    cards: [
      {
        icon: "tag",
        name: "release-please",
        role: "Auto version bump + changelog from commits",
        tooltip: "releaseplease",
      },
      {
        icon: "package",
        name: "Container Build",
        role: "Docker image built + pushed to GHCR",
        tooltip: "containerbuild",
      },
      {
        icon: "rocket",
        name: "Image Promotion",
        role: "Retag :next → semver in seconds",
        tooltip: "promote",
      },
    ],
  },
  {
    number: 6,
    title: "Deploy",
    color: "var(--accent-purple)",
    cards: [
      {
        icon: "cycle",
        name: "Image Updater",
        role: "Detects new image, commits tag to repo",
        tooltip: "imageupdater",
      },
      {
        icon: "target",
        name: "ArgoCD (GitOps)",
        role: "Syncs Git state to Kubernetes cluster",
        tooltip: "argocd",
      },
      {
        icon: "helm",
        name: "Helm Charts",
        role: "Shared templates for all applications",
        tooltip: "helm",
      },
    ],
  },
  {
    number: 7,
    title: "Run",
    color: "var(--accent-orange)",
    cards: [
      {
        icon: "cloud",
        name: "GKE Autopilot",
        role: "Managed Kubernetes on Google Cloud",
        tooltip: "gke",
      },
      {
        icon: "key",
        name: "Secrets & Config",
        role: "Google Secret Manager + External Secrets",
        tooltip: "secrets",
      },
      {
        icon: "flag",
        name: "Feature Flags",
        role: "GoFeatureFlag for safe rollouts",
        tooltip: "featureflags",
      },
    ],
  },
  {
    number: 8,
    title: "Monitor",
    color: "var(--accent-pink)",
    cards: [
      {
        icon: "bug",
        name: "Sentry",
        role: "Error tracking + performance monitoring",
        tooltip: "sentry",
      },
      {
        icon: "clipboard",
        name: "Kyverno Policies",
        role: "Runtime security enforcement in cluster",
        tooltip: "kyverno",
        highlight: "gate",
      },
      {
        icon: "wrench",
        name: "Auto-Fix Agent",
        role: "Claude auto-fixes CI failures or files issues",
        tooltip: "autofix",
        highlight: "ai",
      },
    ],
  },
];

export const gateChips = [
  { label: "Secrets scan", variant: "security" as const },
  { label: "Dependency CVEs", variant: "security" as const },
  { label: "OWASP Top 10", variant: "security" as const },
  { label: "Trivy image scan", variant: "security" as const },
  { label: "Tests pass", variant: "default" as const },
  { label: "Lint clean", variant: "default" as const },
  { label: "Code smell check", variant: "default" as const },
  { label: "Async pattern check", variant: "default" as const },
  { label: "TypeScript strictness", variant: "default" as const },
  { label: "ARIA correctness", variant: "default" as const },
  { label: "WCAG 2.1 compliance", variant: "default" as const },
  { label: "Pre-commit hooks", variant: "default" as const },
  { label: "Conventional commit titles", variant: "default" as const },
  { label: "Kyverno (runtime)", variant: "security" as const },
];

export const agentCards = [
  {
    title: "@claude on Issues/PRs",
    body: "Mention @claude on any issue or PR and it starts working — writes code, commits progress, asks for feedback. Up to 30 turns per invocation.",
    tooltip: "claudemention",
  },
  {
    title: "Auto PR Review",
    body: "Every PR is automatically reviewed by Claude on open and sync. Skips bot PRs and release-please PRs. Runs concurrently.",
    tooltip: "claudereviewdetail",
  },
  {
    title: "Auto-Fix Failures",
    body: "When CI fails, Claude analyzes logs, applies fixes for lint/type/format errors, and opens issues for design problems. Flood guard limits to 2 open fix PRs.",
    tooltip: "autofixdetail",
  },
  {
    title: "AI Rules Sync",
    body: "Canonical rules in .rulesync/ are auto-synced to Claude Code, Gemini, Copilot, and Cursor configs. One source of truth for all AI tools.",
    tooltip: "rulesync",
  },
];

export const infraCards = [
  {
    title: "Terraform Cloud",
    body: "5 workspaces manage GCP, GitHub, Sentry, OneLogin, and Twingate. Changes go through plan → review → apply.",
    tooltip: "terraform",
  },
  {
    title: "Renovate Bot",
    body: "Self-hosted in infrastructure repo. Keeps Helm charts, Actions versions, and Terraform providers current.",
    tooltip: "renovate",
  },
  {
    title: "21 Reusable Workflows",
    body: "Central .github repo provides all CI templates. One update improves every repo. No per-repo CI maintenance.",
    tooltip: "reusableworkflows",
  },
];
