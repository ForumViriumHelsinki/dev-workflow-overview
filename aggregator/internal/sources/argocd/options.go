package argocd

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// getOpts is extracted to a helper so tests can shadow it without
// pulling in the whole metav1 package surface in every fixture.
func getOpts() metav1.GetOptions { return metav1.GetOptions{} }
