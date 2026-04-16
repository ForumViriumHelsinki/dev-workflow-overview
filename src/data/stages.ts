export type Indicator = "ai" | "gate" | "manual" | "automatable" | "doc-gap";
export type PhaseId =
  | "setup"
  | "build"
  | "ship"
  | "run"
  | "evolve"
  | "sunset";

export interface CardData {
  icon: string;
  name: string;
  role: string;
  tooltip: string;
  indicators?: Indicator[];
}

export interface StageData {
  number: number;
  title: string;
  color: string;
  phase: PhaseId;
  cards: CardData[];
}

export interface PhaseDef {
  id: PhaseId;
  label: string;
  color: string;
  description?: string;
}

export const phases: PhaseDef[] = [
  {
    id: "setup",
    label: "Setup",
    color: "var(--accent-yellow)",
    description: "Inception and provisioning — before code exists",
  },
  {
    id: "build",
    label: "Build",
    color: "var(--accent-blue)",
    description: "Author, review, and gate every change",
  },
  {
    id: "ship",
    label: "Ship",
    color: "var(--accent-green)",
    description: "Version, build, and deploy artifacts",
  },
  {
    id: "run",
    label: "Run",
    color: "var(--accent-orange)",
    description: "Serve traffic, operate, and observe in production",
  },
  {
    id: "evolve",
    label: "Evolve",
    color: "var(--accent-purple)",
    description: "Plan and execute significant change",
  },
  {
    id: "sunset",
    label: "Sunset",
    color: "var(--accent-pink)",
    description: "Deprecate services and retire infrastructure",
  },
];

export const stages: StageData[] = [
  /* ─────────────── SETUP ─────────────── */
  {
    number: 1,
    title: "Inception",
    color: "var(--accent-yellow)",
    phase: "setup",
    cards: [
      {
        icon: "clipboard",
        name: "Kick-off Brief",
        role: "Stakeholders, goals, scope captured before coding",
        tooltip: "kickoff",
        indicators: ["manual", "doc-gap"],
      },
      {
        icon: "document",
        name: "PRD / ADR",
        role: "Requirements and architecture decisions recorded",
        tooltip: "prdadr",
        indicators: ["manual", "doc-gap"],
      },
      {
        icon: "kanban",
        name: "Project Board",
        role: "GitHub Project links issues to org-wide roadmap",
        tooltip: "projectboard",
        indicators: ["manual"],
      },
    ],
  },
  {
    number: 2,
    title: "Provision",
    color: "var(--accent-yellow)",
    phase: "setup",
    cards: [
      {
        icon: "template",
        name: "Repo from Template",
        role: "Scaffolded from org template with standard CI wired",
        tooltip: "repoprovision",
        indicators: ["automatable"],
      },
      {
        icon: "cloud",
        name: "GCP + CloudSQL + DNS",
        role: "Issue templates request infrastructure; Terraform applies",
        tooltip: "gcpprovision",
        indicators: ["manual", "gate"],
      },
      {
        icon: "target",
        name: "ArgoCD Application",
        role: "App manifest added to infrastructure repo for GitOps",
        tooltip: "argocdprovision",
        indicators: ["automatable"],
      },
    ],
  },

  /* ─────────────── BUILD ─────────────── */
  {
    number: 3,
    title: "Develop",
    color: "var(--accent-cyan)",
    phase: "build",
    cards: [
      {
        icon: "robot",
        name: "Claude Code / Gemini",
        role: "Agents write code from issues, prompts, or @-mentions",
        tooltip: "agentic",
        indicators: ["ai"],
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
    number: 4,
    title: "Commit & Push",
    color: "var(--accent-blue)",
    phase: "build",
    cards: [
      {
        icon: "shield",
        name: "Pre-commit Hooks",
        role: "Lint, format, scan secrets locally",
        tooltip: "precommit",
        indicators: ["gate"],
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
    number: 5,
    title: "AI Review",
    color: "var(--accent-cyan)",
    phase: "build",
    cards: [
      {
        icon: "eye",
        name: "Claude PR Review",
        role: "Auto-reviews every PR on open/sync",
        tooltip: "claudereview",
        indicators: ["ai"],
      },
      {
        icon: "pencil",
        name: "Title Enforcer",
        role: "Auto-fixes PR titles to conventional format",
        tooltip: "conventionalfix",
        indicators: ["ai"],
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
    number: 6,
    title: "CI Gates",
    color: "var(--accent-green)",
    phase: "build",
    cards: [
      {
        icon: "lock",
        name: "Security Gates (3)",
        role: "Secrets, dependency CVEs, OWASP Top 10",
        tooltip: "securitygates",
        indicators: ["gate"],
      },
      {
        icon: "check",
        name: "Quality Gates (3)",
        role: "Code smells, async patterns, TS strictness",
        tooltip: "qualitygates",
        indicators: ["gate"],
      },
      {
        icon: "accessibility",
        name: "Accessibility Gates (2)",
        role: "ARIA correctness, WCAG 2.1 compliance",
        tooltip: "a11ygates",
        indicators: ["gate"],
      },
    ],
  },

  /* ─────────────── SHIP ─────────────── */
  {
    number: 7,
    title: "Release",
    color: "var(--accent-green)",
    phase: "ship",
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
    number: 8,
    title: "Deploy",
    color: "var(--accent-purple)",
    phase: "ship",
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

  /* ─────────────── RUN ─────────────── */
  {
    number: 9,
    title: "Run",
    color: "var(--accent-orange)",
    phase: "run",
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
    number: 10,
    title: "Operate",
    color: "var(--accent-orange)",
    phase: "run",
    cards: [
      {
        icon: "book",
        name: "Runbooks",
        role: "On-call procedures for common incidents",
        tooltip: "runbooks",
        indicators: ["manual", "doc-gap"],
      },
      {
        icon: "bell",
        name: "Alerting",
        role: "Who gets paged, when, and for what",
        tooltip: "alerting",
        indicators: ["manual", "doc-gap"],
      },
      {
        icon: "database",
        name: "Backup / DR",
        role: "Restore procedure, RPO/RTO targets",
        tooltip: "backupdr",
        indicators: ["manual", "doc-gap"],
      },
    ],
  },
  {
    number: 11,
    title: "Monitor",
    color: "var(--accent-pink)",
    phase: "run",
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
        indicators: ["gate"],
      },
      {
        icon: "wrench",
        name: "Auto-Fix Agent",
        role: "Claude auto-fixes CI failures or files issues",
        tooltip: "autofix",
        indicators: ["ai"],
      },
    ],
  },

  /* ─────────────── EVOLVE ─────────────── */
  {
    number: 12,
    title: "Evolve",
    color: "var(--accent-purple)",
    phase: "evolve",
    cards: [
      {
        icon: "document",
        name: "ADR for Change",
        role: "Record reasoning for significant redesigns",
        tooltip: "evolveadr",
        indicators: ["manual"],
      },
      {
        icon: "migrate",
        name: "Refactor / Migration",
        role: "Shadow-mode, dual-write, or cutover playbook",
        tooltip: "migration",
        indicators: ["manual", "doc-gap"],
      },
      {
        icon: "alert",
        name: "Breaking-Change Policy",
        role: "Deprecation windows and consumer notice",
        tooltip: "breakingchange",
        indicators: ["doc-gap"],
      },
    ],
  },

  /* ─────────────── SUNSET ─────────────── */
  {
    number: 13,
    title: "Deprecate",
    color: "var(--accent-pink)",
    phase: "sunset",
    cards: [
      {
        icon: "alert",
        name: "Deprecation Notice",
        role: "In-app banner + repo notice with sunset date",
        tooltip: "deprecationnotice",
        indicators: ["manual", "doc-gap"],
      },
      {
        icon: "flag",
        name: "Feature-Flag Kill Switch",
        role: "GOFF flag disables feature instantly",
        tooltip: "killswitch",
        indicators: ["manual"],
      },
      {
        icon: "mail",
        name: "User Comms",
        role: "Notify dependent teams and external users",
        tooltip: "usercomms",
        indicators: ["manual", "doc-gap"],
      },
    ],
  },
  {
    number: 14,
    title: "Decommission",
    color: "var(--accent-red)",
    phase: "sunset",
    cards: [
      {
        icon: "target",
        name: "ArgoCD Removal",
        role: "Delete Application; cluster resources drain",
        tooltip: "argocdremoval",
        indicators: ["manual", "gate"],
      },
      {
        icon: "cloud",
        name: "GCP Deprovision",
        role: "Tear down CloudSQL, buckets, DNS, IAM",
        tooltip: "gcpdeprovision",
        indicators: ["manual"],
      },
      {
        icon: "archive",
        name: "Repo Archive",
        role: "Mark repo archived; lock branches",
        tooltip: "repoarchive",
        indicators: ["manual"],
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
