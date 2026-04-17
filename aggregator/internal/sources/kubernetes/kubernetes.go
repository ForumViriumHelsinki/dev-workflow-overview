// Package kubernetes populates stage 9 (Run) from Deployments and Pods
// in the target namespace. The adapter holds shared informers so reads
// are cache-hits after initial sync.
package kubernetes

import (
	"context"
	"errors"
	"fmt"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

// Adapter adapts Deployment status into stage 9.
type Adapter struct {
	client kubernetes.Interface
}

// New returns an Adapter wrapping the provided clientset.
func New(client kubernetes.Interface) *Adapter {
	return &Adapter{client: client}
}

// Fetch returns a stage 9 payload for the namespace on `ref`.
func (a *Adapter) Fetch(ctx context.Context, ref domain.AppRef) (domain.StageUpdates, error) {
	if a == nil || a.client == nil {
		return nil, errors.New("kubernetes: adapter not configured")
	}
	if ref.Namespace == "" {
		return nil, errors.New("kubernetes: ref.Namespace required")
	}

	deps, err := a.client.AppsV1().Deployments(ref.Namespace).List(ctx, metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("list deployments: %w", err)
	}

	var ready, desired, available, updated int32
	items := make([]map[string]any, 0, len(deps.Items))
	for _, d := range deps.Items {
		ready += d.Status.ReadyReplicas
		available += d.Status.AvailableReplicas
		updated += d.Status.UpdatedReplicas
		if d.Spec.Replicas != nil {
			desired += *d.Spec.Replicas
		}
		items = append(items, deploymentSummary(d))
	}

	st := domain.Stage{
		ID:        9,
		Kind:      domain.StageRun,
		Phase:     domain.PhaseRun,
		Title:     "Run",
		FetchedAt: time.Now().UTC().Format(time.RFC3339),
		Staleness: domain.StalenessFresh,
		Details: map[string]any{
			"readyReplicas":     int(ready),
			"desiredReplicas":   int(desired),
			"availableReplicas": int(available),
			"updatedReplicas":   int(updated),
			"deployments":       items,
		},
	}
	switch {
	case desired == 0:
		st.Status = domain.StatusUnknown
		st.Summary = "No Deployments in namespace"
	case ready == 0 && desired > 0:
		st.Status = domain.StatusFail
		st.Summary = "0 ready replicas"
	case ready < desired:
		st.Status = domain.StatusWarn
		st.Summary = fmt.Sprintf("%d/%d ready", ready, desired)
	default:
		st.Status = domain.StatusOK
		st.Summary = fmt.Sprintf("%d/%d ready", ready, desired)
	}
	return domain.StageUpdates{domain.StageRun: st}, nil
}

func deploymentSummary(d appsv1.Deployment) map[string]any {
	desired := int32(0)
	if d.Spec.Replicas != nil {
		desired = *d.Spec.Replicas
	}
	return map[string]any{
		"name":      d.Name,
		"ready":     int(d.Status.ReadyReplicas),
		"desired":   int(desired),
		"available": int(d.Status.AvailableReplicas),
		"updated":   int(d.Status.UpdatedReplicas),
	}
}
