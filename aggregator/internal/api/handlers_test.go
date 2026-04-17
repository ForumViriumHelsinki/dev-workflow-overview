package api

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/cache"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/observability"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/fake"
)

func newTestServer(t *testing.T) *httptest.Server {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	metrics := observability.NewMetrics()
	health := observability.NewHealth()
	hub := NewHub(logger)
	hot := cache.NewHot()
	src := fake.New()

	r := chi.NewRouter()
	Mount(r, Deps{
		Hot: hot, Hub: hub, Source: src,
		Metrics: metrics, Health: health, Logger: logger,
	})
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

func TestHandlers_ListApps(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/apps")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("want 200, got %d", resp.StatusCode)
	}
	var body struct {
		Apps []map[string]any `json:"apps"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(body.Apps) == 0 {
		t.Fatal("expected at least one fake app")
	}
}

func TestHandlers_StatusSnapshot(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/apps/fake/status")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("want 200, got %d", resp.StatusCode)
	}
	var body struct {
		App    string           `json:"app"`
		Stages []map[string]any `json:"stages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.App != "fake" || len(body.Stages) != 14 {
		t.Fatalf("unexpected snapshot: app=%q stages=%d", body.App, len(body.Stages))
	}
}

func TestHandlers_StatusNotFound(t *testing.T) {
	srv := newTestServer(t)
	resp, err := http.Get(srv.URL + "/api/v1/apps/unknown/status")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404, got %d", resp.StatusCode)
	}
}

func TestHandlers_RefreshRateLimit(t *testing.T) {
	srv := newTestServer(t)
	first, err := http.Post(srv.URL+"/api/v1/apps/fake/refresh", "", nil)
	if err != nil {
		t.Fatalf("first: %v", err)
	}
	first.Body.Close()
	if first.StatusCode != http.StatusAccepted {
		t.Fatalf("first: want 202, got %d", first.StatusCode)
	}
	second, err := http.Post(srv.URL+"/api/v1/apps/fake/refresh", "", nil)
	if err != nil {
		t.Fatalf("second: %v", err)
	}
	second.Body.Close()
	if second.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("second: want 429, got %d", second.StatusCode)
	}
	if second.Header.Get("Retry-After") == "" {
		t.Fatal("expected Retry-After header on 429")
	}
}

func TestHandlers_SSESnapshotEvent(t *testing.T) {
	srv := newTestServer(t)
	req, _ := http.NewRequest(http.MethodGet, srv.URL+"/api/v1/apps/fake/events", nil)
	req.Header.Set("Accept", "text/event-stream")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer resp.Body.Close()

	buf := make([]byte, 4096)
	done := make(chan struct{})
	var got string
	go func() {
		n, _ := resp.Body.Read(buf)
		got = string(buf[:n])
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("did not receive initial SSE frame in time")
	}
	if !strings.Contains(got, "event: snapshot") {
		t.Fatalf("missing snapshot event: %q", got)
	}
}
