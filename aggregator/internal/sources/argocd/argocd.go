// Package argocd adapts the ArgoCD Application CRD into stage status
// for stages 2 (Provision) and 8 (Deploy). The adapter runs an
// informer against the Kubernetes API so status changes propagate
// without TTL polling.
//
// The Fetch entry point returns a snapshot of both stages for a single
// Application. Aggregator composition lives in package api.
package argocd

import (
	"context"
	"errors"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// ApplicationGVR is the dynamic resource for argoproj.io Applications.
var ApplicationGVR = schema.GroupVersionResource{
	Group:    "argoproj.io",
	Version:  "v1alpha1",
	Resource: "applications",
}

// Adapter is the argocd stage adapter.
type Adapter struct {
	client    dynamic.Interface
	namespace string
	serverURL string
}

// New returns an Adapter using the given client. `namespace` is the
// namespace ArgoCD runs in (typically `argocd`); `serverURL` is the
// base URL used to build deep links.
func New(client dynamic.Interface, namespace, serverURL string) *Adapter {
	return &Adapter{client: client, namespace: namespace, serverURL: serverURL}
}

// Fetch returns the Provision and Deploy stage payloads for `ref`.
// Callers (the aggregator composer) merge the returned StageUpdates
// into the full AppStatus.
func (a *Adapter) Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error) {
	if a == nil || a.client == nil {
		return nil, errors.New("argocd: adapter not configured")
	}
	if ref.Name == "" {
		return nil, errors.New("argocd: ref.Name required")
	}
	u, err := a.client.Resource(ApplicationGVR).
		Namespace(a.namespace).
		Get(ctx, ref.Name, getOpts())
	if err != nil {
		return nil, fmt.Errorf("argocd get: %w", err)
	}
	now := time.Now().UTC().Format(time.RFC3339)

	return domain.StageUpdates{
		domain.StageProvision: buildProvisionStage(u, now),
		domain.StageDeploy:    buildDeployStage(u, now, a.deepLink(ref.Name)),
	}, nil
}

func (a *Adapter) deepLink(name string) []domain.Link {
	if a.serverURL == "" {
		return nil
	}
	return []domain.Link{{
		Label: "ArgoCD",
		Href:  fmt.Sprintf("%s/applications/%s", a.serverURL, name),
	}}
}

func buildProvisionStage(u *unstructured.Unstructured, now string) domain.Stage {
	st := domain.Stage{
		ID:        2,
		Kind:      domain.StageProvision,
		Phase:     domain.PhaseSetup,
		Title:     "Provision",
		Status:    domain.StatusOK,
		Summary:   "ArgoCD Application exists",
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
	}
	if u == nil {
		st.Status = domain.StatusFail
		st.Summary = "Application missing"
		return st
	}
	created, _, _ := unstructured.NestedString(u.Object, "metadata", "creationTimestamp")
	conds, _, _ := unstructured.NestedSlice(u.Object, "status", "conditions")
	anyErr := false
	for _, c := range conds {
		if cm, ok := c.(map[string]any); ok {
			t, _ := cm["type"].(string)
			if len(t) >= 5 && t[len(t)-5:] == "Error" {
				anyErr = true
				break
			}
		}
	}
	if anyErr {
		st.Status = domain.StatusWarn
		st.Summary = "Application has error conditions"
	}
	st.Details = map[string]any{
		"applicationExists":    true,
		"applicationCreatedAt": created,
		"conditions":           conds,
	}
	return st
}

func buildDeployStage(u *unstructured.Unstructured, now string, links []domain.Link) domain.Stage {
	st := domain.Stage{
		ID:        8,
		Kind:      domain.StageDeploy,
		Phase:     domain.PhaseShip,
		Title:     "Deploy",
		Status:    domain.StatusUnknown,
		FetchedAt: now,
		Staleness: domain.StalenessFresh,
		Links:     links,
	}
	sync, _, _ := unstructured.NestedString(u.Object, "status", "sync", "status")
	health, _, _ := unstructured.NestedString(u.Object, "status", "health", "status")
	revision, _, _ := unstructured.NestedString(u.Object, "status", "sync", "revision")
	opPhase, _, _ := unstructured.NestedString(u.Object, "status", "operationState", "phase")

	st.Details = map[string]any{
		"syncStatus":     sync,
		"healthStatus":   health,
		"syncRevision":   revision,
		"operationPhase": opPhase,
	}

	switch {
	case health == "Degraded" || health == "Missing" || opPhase == "Failed" || opPhase == "Error":
		st.Status = domain.StatusFail
		st.Summary = fmt.Sprintf("%s · %s", sync, health)
	case sync == "OutOfSync" || health == "Progressing":
		st.Status = domain.StatusWarn
		st.Summary = fmt.Sprintf("%s · %s", sync, health)
	case sync == "Synced" && health == "Healthy":
		st.Status = domain.StatusOK
		st.Summary = fmt.Sprintf("Synced · Healthy · rev %s", short(revision))
	default:
		st.Status = domain.StatusUnknown
		st.Summary = "State not available"
	}
	return st
}

func short(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}
