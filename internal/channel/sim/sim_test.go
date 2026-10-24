package sim

import (
	"context"
	"testing"
	"time"
)

func TestHubEvents(t *testing.T) {
	h := NewHub()
	ctx := context.Background()
	peer := "sim:bob"
	_ = h.MarkRead(ctx, 1, peer)
	_ = h.Typing(ctx, 1, peer)
	_ = h.Typing(ctx, 1, peer) // coalesced
	_ = h.Send(ctx, 1, peer, "wah really ah", 42)
	_ = h.Send(ctx, 1, peer, "wah really ah", 42) // retried send, delivered once
	_ = h.Send(ctx, 2, peer, "other account", 1)  // different chat

	evs := h.Events(ctx, 1, peer, 0, 0)
	kinds := ""
	for _, e := range evs {
		kinds += e.Kind + ","
	}
	if kinds != "read,typing,message," || evs[2].Text != "wah really ah" {
		t.Fatalf("events = %+v", evs)
	}
	if got := h.Events(ctx, 1, peer, evs[2].Seq, 0); len(got) != 0 {
		t.Fatalf("nothing new expected after last seq, got %+v", got)
	}
}

func TestHubLongPoll(t *testing.T) {
	h := NewHub()
	ctx := context.Background()
	go func() {
		time.Sleep(50 * time.Millisecond)
		_ = h.Send(ctx, 1, "sim:bob", "hello", 7)
	}()
	start := time.Now()
	evs := h.Events(ctx, 1, "sim:bob", 0, 5*time.Second)
	if len(evs) != 1 || evs[0].Text != "hello" || time.Since(start) > 2*time.Second {
		t.Fatalf("long poll returned %+v after %v", evs, time.Since(start))
	}
	if got := h.Events(ctx, 1, "sim:bob", evs[0].Seq, 30*time.Millisecond); got != nil {
		t.Fatalf("timeout should return nil, got %+v", got)
	}
}

func TestIsSimAccount(t *testing.T) {
	if !IsSimAccount("sim:local") || IsSimAccount("file:tg_60123.json") {
		t.Fatal("IsSimAccount")
	}
}
