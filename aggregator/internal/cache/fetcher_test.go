package cache

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestFetcher_HitAndMiss(t *testing.T) {
	f := NewFetcher[int](time.Minute)
	calls := 0
	loader := func(_ context.Context) (int, error) {
		calls++
		return 42, nil
	}

	e1, err := f.Get(context.Background(), "k", loader)
	if err != nil {
		t.Fatalf("first Get: %v", err)
	}
	if e1.Value != 42 || calls != 1 {
		t.Fatalf("unexpected first Get: %+v calls=%d", e1, calls)
	}
	e2, err := f.Get(context.Background(), "k", loader)
	if err != nil {
		t.Fatalf("second Get: %v", err)
	}
	if e2.Value != 42 || calls != 1 {
		t.Fatalf("second call should be cache hit: calls=%d", calls)
	}
}

func TestFetcher_Singleflight(t *testing.T) {
	f := NewFetcher[int](time.Minute)
	var calls atomic.Int64
	loader := func(ctx context.Context) (int, error) {
		calls.Add(1)
		time.Sleep(20 * time.Millisecond)
		return 7, nil
	}

	var wg sync.WaitGroup
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := f.Get(context.Background(), "k", loader); err != nil {
				t.Errorf("get: %v", err)
			}
		}()
	}
	wg.Wait()
	if got := calls.Load(); got != 1 {
		t.Fatalf("expected 1 coalesced call, got %d", got)
	}
}

func TestFetcher_FailurePreservesPrior(t *testing.T) {
	f := NewFetcher[int](50 * time.Millisecond)
	calls := 0
	loader := func(_ context.Context) (int, error) {
		calls++
		if calls == 1 {
			return 1, nil
		}
		return 0, errors.New("boom")
	}

	if _, err := f.Get(context.Background(), "k", loader); err != nil {
		t.Fatalf("first: %v", err)
	}
	time.Sleep(60 * time.Millisecond)
	e, err := f.Get(context.Background(), "k", loader)
	if err == nil {
		t.Fatalf("second call should have errored")
	}
	if !e.Failed {
		t.Fatalf("entry should be marked Failed")
	}
	if e.Value != 1 {
		t.Fatalf("prior value should be preserved, got %d", e.Value)
	}
}
