package config

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/kelseyhightower/envconfig"
)

// Config is loaded from environment variables. See PRP-002 §4.5.
type Config struct {
	Port     int    `envconfig:"PORT" default:"8080"`
	LogLevel string `envconfig:"LOG_LEVEL" default:"info"`

	// GitHub App (required when the github adapter is active).
	GitHubAppID             int64  `envconfig:"GITHUB_APP_ID"`
	GitHubAppInstallationID int64  `envconfig:"GITHUB_APP_INSTALLATION_ID"`
	GitHubAppPrivateKey     string `envconfig:"GITHUB_APP_PRIVATE_KEY"`
	GitHubOrg               string `envconfig:"GITHUB_ORG" default:"ForumViriumHelsinki"`

	// Sentry (required when the sentry adapter is active).
	SentryAPIToken string `envconfig:"SENTRY_API_TOKEN"`
	SentryOrgSlug  string `envconfig:"SENTRY_ORG_SLUG"`
	SentryDSN      string `envconfig:"SENTRY_DSN"`

	// ArgoCD / Kubernetes.
	ArgoCDServer       string   `envconfig:"ARGOCD_SERVER" default:"argocd-server.argocd.svc:443"`
	AppProjectsAllowed []string `envconfig:"APPPROJECTS_ALLOWED"`

	// Feature flags hook (unused in v1 per PRP-002).
	GOFFClientID string `envconfig:"GOFF_CLIENT_ID"`

	// Cache TTLs per source. Defaults chosen per ADR-0011.
	CacheTTLArgoCD     time.Duration `envconfig:"CACHE_TTL_ARGOCD" default:"10s"`
	CacheTTLKubernetes time.Duration `envconfig:"CACHE_TTL_KUBERNETES" default:"10s"`
	CacheTTLGitHub     time.Duration `envconfig:"CACHE_TTL_GITHUB" default:"120s"`
	CacheTTLSentry     time.Duration `envconfig:"CACHE_TTL_SENTRY" default:"60s"`

	// Enablement flags per source — let the aggregator run with any
	// subset enabled, so early environments can boot before every
	// upstream is provisioned.
	EnableGitHub     bool `envconfig:"ENABLE_GITHUB" default:"false"`
	EnableSentry     bool `envconfig:"ENABLE_SENTRY" default:"false"`
	EnableArgoCD     bool `envconfig:"ENABLE_ARGOCD" default:"false"`
	EnableKubernetes bool `envconfig:"ENABLE_KUBERNETES" default:"false"`

	// Enable the fake source for local development / smoke tests. When
	// true and no other source is enabled the aggregator serves a
	// deterministic fixture so the frontend can be exercised without
	// any live infrastructure.
	EnableFake bool `envconfig:"ENABLE_FAKE" default:"true"`
}

// Load reads configuration from the environment and validates it.
func Load() (Config, error) {
	var c Config
	if err := envconfig.Process("", &c); err != nil {
		return c, fmt.Errorf("envconfig: %w", err)
	}
	if err := c.Validate(); err != nil {
		return c, err
	}
	return c, nil
}

// Validate runs cross-field startup checks — fail fast on missing
// secrets for any upstream the operator opted in to.
func (c Config) Validate() error {
	var errs []error
	if c.Port <= 0 || c.Port > 65535 {
		errs = append(errs, fmt.Errorf("PORT out of range: %d", c.Port))
	}
	if c.EnableGitHub {
		if c.GitHubAppID == 0 || c.GitHubAppInstallationID == 0 || strings.TrimSpace(c.GitHubAppPrivateKey) == "" {
			errs = append(errs, errors.New("ENABLE_GITHUB=true requires GITHUB_APP_ID, GITHUB_APP_INSTALLATION_ID, GITHUB_APP_PRIVATE_KEY"))
		}
	}
	if c.EnableSentry {
		if c.SentryAPIToken == "" || c.SentryOrgSlug == "" {
			errs = append(errs, errors.New("ENABLE_SENTRY=true requires SENTRY_API_TOKEN and SENTRY_ORG_SLUG"))
		}
	}
	return errors.Join(errs...)
}

// SlogLevel returns the configured slog level.
func (c Config) SlogLevel() slog.Level {
	switch strings.ToLower(c.LogLevel) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// AppProjectsSet returns the allowed AppProjects as a set, or nil when
// the operator opted in to the default "all projects visible to RBAC".
func (c Config) AppProjectsSet() map[string]struct{} {
	if len(c.AppProjectsAllowed) == 0 {
		return nil
	}
	set := make(map[string]struct{}, len(c.AppProjectsAllowed))
	for _, p := range c.AppProjectsAllowed {
		p = strings.TrimSpace(p)
		if p != "" {
			set[p] = struct{}{}
		}
	}
	return set
}

// RunningInCluster is a convenience check for in-cluster config.
func RunningInCluster() bool {
	_, err := os.Stat("/var/run/secrets/kubernetes.io/serviceaccount/token")
	return err == nil
}
