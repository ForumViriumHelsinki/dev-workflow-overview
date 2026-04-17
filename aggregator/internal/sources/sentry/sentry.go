// Package sentry adapts the Sentry REST API into stage 11 (Monitor).
// The adapter is deliberately minimal: one HTTP call per fetch, a
// 60-second per-project TTL cached by the shared cache.Fetcher above.
package sentry

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// Config holds the adapter inputs. The org slug and token both originate
// from environment variables populated by an ExternalSecret.
type Config struct {
	OrgSlug  string
	APIToken string
	BaseURL  string // optional, defaults to https://sentry.io
	HTTP     *http.Client
}

// Adapter wraps a typed HTTP call against Sentry.
type Adapter struct {
	cfg Config
}

// New returns a configured Adapter.
func New(cfg Config) (*Adapter, error) {
	if cfg.OrgSlug == "" || cfg.APIToken == "" {
		return nil, errors.New("sentry: OrgSlug and APIToken are required")
	}
	if cfg.BaseURL == "" {
		cfg.BaseURL = "https://sentry.io"
	}
	if cfg.HTTP == nil {
		cfg.HTTP = &http.Client{Timeout: 10 * time.Second}
	}
	return &Adapter{cfg: cfg}, nil
}

// projectStats is the minimum subset of the Sentry response we need.
type projectStats struct {
	Slug             string  `json:"slug"`
	UnresolvedIssues int     `json:"unresolvedIssueCount"`
	NewIssues24h     int     `json:"newIssues24h"`
	EventRate24h     float64 `json:"eventRate24h"`
	EventRateBase7d  float64 `json:"eventRateBaseline7d"`
}

// Fetch returns a stage 11 payload keyed by ref.SentryProj. Empty Sentry
// project slug -> `unknown` status with an explanatory summary so the
// frontend can render the doc-gap honestly.
func (a *Adapter) Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error) {
	if a == nil {
		return nil, errors.New("sentry: adapter not configured")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	st := domain.Stage{
		ID:        11,
		Kind:      domain.StageMonitor,
		Phase:     domain.PhaseRun,
		Title:     "Monitor",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
	}

	if ref.SentryProj == "" {
		st.Status = domain.StatusUnknown
		st.Summary = "Sentry project not configured"
		return domain.StageUpdates{domain.StageMonitor: st}, nil
	}

	stats, err := a.getProjectStats(ctx, ref.SentryProj)
	if err != nil {
		return nil, fmt.Errorf("sentry: %w", err)
	}

	ratio := 0.0
	if stats.EventRateBase7d > 0 {
		ratio = stats.EventRate24h / stats.EventRateBase7d
	}
	st.Details = map[string]any{
		"sentryProject":       stats.Slug,
		"unresolvedIssueCount": stats.UnresolvedIssues,
		"newIssues24h":        stats.NewIssues24h,
		"eventRate24h":        stats.EventRate24h,
		"eventRateBaseline7d": stats.EventRateBase7d,
		"eventRateRatio":      ratio,
	}
	st.Links = []domain.Link{{
		Label: "Sentry",
		Href:  fmt.Sprintf("%s/organizations/%s/projects/%s/", a.cfg.BaseURL, a.cfg.OrgSlug, stats.Slug),
	}}

	switch {
	case stats.NewIssues24h > 10 || ratio >= 2.0:
		st.Status = domain.StatusFail
		st.Summary = fmt.Sprintf("%d new issues in 24h (%.1fx baseline)",
			stats.NewIssues24h, ratio)
	case stats.NewIssues24h >= 1:
		st.Status = domain.StatusWarn
		st.Summary = fmt.Sprintf("%d new issues in 24h", stats.NewIssues24h)
	default:
		st.Status = domain.StatusOK
		st.Summary = "No new unresolved issues"
	}
	return domain.StageUpdates{domain.StageMonitor: st}, nil
}

func (a *Adapter) getProjectStats(ctx context.Context, slug string) (projectStats, error) {
	u := fmt.Sprintf("%s/api/0/projects/%s/%s/",
		a.cfg.BaseURL,
		url.PathEscape(a.cfg.OrgSlug),
		url.PathEscape(slug),
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return projectStats{}, err
	}
	req.Header.Set("Authorization", "Bearer "+a.cfg.APIToken)
	resp, err := a.cfg.HTTP.Do(req)
	if err != nil {
		return projectStats{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return projectStats{}, fmt.Errorf("sentry: status %d", resp.StatusCode)
	}
	var stats projectStats
	if err := json.NewDecoder(resp.Body).Decode(&stats); err != nil {
		return projectStats{}, err
	}
	if stats.Slug == "" {
		stats.Slug = slug
	}
	return stats, nil
}
