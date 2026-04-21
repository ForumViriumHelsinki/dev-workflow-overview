package cluster

import (
	"context"
	"errors"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic/fake"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
	argoadapter "github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/argocd"
)

func app(name, project, repoURL, namespace, sync, health string) *unstructured.Unstructured {
	return &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": "argoproj.io/v1alpha1",
			"kind":       "Application",
			"metadata": map[string]any{
				"name":      name,
				"namespace": "argocd",
			},
			"spec": map[string]any{
				"project": project,
				"source": map[string]any{
					"repoURL": repoURL,
				},
				"destination": map[string]any{
					"namespace": namespace,
				},
			},
			"status": map[string]any{
				"sync":   map[string]any{"status": sync},
				"health": map[string]any{"status": health},
			},
		},
	}
}

// newFakeDynamic constructs a dynamic fake that knows how to list
// argoproj.io Applications. The GVR→Kind mapping has to be supplied
// explicitly because dynamic.fake can't infer it from unstructured.
func newFakeDynamic(objs ...*unstructured.Unstructured) *fake.FakeDynamicClient {
	scheme := runtime.NewScheme()
	gvrToListKind := map[schema.GroupVersionResource]string{
		argoadapter.ApplicationGVR: "ApplicationList",
	}
	// Convert variadic to runtime.Object slice.
	ro := make([]runtime.Object, 0, len(objs))
	for _, o := range objs {
		ro = append(ro, o)
	}
	return fake.NewSimpleDynamicClientWithCustomListKinds(scheme, gvrToListKind, ro...)
}

// stubPartial is a Partial test double that records invocations and
// returns a canned StageUpdates / error. It lets us assert fan-out
// without standing up the ArgoCD / Kubernetes adapters.
type stubPartial struct {
	name    string
	updates domain.StageUpdates
	err     error
	calls   int
}

func (s *stubPartial) Name() string { return s.name }
func (s *stubPartial) Fetch(_ context.Context, _ domain.AppRef) (domain.StageUpdates, error) {
	s.calls++
	return s.updates, s.err
}

func TestList_AppProjectFilter(t *testing.T) {
	objs := []*unstructured.Unstructured{
		app("podinfo", "platform-automation", "https://github.com/ForumViriumHelsinki/podinfo.git", "default", "Synced", "Healthy"),
		app("tfds", "fvh-tfds", "https://github.com/ForumViriumHelsinki/tfds.git", "default", "Synced", "Healthy"),
		app("legacy", "off-limits", "https://github.com/ForumViriumHelsinki/legacy.git", "default", "Synced", "Healthy"),
	}
	dyn := newFakeDynamic(objs...)

	cases := []struct {
		name    string
		allowed map[string]struct{}
		want    []string // Application names expected
	}{
		{
			name:    "empty-allow-list-returns-all",
			allowed: nil,
			want:    []string{"podinfo", "tfds", "legacy"},
		},
		{
			name: "allowed-subset",
			allowed: map[string]struct{}{
				"platform-automation": {},
				"fvh-tfds":            {},
			},
			want: []string{"podinfo", "tfds"},
		},
		{
			name:    "all-rejected",
			allowed: map[string]struct{}{"not-a-project": {}},
			want:    nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			src := New(Options{Dynamic: dyn, AllowedProjects: tc.allowed})
			list, err := src.List(context.Background())
			if err != nil {
				t.Fatalf("List: %v", err)
			}
			got := make([]string, 0, len(list))
			for _, a := range list {
				got = append(got, a.Name)
			}
			if !sameSet(got, tc.want) {
				t.Fatalf("names: want %v, got %v", tc.want, got)
			}
		})
	}
}

func TestSnapshot_FanOutAndMerge(t *testing.T) {
	dyn := newFakeDynamic(
		app("podinfo", "platform-automation", "https://github.com/ForumViriumHelsinki/podinfo.git", "default", "Synced", "Healthy"),
	)

	okProvision := domain.Stage{
		ID:      2,
		Kind:    domain.StageProvision,
		Status:  domain.StatusOK,
		Summary: "argocd-stub",
	}
	okDeploy := domain.Stage{
		ID:      8,
		Kind:    domain.StageDeploy,
		Status:  domain.StatusOK,
		Summary: "argocd-stub",
	}
	okRun := domain.Stage{
		ID:      9,
		Kind:    domain.StageRun,
		Status:  domain.StatusOK,
		Summary: "k8s-stub",
	}

	argo := &stubPartial{
		name: "argocd",
		updates: domain.StageUpdates{
			domain.StageProvision: okProvision,
			domain.StageDeploy:    okDeploy,
		},
	}
	k8s := &stubPartial{
		name:    "kubernetes",
		updates: domain.StageUpdates{domain.StageRun: okRun},
	}

	src := New(Options{Dynamic: dyn, GitHub: argo, Sentry: k8s})
	snap, err := src.Snapshot(context.Background(), domain.AppRef{Name: "podinfo"})
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if argo.calls != 1 || k8s.calls != 1 {
		t.Fatalf("partial fan-out: argo=%d k8s=%d", argo.calls, k8s.calls)
	}
	if len(snap.Stages) != len(domain.StageOrder) {
		t.Fatalf("stage count: want %d, got %d", len(domain.StageOrder), len(snap.Stages))
	}

	// Populated stages reflect partial output.
	got := map[domain.StageKind]domain.StatusCode{}
	for _, s := range snap.Stages {
		got[s.Kind] = s.Status
	}
	if got[domain.StageProvision] != domain.StatusOK {
		t.Fatalf("provision: want ok, got %q", got[domain.StageProvision])
	}
	if got[domain.StageDeploy] != domain.StatusOK {
		t.Fatalf("deploy: want ok, got %q", got[domain.StageDeploy])
	}
	if got[domain.StageRun] != domain.StatusOK {
		t.Fatalf("run: want ok, got %q", got[domain.StageRun])
	}
	// Unpopulated stages must be n/a so DeriveOverall ignores them
	// (C.11: prevents overall from being pinned to "unknown").
	if got[domain.StageInception] != domain.StatusNA {
		t.Fatalf("inception: want n/a, got %q", got[domain.StageInception])
	}
	if got[domain.StageMonitor] != domain.StatusNA {
		t.Fatalf("monitor: want n/a, got %q", got[domain.StageMonitor])
	}
	// With only ok stages populated, overall is ok (not unknown).
	if snap.Overall.Status != domain.StatusOK {
		t.Fatalf("overall: want ok, got %q (summary=%q)", snap.Overall.Status, snap.Overall.Summary)
	}
	if snap.Source.ArgoCDProject != "platform-automation" {
		t.Fatalf("source project: want platform-automation, got %q", snap.Source.ArgoCDProject)
	}
}

func TestSnapshot_AdapterErrorToleratedFailOpenToGrey(t *testing.T) {
	dyn := newFakeDynamic(
		app("podinfo", "platform-automation", "https://github.com/ForumViriumHelsinki/podinfo.git", "default", "Synced", "Healthy"),
	)

	broken := &stubPartial{name: "argocd", err: errors.New("boom")}
	good := &stubPartial{
		name: "kubernetes",
		updates: domain.StageUpdates{
			domain.StageRun: {
				ID: 9, Kind: domain.StageRun, Status: domain.StatusOK, Summary: "ok",
			},
		},
	}

	src := New(Options{Dynamic: dyn, GitHub: broken, Sentry: good})
	snap, err := src.Snapshot(context.Background(), domain.AppRef{Name: "podinfo"})
	if err != nil {
		t.Fatalf("Snapshot: %v", err)
	}
	if broken.calls != 1 || good.calls != 1 {
		t.Fatalf("both partials must be called even when one errors; argo=%d k8s=%d", broken.calls, good.calls)
	}
	byKind := map[domain.StageKind]domain.Stage{}
	for _, s := range snap.Stages {
		byKind[s.Kind] = s
	}
	// The good adapter's stage is present.
	if byKind[domain.StageRun].Status != domain.StatusOK {
		t.Fatalf("run: want ok, got %q", byKind[domain.StageRun].Status)
	}
	// The broken adapter didn't contribute — its stages stay n/a.
	if byKind[domain.StageProvision].Status != domain.StatusNA {
		t.Fatalf("provision (broken adapter): want n/a, got %q", byKind[domain.StageProvision].Status)
	}
	if byKind[domain.StageDeploy].Status != domain.StatusNA {
		t.Fatalf("deploy (broken adapter): want n/a, got %q", byKind[domain.StageDeploy].Status)
	}
}

func TestSnapshot_RequiresName(t *testing.T) {
	dyn := newFakeDynamic()
	src := New(Options{Dynamic: dyn})
	_, err := src.Snapshot(context.Background(), domain.AppRef{})
	if err == nil {
		t.Fatalf("Snapshot: expected error for empty ref.Name")
	}
}

func TestList_RequiresDynamicClient(t *testing.T) {
	src := New(Options{})
	_, err := src.List(context.Background())
	if err == nil {
		t.Fatalf("List: expected error when Dynamic is nil")
	}
}

func TestRepoFromURL(t *testing.T) {
	cases := map[string]string{
		"https://github.com/ForumViriumHelsinki/podinfo.git":     "ForumViriumHelsinki/podinfo",
		"https://github.com/ForumViriumHelsinki/podinfo":        "ForumViriumHelsinki/podinfo",
		"git@github.com:ForumViriumHelsinki/podinfo.git":         "ForumViriumHelsinki/podinfo",
		"https://gitlab.com/team/thing.git":                     "https://gitlab.com/team/thing",
		"": "",
	}
	for in, want := range cases {
		if got := repoFromURL(in); got != want {
			t.Errorf("repoFromURL(%q): want %q, got %q", in, want, got)
		}
	}
}

func TestOverallFromSyncHealth(t *testing.T) {
	cases := []struct {
		sync, health string
		want         domain.StatusCode
	}{
		{"Synced", "Healthy", domain.StatusOK},
		{"Synced", "Degraded", domain.StatusFail},
		{"OutOfSync", "Healthy", domain.StatusWarn},
		{"Synced", "Progressing", domain.StatusWarn},
		{"", "", domain.StatusUnknown},
	}
	for _, tc := range cases {
		got := overallFromSyncHealth(tc.sync, tc.health)
		if got.Status != tc.want {
			t.Errorf("overallFromSyncHealth(%q,%q): want %q, got %q", tc.sync, tc.health, tc.want, got.Status)
		}
	}
}

// sameSet compares string slices treating them as sets (order-independent).
func sameSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	seen := map[string]int{}
	for _, s := range a {
		seen[s]++
	}
	for _, s := range b {
		seen[s]--
		if seen[s] < 0 {
			return false
		}
	}
	for _, v := range seen {
		if v != 0 {
			return false
		}
	}
	return true
}

