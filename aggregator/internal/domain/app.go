package domain

// AppRef identifies an application for a source adapter. Either Name
// (ArgoCD Application) or Repo (pre-deploy fallback) may be set; both
// may be present once the Application is resolved.
type AppRef struct {
	Name       string
	Repo       string
	Namespace  string
	Project    string
	SentryProj string
}

// AppSource mirrors the OpenAPI AppSource schema.
type AppSource struct {
	Repo            string  `json:"repo"`
	DefaultBranch   string  `json:"defaultBranch,omitempty"`
	Namespace       string  `json:"namespace,omitempty"`
	ArgoCDProject   string  `json:"argocdProject,omitempty"`
	SentryProject   *string `json:"sentryProject,omitempty"`
	ImageRepository *string `json:"imageRepository,omitempty"`
}

// AppSummary is returned by /api/v1/apps.
type AppSummary struct {
	Name    string        `json:"name"`
	Mode    string        `json:"mode"`
	Source  AppSource     `json:"source"`
	Overall OverallStatus `json:"overall"`
}

// AppList is the response body of /api/v1/apps.
type AppList struct {
	Apps      []AppSummary `json:"apps"`
	FetchedAt string       `json:"fetchedAt"`
}

// AppStatus is the full snapshot returned by /api/v1/apps/{name}/status
// and emitted as the `snapshot` SSE event.
type AppStatus struct {
	App             string        `json:"app"`
	Mode            string        `json:"mode"`
	Source          AppSource     `json:"source"`
	Overall         OverallStatus `json:"overall"`
	Stages          []Stage       `json:"stages"`
	FetchedAt       string        `json:"fetchedAt"`
	CacheTTLSeconds int           `json:"cacheTtlSeconds,omitempty"`
}
