package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// hubBufferSize is the per-subscriber outbound buffer. When full, the
// subscriber is treated as slow and its connection is closed (ADR-0008
// / PRP-002 §4.4). Clients auto-reconnect and re-sync.
const hubBufferSize = 256

// pingInterval is the keep-alive cadence for SSE subscribers.
const pingInterval = 20 * time.Second

// event is one SSE frame ready to be serialized.
type event struct {
	Name string
	ID   string
	Data any
}

// subscriber is one connected client's outbound channel.
type subscriber struct {
	app   string
	ch    chan event
	done  chan struct{}
	drops atomic.Int64
}

// Hub fans stage updates out to SSE subscribers. One hub instance per
// process; subscribers are bucketed by app name.
type Hub struct {
	logger *slog.Logger

	mu      sync.Mutex
	byApp   map[string]map[*subscriber]struct{}
	closed  atomic.Bool
	eventID atomic.Int64
}

// NewHub returns an empty Hub.
func NewHub(logger *slog.Logger) *Hub {
	return &Hub{
		logger: logger,
		byApp:  make(map[string]map[*subscriber]struct{}),
	}
}

// Close signals the hub to reject new subscribers and drops existing ones.
func (h *Hub) Close() {
	h.closed.Store(true)
	h.mu.Lock()
	defer h.mu.Unlock()
	for app, set := range h.byApp {
		for sub := range set {
			close(sub.done)
		}
		delete(h.byApp, app)
	}
}

// Subscribe registers a new subscriber for the given app. The returned
// channel delivers events; the returned cancel function must be called
// when the handler goroutine exits to free the subscription slot.
func (h *Hub) Subscribe(app string) (*subscriber, func()) {
	if h.closed.Load() {
		return nil, func() {}
	}
	sub := &subscriber{
		app:  app,
		ch:   make(chan event, hubBufferSize),
		done: make(chan struct{}),
	}
	h.mu.Lock()
	set, ok := h.byApp[app]
	if !ok {
		set = make(map[*subscriber]struct{})
		h.byApp[app] = set
	}
	set[sub] = struct{}{}
	h.mu.Unlock()
	return sub, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if set, ok := h.byApp[app]; ok {
			delete(set, sub)
			if len(set) == 0 {
				delete(h.byApp, app)
			}
		}
	}
}

// SubscriberCount returns the number of live subscribers for an app.
// Used by tests and metrics.
func (h *Hub) SubscriberCount(app string) int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.byApp[app])
}

// PublishSnapshot emits a snapshot event to every subscriber of an app.
func (h *Hub) PublishSnapshot(app string, snap domain.AppStatus) {
	h.publish(app, "snapshot", map[string]any{
		"kind":    "snapshot",
		"payload": snap,
	})
}

// PublishStageUpdate emits a stage-update event to every subscriber.
func (h *Hub) PublishStageUpdate(app string, st domain.Stage) {
	h.publish(app, "stage-update", domain.StageUpdate{
		Kind:      "stage-update",
		App:       app,
		Stage:     st,
		EmittedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

// PublishOverallUpdate emits an overall-update event.
func (h *Hub) PublishOverallUpdate(app string, overall domain.OverallStatus) {
	h.publish(app, "overall-update", map[string]any{
		"kind":      "overall-update",
		"app":       app,
		"overall":   overall,
		"emittedAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (h *Hub) publish(app, name string, data any) {
	id := h.nextID()
	ev := event{Name: name, ID: id, Data: data}

	h.mu.Lock()
	subs := make([]*subscriber, 0, len(h.byApp[app]))
	for s := range h.byApp[app] {
		subs = append(subs, s)
	}
	h.mu.Unlock()

	for _, s := range subs {
		select {
		case s.ch <- ev:
		default:
			// Slow consumer — drop and close.
			s.drops.Add(1)
			h.logger.Warn("dropping slow SSE subscriber",
				"app", app, "drops", s.drops.Load())
			// Detach and signal close without holding the hub mutex
			// across the channel close.
			h.mu.Lock()
			if set, ok := h.byApp[app]; ok {
				delete(set, s)
				if len(set) == 0 {
					delete(h.byApp, app)
				}
			}
			h.mu.Unlock()
			// Drain the send side in case the writer goroutine is
			// mid-select; close(done) is idempotent-guarded by a
			// recover below.
			safeCloseDone(s)
		}
	}
}

func safeCloseDone(s *subscriber) {
	defer func() { _ = recover() }()
	close(s.done)
}

func (h *Hub) nextID() string {
	// id format: <unix-nano>-<seq> keeps ordering stable and resumable.
	seq := h.eventID.Add(1)
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), seq)
}

// WriteStream writes events from `sub` to `w` until the request ends,
// the hub closes, or the subscriber is dropped for being slow. Caller
// is responsible for having sent the initial snapshot and for calling
// the cancel function returned by Subscribe.
func (h *Hub) WriteStream(w http.ResponseWriter, r *http.Request, sub *subscriber) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	ticker := time.NewTicker(pingInterval)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-sub.done:
			return
		case ev, ok := <-sub.ch:
			if !ok {
				return
			}
			if err := writeEvent(w, ev); err != nil {
				return
			}
			flusher.Flush()
		case <-ticker.C:
			if err := writeEvent(w, event{
				Name: "ping",
				Data: map[string]any{
					"kind":      "ping",
					"emittedAt": time.Now().UTC().Format(time.RFC3339),
				},
			}); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func writeEvent(w http.ResponseWriter, ev event) error {
	buf, err := json.Marshal(ev.Data)
	if err != nil {
		return err
	}
	if ev.ID != "" {
		if _, err := fmt.Fprintf(w, "id: %s\n", ev.ID); err != nil {
			return err
		}
	}
	if ev.Name != "" {
		if _, err := fmt.Fprintf(w, "event: %s\n", ev.Name); err != nil {
			return err
		}
	}
	if _, err := fmt.Fprintf(w, "data: %s\n\n", buf); err != nil {
		return err
	}
	return nil
}
