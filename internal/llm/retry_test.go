package llm

import (
	"context"
	"errors"
	"testing"
	"time"
)

// flaky stalls on the first `stalls` calls (until its context ends), then answers.
type flaky struct {
	stalls, calls int
	err           error
}

func (f *flaky) Name() string { return "flaky" }
func (f *flaky) Generate(ctx context.Context, _ Request) (string, error) {
	f.calls++
	if f.calls <= f.stalls {
		<-ctx.Done()
		return "", ctx.Err()
	}
	if f.err != nil {
		return "", f.err
	}
	return "ok", nil
}

func TestRetryingRecoversFromStall(t *testing.T) {
	f := &flaky{stalls: 1}
	r := Retrying{Inner: f, Attempts: 3, PerTry: 50 * time.Millisecond}
	start := time.Now()
	out, err := r.Generate(context.Background(), Request{})
	if err != nil || out != "ok" || f.calls != 2 {
		t.Fatalf("got %q, %v after %d calls", out, err, f.calls)
	}
	if time.Since(start) > time.Second {
		t.Fatal("retry took too long")
	}
}

func TestRetryingGivesUp(t *testing.T) {
	f := &flaky{stalls: 10}
	r := Retrying{Inner: f, Attempts: 3, PerTry: 20 * time.Millisecond}
	if _, err := r.Generate(context.Background(), Request{}); err == nil || f.calls != 3 {
		t.Fatalf("want error after 3 calls, got %v after %d", err, f.calls)
	}
}

func TestRetryingRespectsCallerDeadline(t *testing.T) {
	f := &flaky{stalls: 10}
	r := Retrying{Inner: f, Attempts: 10, PerTry: time.Second}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Millisecond)
	defer cancel()
	start := time.Now()
	_, _ = r.Generate(ctx, Request{})
	if time.Since(start) > 500*time.Millisecond || f.calls != 1 {
		t.Fatalf("should stop with the caller: %v, %d calls", time.Since(start), f.calls)
	}
}

func TestRetryingDoesNotRetryPermanentErrors(t *testing.T) {
	f := &flaky{err: errors.New("gemini: HTTP 400: INVALID_ARGUMENT")}
	r := Retrying{Inner: f, Attempts: 3, PerTry: time.Second}
	if _, err := r.Generate(context.Background(), Request{}); err == nil || f.calls != 1 {
		t.Fatalf("400 must not be retried: %v, %d calls", err, f.calls)
	}
	f2 := &flaky{err: errors.New("gemini: HTTP 503: UNAVAILABLE")}
	r.Inner = f2
	if _, err := r.Generate(context.Background(), Request{}); err == nil || f2.calls != 3 {
		t.Fatalf("503 should be retried: %v, %d calls", err, f2.calls)
	}
	f3 := &flaky{err: ErrBlocked}
	r.Inner = f3
	if _, err := r.Generate(context.Background(), Request{}); !errors.Is(err, ErrBlocked) || f3.calls != 1 {
		t.Fatalf("blocked must not be retried: %v, %d calls", err, f3.calls)
	}
}
