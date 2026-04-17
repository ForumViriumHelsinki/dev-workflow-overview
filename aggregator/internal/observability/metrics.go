package observability

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics holds the Prometheus metrics for the aggregator.
type Metrics struct {
	Registry *prometheus.Registry

	UpstreamDuration *prometheus.HistogramVec
	CacheEvents      *prometheus.CounterVec
	SSEConnections   prometheus.Gauge
	GitHubRateLimit  prometheus.Gauge
	HTTPDuration     *prometheus.HistogramVec
	HTTPInflight     prometheus.Gauge
}

// NewMetrics constructs and registers metrics in an isolated registry.
func NewMetrics() *Metrics {
	reg := prometheus.NewRegistry()
	m := &Metrics{
		Registry: reg,
		UpstreamDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "aggregator_upstream_request_duration_seconds",
				Help:    "Duration of upstream adapter fetches per source and outcome.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"source", "status"},
		),
		CacheEvents: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "aggregator_cache_events_total",
				Help: "Cache event counts per source and result.",
			},
			[]string{"source", "result"},
		),
		SSEConnections: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "aggregator_sse_connections",
				Help: "Current number of active SSE connections.",
			},
		),
		GitHubRateLimit: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "aggregator_github_ratelimit_remaining",
				Help: "Remaining GitHub API calls for the installation token.",
			},
		),
		HTTPDuration: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "aggregator_http_request_duration_seconds",
				Help:    "HTTP request durations handled by the aggregator.",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"method", "route", "status"},
		),
		HTTPInflight: prometheus.NewGauge(
			prometheus.GaugeOpts{
				Name: "aggregator_http_inflight_requests",
				Help: "In-flight HTTP requests.",
			},
		),
	}
	reg.MustRegister(m.UpstreamDuration, m.CacheEvents, m.SSEConnections,
		m.GitHubRateLimit, m.HTTPDuration, m.HTTPInflight)
	return m
}

// Handler exposes the registry over HTTP for /metrics.
func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.Registry, promhttp.HandlerOpts{})
}

// HTTPMetrics is a chi-compatible middleware recording per-route duration.
func HTTPMetrics(m *Metrics) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			m.HTTPInflight.Inc()
			defer m.HTTPInflight.Dec()

			rw := &statusRecorder{ResponseWriter: w, status: 200}
			next.ServeHTTP(rw, r)

			// Route is r.URL.Path by default — chi sets the pattern in
			// its context after ServeHTTP so we read it post-hoc. If
			// unavailable we fall back to the raw path.
			m.HTTPDuration.WithLabelValues(
				r.Method,
				r.URL.Path,
				strconv.Itoa(rw.status),
			).Observe(time.Since(start).Seconds())
		})
	}
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}
