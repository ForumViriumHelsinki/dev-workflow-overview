package domain

// StageKind mirrors the OpenAPI StageKind enum. The string value is the
// OpenAPI discriminator and doubles as the stable cross-version identifier
// that the frontend uses to key live data onto the static stage rows.
type StageKind string

const (
	StageInception    StageKind = "inception"     // 1
	StageProvision    StageKind = "provision"     // 2
	StageDevelop      StageKind = "develop"       // 3
	StageCommitPush   StageKind = "commit-push"   // 4
	StageAIReview     StageKind = "ai-review"     // 5
	StageCIGates      StageKind = "ci-gates"      // 6
	StageRelease      StageKind = "release"       // 7
	StageDeploy       StageKind = "deploy"        // 8
	StageRun          StageKind = "run"           // 9
	StageOperate      StageKind = "operate"       // 10
	StageMonitor      StageKind = "monitor"       // 11
	StageEvolve       StageKind = "evolve"        // 12
	StageDeprecate    StageKind = "deprecate"     // 13
	StageDecommission StageKind = "decommission"  // 14
)

// StageOrder lists the 14 stages in lifecycle order with ID and phase.
// This is the single source of truth for stage IDs within the service.
var StageOrder = []struct {
	ID    int
	Kind  StageKind
	Phase LifecyclePhase
	Title string
}{
	{1, StageInception, PhaseSetup, "Inception"},
	{2, StageProvision, PhaseSetup, "Provision"},
	{3, StageDevelop, PhaseBuild, "Develop"},
	{4, StageCommitPush, PhaseBuild, "Commit & Push"},
	{5, StageAIReview, PhaseBuild, "AI Review"},
	{6, StageCIGates, PhaseBuild, "CI Gates"},
	{7, StageRelease, PhaseShip, "Release"},
	{8, StageDeploy, PhaseShip, "Deploy"},
	{9, StageRun, PhaseRun, "Run"},
	{10, StageOperate, PhaseRun, "Operate"},
	{11, StageMonitor, PhaseRun, "Monitor"},
	{12, StageEvolve, PhaseEvolve, "Evolve"},
	{13, StageDeprecate, PhaseSunset, "Deprecate"},
	{14, StageDecommission, PhaseSunset, "Decommission"},
}

// LifecyclePhase groups stages into the six phases of the visualization.
type LifecyclePhase string

const (
	PhaseSetup  LifecyclePhase = "setup"
	PhaseBuild  LifecyclePhase = "build"
	PhaseShip   LifecyclePhase = "ship"
	PhaseRun    LifecyclePhase = "run"
	PhaseEvolve LifecyclePhase = "evolve"
	PhaseSunset LifecyclePhase = "sunset"
)

// Link is one deep link shown in a stage tooltip.
type Link struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

// Stage is the serialized shape of a single stage in the AppStatus
// response. Details is an opaque map per stage kind — the frontend
// interprets it using the generated OpenAPI types.
type Stage struct {
	ID            int            `json:"id"`
	Kind          StageKind      `json:"kind"`
	Phase         LifecyclePhase `json:"phase"`
	Title         string         `json:"title"`
	Status        StatusCode     `json:"status"`
	Summary       string         `json:"summary,omitempty"`
	Links         []Link         `json:"links,omitempty"`
	FetchedAt     string         `json:"fetchedAt"`
	Staleness     Staleness      `json:"staleness"`
	FailureReason string         `json:"failureReason,omitempty"`
	Details       map[string]any `json:"details,omitempty"`
}

// StageUpdate is the diff payload emitted over SSE when a single
// stage changes inside an ongoing subscription.
type StageUpdate struct {
	Kind      string `json:"kind"` // "stage-update"
	App       string `json:"app"`
	Stage     Stage  `json:"stage"`
	EmittedAt string `json:"emittedAt"`
}

// StageUpdates is returned by Source.Fetch; each entry is keyed by the
// stage it populates. A nil entry means the source does not contribute
// to that stage for the given AppRef.
type StageUpdates map[StageKind]Stage
