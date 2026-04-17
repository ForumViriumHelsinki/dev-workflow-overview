package cache

import (
	"testing"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

func TestHot_PutAndGet(t *testing.T) {
	h := NewHot()
	if _, ok := h.Get("x"); ok {
		t.Fatal("empty hot should miss")
	}
	s := domain.AppStatus{App: "x", Stages: []domain.Stage{{Kind: domain.StageDeploy, Status: domain.StatusOK}}}
	h.Put("x", s)

	got, ok := h.Get("x")
	if !ok {
		t.Fatal("expected hit after Put")
	}
	if got.App != "x" || len(got.Stages) != 1 {
		t.Fatalf("unexpected snapshot: %+v", got)
	}

	got.Stages[0].Status = domain.StatusFail
	got2, _ := h.Get("x")
	if got2.Stages[0].Status != domain.StatusOK {
		t.Fatal("Get should return a copy, not a reference into the hot cache")
	}
}

func TestHot_PutStage(t *testing.T) {
	h := NewHot()
	h.Put("x", domain.AppStatus{
		App: "x",
		Stages: []domain.Stage{
			{Kind: domain.StageDeploy, Status: domain.StatusOK},
		},
	})
	prev, ok := h.PutStage("x", domain.Stage{Kind: domain.StageDeploy, Status: domain.StatusFail})
	if !ok {
		t.Fatal("PutStage should succeed for existing app")
	}
	if prev.Status != domain.StatusOK {
		t.Fatalf("previous status should be ok, got %v", prev.Status)
	}
	got, _ := h.Get("x")
	if got.Stages[0].Status != domain.StatusFail {
		t.Fatal("stage not replaced")
	}
}
