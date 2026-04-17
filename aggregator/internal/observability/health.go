package observability

import (
	"sync"
	"time"
)

// UpstreamName names each upstream source so the /healthz endpoint can
// report per-upstream state. Matches the OpenAPI enum.
type UpstreamName string

const (
	UpstreamArgoCD     UpstreamName = "argocd"
	UpstreamKubernetes UpstreamName = "kubernetes"
	UpstreamGitHub     UpstreamName = "github"
	UpstreamSentry     UpstreamName = "sentry"
)

// FailureThreshold is the PRD-002 FR7.3 rule: `/healthz` returns 503
// once an upstream has been failing continuously for 5 minutes.
const FailureThreshold = 5 * time.Minute

// Health tracks consecutive failure windows per upstream.
type Health struct {
	mu    sync.Mutex
	state map[UpstreamName]*upstreamState
}

type upstreamState struct {
	LastSuccess        time.Time
	FirstFailure       time.Time
	ConsecutiveFailures int
}

// NewHealth returns an empty Health tracker.
func NewHealth() *Health {
	return &Health{state: make(map[UpstreamName]*upstreamState)}
}

// RecordSuccess resets the consecutive-failure counter for an upstream.
func (h *Health) RecordSuccess(u UpstreamName) {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.state[u]
	if !ok {
		s = &upstreamState{}
		h.state[u] = s
	}
	s.LastSuccess = time.Now()
	s.FirstFailure = time.Time{}
	s.ConsecutiveFailures = 0
}

// RecordFailure advances the consecutive-failure counter for an upstream.
func (h *Health) RecordFailure(u UpstreamName) {
	h.mu.Lock()
	defer h.mu.Unlock()
	s, ok := h.state[u]
	if !ok {
		s = &upstreamState{}
		h.state[u] = s
	}
	if s.FirstFailure.IsZero() {
		s.FirstFailure = time.Now()
	}
	s.ConsecutiveFailures++
}

// Snapshot returns an upstream summary for the /healthz endpoint.
type Snapshot struct {
	Name                UpstreamName `json:"name"`
	Status              string       `json:"status"`
	LastSuccessAt       *time.Time   `json:"lastSuccessAt,omitempty"`
	ConsecutiveFailures int          `json:"consecutiveFailures"`
}

// OverallOK returns true unless any tracked upstream has been failing
// continuously for longer than FailureThreshold.
func (h *Health) OverallOK() bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	now := time.Now()
	for _, s := range h.state {
		if s.FirstFailure.IsZero() {
			continue
		}
		if now.Sub(s.FirstFailure) >= FailureThreshold {
			return false
		}
	}
	return true
}

// All returns the per-upstream snapshot for /healthz.
func (h *Health) All() []Snapshot {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]Snapshot, 0, len(h.state))
	for name, s := range h.state {
		snap := Snapshot{Name: name, ConsecutiveFailures: s.ConsecutiveFailures}
		if !s.LastSuccess.IsZero() {
			ls := s.LastSuccess
			snap.LastSuccessAt = &ls
		}
		switch {
		case s.FirstFailure.IsZero() && !s.LastSuccess.IsZero():
			snap.Status = "ok"
		case s.FirstFailure.IsZero() && s.LastSuccess.IsZero():
			snap.Status = "unknown"
		default:
			snap.Status = "failing"
		}
		out = append(out, snap)
	}
	return out
}
