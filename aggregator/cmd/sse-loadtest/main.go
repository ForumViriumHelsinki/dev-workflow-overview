// sse-loadtest opens N concurrent Server-Sent Events streams against
// the aggregator and holds them open for the configured duration, so
// the operator can observe the service's memory and goroutine counts
// under steady-state load. The purpose is PRP-002 NFR4: 100 concurrent
// SSE × 10 min at <256Mi RSS with stable goroutines.
//
// Usage:
//
//	go run ./cmd/sse-loadtest \
//	    -url http://localhost:8080/api/v1/apps/fake/events \
//	    -n 100 \
//	    -duration 10m
//
// The tool prints a running summary every 30s: frames received, frames
// per second, streams still open, first errors (bounded).
package main

import (
	"bufio"
	"context"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type summary struct {
	framesTotal atomic.Int64
	openStreams atomic.Int64
	errCount    atomic.Int64
}

func main() {
	url := flag.String("url", "http://localhost:8080/api/v1/apps/fake/events", "SSE endpoint")
	n := flag.Int("n", 100, "concurrent connections")
	duration := flag.Duration("duration", 10*time.Minute, "hold connections open for this long")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	runCtx, cancel := context.WithTimeout(ctx, *duration)
	defer cancel()

	fmt.Fprintf(os.Stderr, "sse-loadtest: %d connections → %s for %s\n", *n, *url, *duration)

	s := &summary{}
	var wg sync.WaitGroup
	for i := 0; i < *n; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			runStream(runCtx, *url, id, s)
		}(i)
	}

	// Progress ticker.
	tick := time.NewTicker(30 * time.Second)
	defer tick.Stop()
	start := time.Now()
	go func() {
		for {
			select {
			case <-runCtx.Done():
				return
			case t := <-tick.C:
				elapsed := t.Sub(start).Seconds()
				frames := s.framesTotal.Load()
				fmt.Fprintf(os.Stderr,
					"t=%ds open=%d frames=%d fps=%.1f errs=%d\n",
					int(elapsed),
					s.openStreams.Load(),
					frames,
					float64(frames)/elapsed,
					s.errCount.Load(),
				)
			}
		}
	}()

	wg.Wait()
	elapsed := time.Since(start).Seconds()
	fmt.Fprintf(os.Stderr,
		"done: elapsed=%.1fs frames=%d fps=%.1f errs=%d\n",
		elapsed, s.framesTotal.Load(),
		float64(s.framesTotal.Load())/elapsed,
		s.errCount.Load(),
	)
}

func runStream(ctx context.Context, url string, id int, s *summary) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		s.errCount.Add(1)
		return
	}
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Cache-Control", "no-cache")

	// No keep-alive tuning — we want the aggregator's default behaviour.
	client := &http.Client{Timeout: 0}
	resp, err := client.Do(req)
	if err != nil {
		if ctx.Err() == nil {
			s.errCount.Add(1)
		}
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		s.errCount.Add(1)
		_, _ = io.Copy(io.Discard, resp.Body)
		return
	}
	s.openStreams.Add(1)
	defer s.openStreams.Add(-1)

	r := bufio.NewReader(resp.Body)
	for {
		line, err := r.ReadBytes('\n')
		if err != nil {
			if ctx.Err() == nil && err != io.EOF {
				s.errCount.Add(1)
			}
			return
		}
		// SSE frames are separated by blank lines; each non-empty line
		// that starts with "data:" counts as a frame received. We don't
		// need to parse — just count frames to verify liveness.
		if len(line) > 5 && (line[0] == 'd' || line[0] == 'e') {
			s.framesTotal.Add(1)
		}
	}
}
