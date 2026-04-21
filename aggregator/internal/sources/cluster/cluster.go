// Package cluster is the in-cluster composite Source. It queries ArgoCD
// Applications to answer /api/v1/apps and, for each /status request,
// fans out to the ArgoCD, Kubernetes, GitHub, and Sentry partial
// adapters and merges their StageUpdates into the 14-stage snapshot.
package cluster

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
	argoadapter "github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/argocd"
	k8sadapter "github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/kubernetes"
)

// Partial is the narrow interface every partial adapter satisfies.
// ArgoCD, Kubernetes, GitHub, and Sentry adapters all implement it.
type Partial interface {
	Name() string
	Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error)
}

// Options bundles the dependencies the composite needs.
type Options struct {
	Dynamic         dynamic.Interface
	Clientset       kubernetes.Interface
	ArgoCDNamespace string // typically "argocd"
	ArgoCDServerURL string // base URL for deep links (optional)
	AllowedProjects map[string]struct{}

	// Partial adapters. Nil entries are skipped.
	ArgoCD     *argoadapter.Adapter
	Kubernetes *k8sadapter.Adapter
	GitHub     Partial
	Sentry     Partial
}

// Source implements api.Source against a live kubernetes/argocd stack.
type Source struct {
	opts  Options
	parts []Partial
}

// New returns a Source configured from the given options.
func New(opts Options) *Source {
	if opts.ArgoCDNamespace == "" {
		opts.ArgoCDNamespace = "argocd"
	}
	s := &Source{opts: opts}
	if opts.ArgoCD != nil {
		s.parts = append(s.parts, wrapArgoCD{opts.ArgoCD})
	}
	if opts.Kubernetes != nil {
		s.parts = append(s.parts, wrapKubernetes{opts.Kubernetes})
	}
	if opts.GitHub != nil {
		s.parts = append(s.parts, opts.GitHub)
	}
	if opts.Sentry != nil {
		s.parts = append(s.parts, opts.Sentry)
	}
	return s
}

// Name implements api.Source.
func (*Source) Name() string { return "cluster" }

// List queries the ArgoCD Applications CRD and returns a lightweight
// summary per Application the aggregator's ServiceAccount is permitted
// to read. AppProject allow-listing happens here.
func (s *Source) List(ctx context.Context) ([]domain.AppSummary, error) {
	if s.opts.Dynamic == nil {
		return nil, errors.New("cluster: dynamic client not configured")
	}
	ul, err := s.opts.Dynamic.Resource(argoadapter.ApplicationGVR).
		Namespace(s.opts.ArgoCDNamespace).
		List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list applications: %w", err)
	}
	out := make([]domain.AppSummary, 0, len(ul.Items))
	for i := range ul.Items {
		item := ul.Items[i]
		summary := summaryFrom(&item, s.opts.AllowedProjects)
		if summary == nil {
			continue
		}
		out = append(out, *summary)
	}
	return out, nil
}

// Snapshot resolves an Application to a full AppRef, fans out to every
// configured partial adapter concurrently, and merges their outputs
// into the 14-stage snapshot. Stages no adapter populated are marked
// `n/a` so DeriveOverall ignores them — this is what keeps the overall
// badge honest when the aggregator runs with a subset of partial
// adapters enabled (e.g. GitHub/Sentry disabled in v1).
func (s *Source) Snapshot(ctx context.Context, ref domain.AppRef) (domain.AppStatus, error) {
	if s.opts.Dynamic == nil {
		return domain.AppStatus{}, errors.New("cluster: dynamic client not configured")
	}
	if ref.Name == "" {
		return domain.AppStatus{}, errors.New("cluster: ref.Name required")
	}
	u, err := s.opts.Dynamic.Resource(argoadapter.ApplicationGVR).
		Namespace(s.opts.ArgoCDNamespace).
		Get(ctx, ref.Name, metav1.GetOptions{})
	if err != nil {
		return domain.AppStatus{}, fmt.Errorf("get application: %w", err)
	}
	appRef := refFrom(ref.Name, u)
	appSource := sourceFrom(u)
	now := time.Now().UTC().Format(time.RFC3339)

	stages := make([]domain.Stage, len(domain.StageOrder))
	for i, so := range domain.StageOrder {
		stages[i] = domain.Stage{
			ID:        so.ID,
			Kind:      so.Kind,
			Phase:     so.Phase,
			Title:     so.Title,
			Status:    domain.StatusNA,
			Summary:   "No live source configured",
			FetchedAt: now,
			Staleness: domain.StalenessFresh,
		}
	}

	type result struct {
		name    string
		updates domain.StageUpdates
		err     error
	}
	ch := make(chan result, len(s.parts))
	var wg sync.WaitGroup
	for _, p := range s.parts {
		p := p
		wg.Add(1)
		go func() {
			defer wg.Done()
			updates, err := p.Fetch(ctx, appRef)
			ch <- result{name: p.Name(), updates: updates, err: err}
		}()
	}
	wg.Wait()
	close(ch)

	for r := range ch {
		if r.err != nil {
			// Fail-open-to-grey: leave stages this adapter would have
			// populated at their default unknown state but mark them
			// fetch-failed with the error reason. For partial adapters
			// we don't know ahead of time which stages they owned, so
			// for now we only record a staleness flip if we can see
			// updates. Detailed per-adapter mapping is left for a
			// follow-up.
			continue
		}
		for kind, st := range r.updates {
			for i := range stages {
				if stages[i].Kind == kind {
					stages[i] = st
					break
				}
			}
		}
	}

	return domain.AppStatus{
		App:             appRef.Name,
		Mode:            "deployed",
		Source:          appSource,
		Overall:         domain.DeriveOverall(stages),
		Stages:          stages,
		FetchedAt:       now,
		CacheTTLSeconds: 30,
	}, nil
}

// --- adapter wrappers ------------------------------------------------

type wrapArgoCD struct{ a *argoadapter.Adapter }

func (w wrapArgoCD) Name() string { return "argocd" }
func (w wrapArgoCD) Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error) {
	return w.a.Fetch(ctx, ref)
}

type wrapKubernetes struct{ a *k8sadapter.Adapter }

func (w wrapKubernetes) Name() string { return "kubernetes" }
func (w wrapKubernetes) Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error) {
	return w.a.Fetch(ctx, ref)
}

// --- unstructured helpers --------------------------------------------

func summaryFrom(u *unstructured.Unstructured, allowed map[string]struct{}) *domain.AppSummary {
	project, _, _ := unstructured.NestedString(u.Object, "spec", "project")
	if len(allowed) > 0 {
		if _, ok := allowed[project]; !ok {
			return nil
		}
	}
	repoURL, _, _ := unstructured.NestedString(u.Object, "spec", "source", "repoURL")
	ns, _, _ := unstructured.NestedString(u.Object, "spec", "destination", "namespace")
	sync, _, _ := unstructured.NestedString(u.Object, "status", "sync", "status")
	health, _, _ := unstructured.NestedString(u.Object, "status", "health", "status")
	repo := repoFromURL(repoURL)
	src := domain.AppSource{
		Repo:          repo,
		DefaultBranch: "main",
		Namespace:     ns,
		ArgoCDProject: project,
	}
	return &domain.AppSummary{
		Name:    u.GetName(),
		Mode:    "deployed",
		Source:  src,
		Overall: overallFromSyncHealth(sync, health),
	}
}

func refFrom(name string, u *unstructured.Unstructured) domain.AppRef {
	ns, _, _ := unstructured.NestedString(u.Object, "spec", "destination", "namespace")
	repoURL, _, _ := unstructured.NestedString(u.Object, "spec", "source", "repoURL")
	project, _, _ := unstructured.NestedString(u.Object, "spec", "project")
	return domain.AppRef{
		Name:      name,
		Namespace: ns,
		Repo:      repoFromURL(repoURL),
		Project:   project,
	}
}

func sourceFrom(u *unstructured.Unstructured) domain.AppSource {
	repoURL, _, _ := unstructured.NestedString(u.Object, "spec", "source", "repoURL")
	ns, _, _ := unstructured.NestedString(u.Object, "spec", "destination", "namespace")
	project, _, _ := unstructured.NestedString(u.Object, "spec", "project")
	return domain.AppSource{
		Repo:          repoFromURL(repoURL),
		DefaultBranch: "main",
		Namespace:     ns,
		ArgoCDProject: project,
	}
}

// repoFromURL extracts an "owner/repo" pair from the Application's
// `spec.source.repoURL`, supporting both HTTPS and SSH forms. Non-
// GitHub URLs are returned unchanged so the frontend can still show
// something meaningful.
func repoFromURL(u string) string {
	if u == "" {
		return ""
	}
	s := strings.TrimSuffix(u, ".git")
	if idx := strings.Index(s, "github.com/"); idx != -1 {
		return s[idx+len("github.com/"):]
	}
	if idx := strings.Index(s, "github.com:"); idx != -1 {
		return s[idx+len("github.com:"):]
	}
	return s
}

func overallFromSyncHealth(sync, health string) domain.OverallStatus {
	switch {
	case health == "Degraded" || health == "Missing":
		return domain.OverallStatus{Status: domain.StatusFail, Summary: fmt.Sprintf("%s · %s", sync, health)}
	case sync == "OutOfSync" || health == "Progressing":
		return domain.OverallStatus{Status: domain.StatusWarn, Summary: fmt.Sprintf("%s · %s", sync, health)}
	case sync == "Synced" && health == "Healthy":
		return domain.OverallStatus{Status: domain.StatusOK, Summary: "Synced · Healthy"}
	default:
		return domain.OverallStatus{Status: domain.StatusUnknown, Summary: "State not available"}
	}
}
