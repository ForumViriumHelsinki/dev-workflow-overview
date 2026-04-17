package observability

import (
	"context"
	"errors"
	"time"

	"github.com/getsentry/sentry-go"
)

// InitSentry wires the Sentry SDK for the aggregator's own errors.
// A blank DSN is treated as "disabled"; no other mode is supported.
func InitSentry(dsn, release string) error {
	if dsn == "" {
		return nil
	}
	return sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Release:          release,
		TracesSampleRate: 0.0,
		AttachStacktrace: true,
	})
}

// CaptureError reports an error to Sentry if the SDK is initialized.
// Safe to call when Sentry is not configured (no-op).
func CaptureError(err error) {
	if err == nil {
		return
	}
	if hub := sentry.CurrentHub(); hub != nil && hub.Client() != nil {
		hub.CaptureException(err)
	}
}

// FlushSentry drains pending events before process exit.
func FlushSentry(ctx context.Context) error {
	if hub := sentry.CurrentHub(); hub == nil || hub.Client() == nil {
		return nil
	}
	deadline, ok := ctx.Deadline()
	timeout := 5 * time.Second
	if ok {
		timeout = time.Until(deadline)
	}
	if !sentry.Flush(timeout) {
		return errors.New("sentry flush timeout")
	}
	return nil
}
