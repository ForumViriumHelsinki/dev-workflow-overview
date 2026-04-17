package kubernetes

import (
	"context"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/domain"
)

func deploy(name string, ready, desired int32) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "ns"},
		Spec: appsv1.DeploymentSpec{Replicas: &desired},
		Status: appsv1.DeploymentStatus{
			ReadyReplicas:     ready,
			AvailableReplicas: ready,
			UpdatedReplicas:   ready,
		},
	}
}

func TestKubernetes_RunStageMapping(t *testing.T) {
	cases := []struct {
		name string
		ds   []*appsv1.Deployment
		want domain.StatusCode
	}{
		{"healthy", []*appsv1.Deployment{deploy("api", 3, 3)}, domain.StatusOK},
		{"partial", []*appsv1.Deployment{deploy("api", 1, 3)}, domain.StatusWarn},
		{"zero", []*appsv1.Deployment{deploy("api", 0, 3)}, domain.StatusFail},
		{"empty", nil, domain.StatusUnknown},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			objs := make([]any, 0, len(tc.ds))
			for _, d := range tc.ds {
				objs = append(objs, d)
			}
			client := fake.NewSimpleClientset(anyToRuntime(objs...)...)
			a := New(client)
			upd, err := a.Fetch(context.Background(), domain.AppRef{Namespace: "ns"})
			if err != nil {
				t.Fatalf("fetch: %v", err)
			}
			if got := upd[domain.StageRun].Status; got != tc.want {
				t.Fatalf("%s: want %q, got %q", tc.name, tc.want, got)
			}
		})
	}
}
