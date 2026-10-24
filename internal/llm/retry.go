package llm

import (
	"context"
	"errors"
	"strings"
	"time"
)

// Retrying wraps a Client so a stalled or briefly failing call is retried with a fresh short
// deadline instead of using up the caller's whole time budget. LLM APIs (Gemini in particular)
// sometimes accept a request and never answer; the next attempt usually returns in seconds.
type Retrying struct {
	Inner    Client
	Attempts int           // total tries, including the first
	PerTry   time.Duration // time limit for each try
	Backoff  time.Duration // pause between tries
}

func (r Retrying) Name() string { return r.Inner.Name() }

func (r Retrying) Generate(ctx context.Context, req Request) (string, error) {
	attempts := max(r.Attempts, 1)
	var lastErr error
	for i := 0; i < attempts; i++ {
		if i > 0 && r.Backoff > 0 {
			select {
			case <-ctx.Done():
				return "", lastErr
			case <-time.After(r.Backoff):
			}
		}
		tryCtx, cancel := ctx, context.CancelFunc(func() {})
		if r.PerTry > 0 {
			tryCtx, cancel = context.WithTimeout(ctx, r.PerTry)
		}
		out, err := r.Inner.Generate(tryCtx, req)
		stalled := tryCtx.Err() != nil && ctx.Err() == nil // this try timed out, the caller has time left
		cancel()
		if err == nil {
			return out, nil
		}
		lastErr = err
		if ctx.Err() != nil || errors.Is(err, ErrBlocked) || (!stalled && !retryable(err)) {
			return "", err
		}
	}
	return "", lastErr
}

// retryable reports transient API errors: rate limits, server errors and dropped connections.
func retryable(err error) bool {
	s := err.Error()
	for _, code := range []string{"HTTP 429", "HTTP 500", "HTTP 502", "HTTP 503", "HTTP 504", "connection reset", "EOF", "timeout"} {
		if strings.Contains(s, code) {
			return true
		}
	}
	return false
}
