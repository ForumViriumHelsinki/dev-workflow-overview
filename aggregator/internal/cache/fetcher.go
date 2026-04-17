package cache

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// Entry is a single cached value with expiry and (optional) failure state.
type Entry[T any] struct {
	Value     T
	FetchedAt time.Time
	ExpiresAt time.Time
	Failed    bool
	Err       error
}

// Fresh reports whether the entry is within its TTL.
func (e Entry[T]) Fresh(now time.Time) bool {
	return !e.Failed && now.Before(e.ExpiresAt)
}

// Fetcher is a per-source TTL cache keyed by string. Concurrent requests
// for the same missing key coalesce through singleflight so an upstream
// is only hit once per refresh window per key.
//
// The zero value is not usable; call NewFetcher.
type Fetcher[T any] struct {
	ttl   time.Duration
	mu    sync.RWMutex
	data  map[string]Entry[T]
	group singleflight.Group
}

// NewFetcher returns a Fetcher with the given TTL. Use SetTTL to change
// the TTL at runtime (e.g., via SIGHUP config reload).
func NewFetcher[T any](ttl time.Duration) *Fetcher[T] {
	return &Fetcher[T]{
		ttl:  ttl,
		data: make(map[string]Entry[T]),
	}
}

// SetTTL changes the TTL used for subsequent writes.
func (f *Fetcher[T]) SetTTL(ttl time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ttl = ttl
}

// Peek returns the cached entry without triggering a fetch.
func (f *Fetcher[T]) Peek(key string) (Entry[T], bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	e, ok := f.data[key]
	return e, ok
}

// Invalidate forces the next Get to bypass the cache for this key.
func (f *Fetcher[T]) Invalidate(key string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.data, key)
}

// Get returns a cached value or fetches via `load` and caches the result.
// Stale-on-failure: when `load` errors but an entry already exists, the
// prior value is returned with Failed=true so the caller can annotate
// staleness=fetch-failed instead of rendering "unknown".
func (f *Fetcher[T]) Get(ctx context.Context, key string, load func(ctx context.Context) (T, error)) (Entry[T], error) {
	now := time.Now()
	if e, ok := f.Peek(key); ok && e.Fresh(now) {
		return e, nil
	}
	v, err, _ := f.group.Do(key, func() (any, error) {
		if e, ok := f.Peek(key); ok && e.Fresh(time.Now()) {
			return e, nil
		}
		val, loadErr := load(ctx)
		f.mu.Lock()
		defer f.mu.Unlock()
		if loadErr != nil {
			if prev, had := f.data[key]; had {
				prev.Failed = true
				prev.Err = loadErr
				f.data[key] = prev
				return prev, loadErr
			}
			return Entry[T]{Failed: true, Err: loadErr, FetchedAt: time.Now()}, loadErr
		}
		e := Entry[T]{
			Value:     val,
			FetchedAt: time.Now(),
			ExpiresAt: time.Now().Add(f.ttl),
		}
		f.data[key] = e
		return e, nil
	})
	if err != nil {
		if e, ok := v.(Entry[T]); ok {
			return e, err
		}
		return Entry[T]{Failed: true, Err: err, FetchedAt: time.Now()}, err
	}
	return v.(Entry[T]), nil
}
