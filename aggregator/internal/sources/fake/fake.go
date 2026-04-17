// Package fake is a deterministic in-memory Source used for local dev,
// integration tests, and the `?app=fake` smoke path described in PRD-002.
//
// The fixture is intentionally rich enough to exercise every StatusCode
// and Staleness value across all 14 stages.
package fake

import (
	"context"
	"fmt"
	"time"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// Source is the deterministic fake adapter.
type Source struct {
	now func() time.Time
}

// New returns a fake source anchored at time.Now.
func New() *Source { return &Source{now: time.Now} }

// NewAt returns a fake source anchored at the supplied time (tests).
func NewAt(t time.Time) *Source { return &Source{now: func() time.Time { return t }} }

// Name implements api.Source.
func (*Source) Name() string { return "fake" }

// List implements api.Source — returns a stable fixture list.
func (f *Source) List(_ context.Context) ([]domain.AppSummary, error) {
	apps := make([]domain.AppSummary, 0, len(fakeApps))
	for _, a := range fakeApps {
		apps = append(apps, domain.AppSummary{
			Name:    a.name,
			Mode:    "deployed",
			Source:  a.source(),
			Overall: a.overall,
		})
	}
	return apps, nil
}

// Snapshot implements api.Source.
func (f *Source) Snapshot(_ context.Context, ref domain.AppRef) (domain.AppStatus, error) {
	a, ok := lookupFixture(ref.Name)
	if !ok {
		return domain.AppStatus{}, fmt.Errorf("fake: unknown app %q", ref.Name)
	}
	now := f.now().UTC().Format(time.RFC3339)
	stages := make([]domain.Stage, len(domain.StageOrder))
	for i, s := range domain.StageOrder {
		stages[i] = domain.Stage{
			ID:        s.ID,
			Kind:      s.Kind,
			Phase:     s.Phase,
			Title:     s.Title,
			Status:    a.stageStatus(s.Kind),
			Summary:   a.stageSummary(s.Kind),
			FetchedAt: now,
			Staleness: domain.StalenessFresh,
		}
	}
	return domain.AppStatus{
		App:             a.name,
		Mode:            "deployed",
		Source:          a.source(),
		Overall:         domain.DeriveOverall(stages),
		Stages:          stages,
		FetchedAt:       now,
		CacheTTLSeconds: 30,
	}, nil
}

type fixture struct {
	name            string
	repo            string
	namespace       string
	argocdProject   string
	sentryProject   string
	imageRepository string
	overall         domain.OverallStatus
	overrides       map[domain.StageKind]domain.StatusCode
	summaries       map[domain.StageKind]string
}

func (fx fixture) source() domain.AppSource {
	sp := fx.sentryProject
	ir := fx.imageRepository
	return domain.AppSource{
		Repo:            fx.repo,
		Namespace:       fx.namespace,
		ArgoCDProject:   fx.argocdProject,
		DefaultBranch:   "main",
		SentryProject:   &sp,
		ImageRepository: &ir,
	}
}

func (fx fixture) stageStatus(k domain.StageKind) domain.StatusCode {
	if s, ok := fx.overrides[k]; ok {
		return s
	}
	return domain.StatusOK
}

func (fx fixture) stageSummary(k domain.StageKind) string {
	if s, ok := fx.summaries[k]; ok {
		return s
	}
	return ""
}

var fakeApps = []fixture{
	{
		name:            "fake",
		repo:            "ForumViriumHelsinki/fake-example",
		namespace:       "fake",
		argocdProject:   "platform-automation",
		sentryProject:   "fake",
		imageRepository: "ghcr.io/forumviriumhelsinki/fake",
		overall:         domain.OverallStatus{Status: domain.StatusOK, Summary: "Synced · Healthy"},
		overrides: map[domain.StageKind]domain.StatusCode{
			domain.StageInception: domain.StatusOK,
			domain.StageMonitor:   domain.StatusWarn,
			domain.StageOperate:   domain.StatusUnknown,
			domain.StageDeprecate: domain.StatusNA,
			domain.StageDecommission: domain.StatusNA,
		},
		summaries: map[domain.StageKind]string{
			domain.StageDeploy:  "Synced · Healthy · rev abc123f",
			domain.StageMonitor: "1 new unresolved in 24h",
			domain.StageRun:     "3/3 ready",
		},
	},
}

func lookupFixture(name string) (fixture, bool) {
	for _, a := range fakeApps {
		if a.name == name {
			return a, true
		}
	}
	return fixture{}, false
}
