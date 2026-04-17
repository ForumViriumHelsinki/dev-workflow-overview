package fake

import (
	"context"
	"testing"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

func TestFake_Snapshot_AllStagesPresent(t *testing.T) {
	s := New()
	snap, err := s.Snapshot(context.Background(), domain.AppRef{Name: "fake"})
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if len(snap.Stages) != 14 {
		t.Fatalf("expected 14 stages, got %d", len(snap.Stages))
	}
	for _, st := range snap.Stages {
		if st.FetchedAt == "" {
			t.Fatalf("stage %q missing FetchedAt", st.Kind)
		}
	}
}

func TestFake_List(t *testing.T) {
	s := New()
	apps, err := s.List(context.Background())
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(apps) == 0 {
		t.Fatal("fake must list at least one app")
	}
	if apps[0].Name != "fake" {
		t.Fatalf("want fixture name 'fake', got %q", apps[0].Name)
	}
}

func TestFake_UnknownName(t *testing.T) {
	s := New()
	_, err := s.Snapshot(context.Background(), domain.AppRef{Name: "does-not-exist"})
	if err == nil {
		t.Fatal("expected error for unknown app")
	}
}
