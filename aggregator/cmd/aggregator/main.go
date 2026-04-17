package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/api"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/cache"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/config"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/observability"
	"github.com/ForumViriumHelsinki/dev-workflow-overview/aggregator/internal/sources/fake"
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

	// v1 ships with the fake source only at the main.go level;
	// wiring for live adapters (argocd/kubernetes/github/sentry) lives
	// behind feature flags activated once go.sum is populated.
	fakeSource := fake.New()
	_ = fakeSource // referenced by the fake fetcher; adapters wire in S2.6–S2.9.

	router := chi.NewRouter()
	router.Use(middleware.RequestID)
	router.Use(middleware.RealIP)
	router.Use(middleware.Recoverer)
	router.Use(middleware.Timeout(30 * time.Second))
	router.Use(observability.HTTPMetrics(metrics))

	api.Mount(router, api.Deps{
		Hot:     hot,
		Hub:     hub,
		Source:  fakeSource,
		Metrics: metrics,
		Health:  health,
		Logger:  logger,
		Version: version,
	})

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
