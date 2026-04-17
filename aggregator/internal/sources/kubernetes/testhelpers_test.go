package kubernetes

import "k8s.io/apimachinery/pkg/runtime"

// anyToRuntime converts arbitrary kubernetes API objects to the
// runtime.Object interface expected by fake.NewSimpleClientset.
func anyToRuntime(objs ...any) []runtime.Object {
	out := make([]runtime.Object, 0, len(objs))
	for _, o := range objs {
		if ro, ok := o.(runtime.Object); ok {
			out = append(out, ro)
		}
	}
	return out
}
