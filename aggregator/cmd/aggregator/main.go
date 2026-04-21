package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/pprof"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/api"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/cache"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/config"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/observability"
	argoadapter "github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/argocd"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/cluster"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/fake"
	k8sadapter "github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/kubernetes"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/web"
)

// Build metadata populated via -ldflags at build time.
var (
	version   = "dev"
	commit    = "unknown"
	buildDate = "unknown"
)

func main() {
	if err := run(); err != nil {
		slog.Error("fatal", "error", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}

	logger := observability.NewLogger(cfg.LogLevel)
	slog.SetDefault(logger)
	logger.Info("starting status-aggregator",
		"version", version, "commit", commit, "buildDate", buildDate,
		"port", cfg.Port)

	metrics := observability.NewMetrics()
	health := observability.NewHealth()

	if err := observability.InitSentry(cfg.SentryDSN, version); err != nil {
		logger.Warn("sentry init failed", "error", err)
	}

	hot := cache.NewHot()
	hub := api.NewHub(logger)

	source, err := buildSource(cfg, logger)
	if err != nil {
		return fmt.Errorf("source: %w", err)
	}
	logger.Info("source configured", "source", source.Name())

	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Recoverer)
	// middleware.Timeout is intentionally not applied globally — it
	// wraps the ResponseWriter in a way that breaks long-lived SSE
	// streams. Short per-handler deadlines come from the handler's
	// r.Context() and the net/http ReadHeaderTimeout below.
	router.Use(observability.HTTPMetrics(metrics))

	api.Mount(router, api.Deps{
		Hot:     hot,
		Hub:     hub,
		Source:  source,
		Metrics: metrics,
		Health:  health,
		Logger:  logger,
		Version: version,
	})

	if cfg.EnablePprof {
		// Dev/profiling only — must stay off in production.
		logger.Warn("pprof enabled — do not run with ENABLE_PPROF in production")
		router.Route("/debug/pprof", func(r chi.Router) {
			r.Get("/", pprof.Index)
			r.Get("/cmdline", pprof.Cmdline)
			r.Get("/profile", pprof.Profile)
			r.Post("/symbol", pprof.Symbol)
			r.Get("/symbol", pprof.Symbol)
			r.Get("/trace", pprof.Trace)
			r.Get("/{name}", func(w http.ResponseWriter, req *http.Request) {
				pprof.Handler(chi.URLParam(req, "name")).ServeHTTP(w, req)
			})
		})
	}

	// Serve the embedded frontend bundle on any path the API routes
	// didn't match. Chi's NotFound handler runs after every Mount/Route
	// above, so /api/* and /healthz still win.
	router.NotFound(web.Handler().ServeHTTP)

	srv := &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		logger.Info("http server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	hub.Close()
	logger.Info("shutdown complete")
	return nil
}

// buildSource picks a Source implementation based on the enablement
// flags. ENABLE_ARGOCD=true switches to the in-cluster composite that
// fans out to the ArgoCD, Kubernetes (and later GitHub/Sentry) partial
// adapters. Otherwise the deterministic fake source is used for local
// dev and integration tests.
func buildSource(cfg config.Config, logger *slog.Logger) (api.Source, error) {
	if !cfg.EnableArgoCD && !cfg.EnableKubernetes {
		logger.Info("using fake source (no live adapters enabled)")
		return fake.New(), nil
	}

	kubeCfg, err := loadKubeConfig()
	if err != nil {
		return nil, fmt.Errorf("kube config: %w", err)
	}
	dyn, err := dynamic.NewForConfig(kubeCfg)
	if err != nil {
		return nil, fmt.Errorf("dynamic client: %w", err)
	}
	cs, err := kubernetes.NewForConfig(kubeCfg)
	if err != nil {
		return nil, fmt.Errorf("clientset: %w", err)
	}

	opts := cluster.Options{
		Dynamic:         dyn,
		Clientset:       cs,
		ArgoCDNamespace: cfg.ArgoCDNamespace,
		ArgoCDServerURL: argoServerDeepLinkURL(cfg.ArgoCDServer),
		AllowedProjects: cfg.AppProjectsSet(),
	}
	if cfg.EnableArgoCD {
		opts.ArgoCD = argoadapter.New(dyn, cfg.ArgoCDNamespace, opts.ArgoCDServerURL)
	}
	if cfg.EnableKubernetes {
		opts.Kubernetes = k8sadapter.New(cs)
	}
	return cluster.New(opts), nil
}

// loadKubeConfig prefers in-cluster config when a service-account token
// is mounted; otherwise falls back to $KUBECONFIG / ~/.kube/config so
// the binary can be `go run` against a local cluster too.
func loadKubeConfig() (*rest.Config, error) {
	if config.RunningInCluster() {
		return rest.InClusterConfig()
	}
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		if home, err := os.UserHomeDir(); err == nil {
			kubeconfig = filepath.Join(home, ".kube", "config")
		}
	}
	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}

// argoServerDeepLinkURL turns ARGOCD_SERVER (a grpc/svc address) into a
// best-effort HTTP base URL for tooltip deep links. Empty string means
// no deep links.
func argoServerDeepLinkURL(server string) string {
	if server == "" {
		return ""
	}
	// Intentionally simple: production sets a full URL via the
	// ArgoCD Application's spec; the aggregator's URL builder just
	// prefixes "https://" when the user didn't supply a scheme.
	if len(server) >= 7 && (server[:7] == "http://" || (len(server) >= 8 && server[:8] == "https://")) {
		return server
	}
	return "https://" + server
}
