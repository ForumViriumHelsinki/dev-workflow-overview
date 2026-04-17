package cache

import (
	"sync"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// Hot is the in-memory authoritative store of current AppStatus per app.
// Reads and writes are concurrency-safe. The SSE hub diffs against this
// store to decide whether to emit a stage-update event.
type Hot struct {
	mu   sync.RWMutex
	data map[string]domain.AppStatus
}

// NewHot returns an empty hot cache.
func NewHot() *Hot {
	return &Hot{data: make(map[string]domain.AppStatus)}
}

// Get returns a copy of the AppStatus for the given app, if present.
func (h *Hot) Get(app string) (domain.AppStatus, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	s, ok := h.data[app]
	if !ok {
		return domain.AppStatus{}, false
	}
	// Copy slice so callers cannot mutate hot state.
	stages := make([]domain.Stage, len(s.Stages))
	copy(stages, s.Stages)
	s.Stages = stages
	return s, true
}

// Put overwrites the AppStatus for an app and returns the previous
// value (or zero + false when none existed).
func (h *Hot) Put(app string, s domain.AppStatus) (domain.AppStatus, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	prev, had := h.data[app]
	h.data[app] = s
	return prev, had
}

// PutStage replaces one stage inside an existing AppStatus. Returns
// the previous stage value and whether the app was known.
func (h *Hot) PutStage(app string, st domain.Stage) (domain.Stage, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	cur, ok := h.data[app]
	if !ok {
		return domain.Stage{}, false
	}
	var prev domain.Stage
	for i, s := range cur.Stages {
		if s.Kind == st.Kind {
			prev = cur.Stages[i]
			cur.Stages[i] = st
			h.data[app] = cur
			return prev, true
		}
	}
	return domain.Stage{}, false
}

// Delete removes an app. Idempotent.
func (h *Hot) Delete(app string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.data, app)
}

// Keys returns a snapshot of known app names.
func (h *Hot) Keys() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	keys := make([]string, 0, len(h.data))
	for k := range h.data {
		keys = append(keys, k)
	}
	return keys
}
