package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/cache"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/observability"
)

// Source is the minimal contract every upstream adapter satisfies.
// Fake, argocd, kubernetes, github, and sentry all implement this.
type Source interface {
	Name() string
	List(ctx context.Context) ([]domain.AppSummary, error)
	Snapshot(ctx context.Context, ref domain.AppRef) (domain.AppStatus, error)
}

// Deps bundles the pieces the HTTP layer needs. Composed once in main.go.
type Deps struct {
	Hot     *cache.Hot
	Hub     *Hub
	Source  Source
	Metrics *observability.Metrics
	Health  *observability.Health
	Logger  *slog.Logger
	Version string

	// refreshGuards throttles POST /refresh to 1 req / 30s / app.
	refreshMu     sync.Mutex
	refreshGuards map[string]time.Time
}

// Mount attaches all routes onto the given router.
func Mount(r chi.Router, d Deps) {
	d.refreshGuards = make(map[string]time.Time)
	dp := &d

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/apps", dp.listApps)
		r.Get("/apps/{name}/status", dp.getStatus)
		r.Get("/apps/{name}/events", dp.streamEvents)
		r.Post("/apps/{name}/refresh", dp.refresh)
	})

	r.Get("/healthz", dp.healthz)
	r.Get("/metrics", d.Metrics.Handler().ServeHTTP)
}

func (d *Deps) listApps(w http.ResponseWriter, r *http.Request) {
	repo := r.URL.Query().Get("repo")
	project := r.URL.Query().Get("project")

	apps, err := d.Source.List(r.Context())
	if err != nil {
		writeProblem(w, http.StatusInternalServerError, "Failed to list applications", err.Error())
		return
	}
	if repo != "" || project != "" {
		filtered := apps[:0]
		for _, a := range apps {
			if repo != "" && a.Source.Repo != repo {
				continue
			}
			if project != "" && a.Source.ArgoCDProject != project {
				continue
			}
			filtered = append(filtered, a)
		}
		apps = filtered
	}
	writeJSON(w, http.StatusOK, domain.AppList{
		Apps:      apps,
		FetchedAt: time.Now().UTC().Format(time.RFC3339),
	})
}

func (d *Deps) getStatus(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		writeProblem(w, http.StatusBadRequest, "Missing application name", "")
		return
	}
	// Prefer a warm hot-cache entry; fall back to a live fetch.
	if s, ok := d.Hot.Get(name); ok {
		writeJSON(w, http.StatusOK, s)
		return
	}
	snap, err := d.Source.Snapshot(r.Context(), domain.AppRef{Name: name})
	if err != nil {
		writeProblem(w, http.StatusNotFound, "Application not found", err.Error())
		return
	}
	d.Hot.Put(name, snap)
	writeJSON(w, http.StatusOK, snap)
}

func (d *Deps) streamEvents(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		writeProblem(w, http.StatusBadRequest, "Missing application name", "")
		return
	}

	snap, ok := d.Hot.Get(name)
	if !ok {
		var err error
		snap, err = d.Source.Snapshot(r.Context(), domain.AppRef{Name: name})
		if err != nil {
			writeProblem(w, http.StatusNotFound, "Application not found", err.Error())
			return
		}
		d.Hot.Put(name, snap)
	}

	sub, cancel := d.Hub.Subscribe(name)
	if sub == nil {
		writeProblem(w, http.StatusServiceUnavailable, "Service shutting down", "")
		return
	}
	defer cancel()
	d.Metrics.SSEConnections.Inc()
	defer d.Metrics.SSEConnections.Dec()

	// Immediate snapshot event so the browser gets initial state without
	// a second round-trip (honours Last-Event-ID per PRP-002 §4.4).
	sub.ch <- event{
		Name: "snapshot",
		ID:   d.Hub.nextID(),
		Data: map[string]any{"kind": "snapshot", "payload": snap},
	}

	d.Hub.WriteStream(w, r, sub)
}

func (d *Deps) refresh(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	if name == "" {
		writeProblem(w, http.StatusBadRequest, "Missing application name", "")
		return
	}

	d.refreshMu.Lock()
	now := time.Now()
	if last, ok := d.refreshGuards[name]; ok && now.Sub(last) < 30*time.Second {
		remaining := int((30*time.Second - now.Sub(last)).Seconds()) + 1
		d.refreshMu.Unlock()
		w.Header().Set("Retry-After", itoa(remaining))
		writeProblem(w, http.StatusTooManyRequests,
			"Refresh rate limit exceeded", "Limit: 1 request / 30s / application")
		return
	}
	d.refreshGuards[name] = now
	d.refreshMu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		snap, err := d.Source.Snapshot(ctx, domain.AppRef{Name: name})
		if err != nil {
			d.Logger.Warn("refresh failed", "app", name, "error", err)
			return
		}
		d.Hot.Put(name, snap)
		d.Hub.PublishSnapshot(name, snap)
	}()

	writeJSON(w, http.StatusAccepted, map[string]any{
		"app":             name,
		"accepted":        true,
		"willRecomputeAt": time.Now().UTC().Format(time.RFC3339),
	})
}

func (d *Deps) healthz(w http.ResponseWriter, _ *http.Request) {
	status := "ok"
	code := http.StatusOK
	if !d.Health.OverallOK() {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}
	writeJSON(w, code, map[string]any{
		"status":    status,
		"checkedAt": time.Now().UTC().Format(time.RFC3339),
		"upstreams": d.Health.All(),
	})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeProblem(w http.ResponseWriter, status int, title, detail string) {
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"type":   "about:blank",
		"title":  title,
		"status": status,
		"detail": detail,
	})
}

func itoa(n int) string {
	if n <= 0 {
		return "1"
	}
	// Small local itoa to avoid pulling in strconv for a trivial case.
	var buf [12]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
