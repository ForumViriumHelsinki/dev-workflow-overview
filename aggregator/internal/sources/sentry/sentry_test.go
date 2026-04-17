package sentry

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

func TestSentry_StatusMapping(t *testing.T) {
	cases := []struct {
		name  string
		stats projectStats
		want  domain.StatusCode
	}{
		{"quiet", projectStats{Slug: "s"}, domain.StatusOK},
		{"warn", projectStats{Slug: "s", NewIssues24h: 2}, domain.StatusWarn},
		{"fail-count", projectStats{Slug: "s", NewIssues24h: 15}, domain.StatusFail},
		{"fail-ratio", projectStats{
			Slug: "s", NewIssues24h: 5, EventRate24h: 20, EventRateBase7d: 5,
		}, domain.StatusFail},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(tc.stats)
			}))
			defer srv.Close()

			a, err := New(Config{OrgSlug: "org", APIToken: "t", BaseURL: srv.URL})
			if err != nil {
				t.Fatalf("new: %v", err)
			}
			upd, err := a.Fetch(context.Background(), domain.AppRef{SentryProj: "s"})
			if err != nil {
				t.Fatalf("fetch: %v", err)
			}
			st := upd[domain.StageMonitor]
			if st.Status != tc.want {
				t.Fatalf("%s: want %q, got %q", tc.name, tc.want, st.Status)
			}
		})
	}
}

func TestSentry_MissingProjectGivesUnknown(t *testing.T) {
	a, err := New(Config{OrgSlug: "org", APIToken: "t"})
	if err != nil {
		t.Fatalf("new: %v", err)
	}
	upd, err := a.Fetch(context.Background(), domain.AppRef{})
	if err != nil {
		t.Fatalf("fetch: %v", err)
	}
	if s := upd[domain.StageMonitor].Status; s != domain.StatusUnknown {
		t.Fatalf("want unknown when SentryProj empty, got %q", s)
	}
}
