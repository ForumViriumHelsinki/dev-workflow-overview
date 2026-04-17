package domain

// StatusCode is the per-stage health enum from the OpenAPI spec.
type StatusCode string

const (
	StatusOK      StatusCode = "ok"
	StatusWarn    StatusCode = "warn"
	StatusFail    StatusCode = "fail"
	StatusUnknown StatusCode = "unknown"
	StatusNA      StatusCode = "n/a"
)

// Staleness reflects the freshness of a stage payload.
type Staleness string

const (
	StalenessFresh       Staleness = "fresh"
	StalenessCached      Staleness = "cached"
	StalenessStale       Staleness = "stale"
	StalenessFetchFailed Staleness = "fetch-failed"
)

// Severity orders statuses for overall-badge derivation.
// Higher = worse. `n/a` is ignored by the overall rule.
func Severity(s StatusCode) int {
	switch s {
	case StatusOK:
		return 0
	case StatusUnknown:
		return 1
	case StatusWarn:
		return 2
	case StatusFail:
		return 3
	default:
		return -1
	}
}

// OverallStatus is the header badge summary.
type OverallStatus struct {
	Status          StatusCode `json:"status"`
	Summary         string     `json:"summary"`
	WorstStageKind  *string    `json:"worstStageKind,omitempty"`
}

// DeriveOverall folds per-stage statuses into a single OverallStatus per
// the PRD-002 FR2.4 rule: the worst non-n/a stage pins the badge.
func DeriveOverall(stages []Stage) OverallStatus {
	worstIdx := -1
	worst := -1
	for i, s := range stages {
		sev := Severity(s.Status)
		if sev < 0 {
			continue
		}
		if sev > worst {
			worst = sev
			worstIdx = i
		}
	}
	if worstIdx < 0 {
		return OverallStatus{Status: StatusUnknown, Summary: "No live data"}
	}
	s := stages[worstIdx]
	summary := s.Summary
	if summary == "" {
		summary = string(s.Status)
	}
	kind := string(s.Kind)
	return OverallStatus{Status: s.Status, Summary: summary, WorstStageKind: &kind}
}
