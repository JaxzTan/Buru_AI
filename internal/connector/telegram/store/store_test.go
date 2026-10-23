package store

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/gotd/td/telegram/updates"
	"github.com/redis/go-redis/v9"
)

var (
	_ Store = (*Memory)(nil)
	_ Store = (*Redis)(nil)
)

func newRedis(t *testing.T) (*Redis, *miniredis.Miniredis) {
	t.Helper()
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	return NewRedis(rdb), mr
}

func backends(t *testing.T) map[string]Store {
	r, _ := newRedis(t)
	return map[string]Store{"memory": NewMemory(), "redis": r}
}

// TestContract runs the same steps against every backend so they behave identically for gotd.
func TestContract(t *testing.T) {
	const self, other = int64(1001), int64(2002)
	for name, st := range backends(t) {
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			steps := []struct {
				name string
				run  func() error
			}{
				{"no state yet", func() error {
					if _, found, err := st.GetState(ctx, self); err != nil || found {
						return errors.New("want not found")
					}
					return nil
				}},
				{"SetPts before SetState fails", func() error {
					if err := st.SetPts(ctx, self, 5); !errors.Is(err, errNoState) {
						return errors.New("want errNoState")
					}
					if _, found, _ := st.GetState(ctx, self); found {
						return errors.New("failed SetPts must not create a state")
					}
					return nil
				}},
				{"SetChannelPts before SetState fails", func() error {
					if err := st.SetChannelPts(ctx, self, 77, 1); !errors.Is(err, errNoState) {
						return errors.New("want errNoState")
					}
					return nil
				}},
				{"ForEachChannels before SetState fails", func() error {
					if err := st.ForEachChannels(ctx, self, func(context.Context, int64, int) error { return nil }); !errors.Is(err, errNoState) {
						return errors.New("want errNoState")
					}
					return nil
				}},
				{"SetState then partial updates", func() error {
					if err := st.SetState(ctx, self, updates.State{Pts: 1, Qts: 2, Date: 3, Seq: 4}); err != nil {
						return err
					}
					for _, err := range []error{st.SetPts(ctx, self, 10), st.SetQts(ctx, self, 20), st.SetDateSeq(ctx, self, 30, 40)} {
						if err != nil {
							return err
						}
					}
					s, found, err := st.GetState(ctx, self)
					if err != nil || !found || s != (updates.State{Pts: 10, Qts: 20, Date: 30, Seq: 40}) {
						return errors.New("state mismatch")
					}
					return nil
				}},
				{"channel pts round-trip", func() error {
					_ = st.SetChannelPts(ctx, self, 77, 5)
					_ = st.SetChannelPts(ctx, self, 88, 6)
					if pts, found, err := st.GetChannelPts(ctx, self, 77); err != nil || !found || pts != 5 {
						return errors.New("channel 77 mismatch")
					}
					if _, found, _ := st.GetChannelPts(ctx, self, 99); found {
						return errors.New("unknown channel found")
					}
					got := map[int64]int{}
					err := st.ForEachChannels(ctx, self, func(_ context.Context, id int64, pts int) error { got[id] = pts; return nil })
					if err != nil || len(got) != 2 || got[88] != 6 {
						return errors.New("ForEachChannels mismatch")
					}
					return nil
				}},
				{"SetState forgets channel pts", func() error {
					_ = st.SetState(ctx, self, updates.State{Pts: 100})
					if _, found, _ := st.GetChannelPts(ctx, self, 77); found {
						return errors.New("channel pts should be cleared")
					}
					return nil
				}},
				{"access hashes round-trip", func() error {
					_ = st.SetUserAccessHash(ctx, self, 555, -8765432101234)
					_ = st.SetChannelAccessHash(ctx, self, 77, 42)
					if h, found, err := st.GetUserAccessHash(ctx, self, 555); err != nil || !found || h != -8765432101234 {
						return errors.New("user hash mismatch")
					}
					if h, found, _ := st.GetChannelAccessHash(ctx, self, 77); !found || h != 42 {
						return errors.New("channel hash mismatch")
					}
					if _, found, _ := st.GetUserAccessHash(ctx, self, 666); found {
						return errors.New("unknown user found")
					}
					return nil
				}},
				{"accounts are isolated", func() error {
					if _, found, _ := st.GetState(ctx, other); found {
						return errors.New("other account sees state")
					}
					if _, found, _ := st.GetUserAccessHash(ctx, other, 555); found {
						return errors.New("access hashes are per account; other account must not see them")
					}
					return nil
				}},
			}
			for _, s := range steps {
				if err := s.run(); err != nil {
					t.Fatalf("%s: %v", s.name, err)
				}
			}
		})
	}
}

func TestRedisSurvivesRestartAndUsesPrefix(t *testing.T) {
	ctx := context.Background()
	r, mr := newRedis(t)
	_ = r.SetState(ctx, 1001, updates.State{Pts: 7, Qts: 1, Date: 2, Seq: 3})
	_ = r.SetUserAccessHash(ctx, 1001, 555, 99)

	// A new client against the same server stands in for an app restart.
	again := NewRedis(redis.NewClient(&redis.Options{Addr: mr.Addr()}))
	if s, found, _ := again.GetState(ctx, 1001); !found || s.Pts != 7 {
		t.Fatalf("state after restart = %+v, %v", s, found)
	}
	if h, found, _ := again.GetUserAccessHash(ctx, 1001, 555); !found || h != 99 {
		t.Fatal("peer access hash lost after restart")
	}
	for _, k := range mr.Keys() {
		if !strings.HasPrefix(k, Prefix) {
			t.Fatalf("key %q outside %q namespace", k, Prefix)
		}
	}
}

func TestOpen(t *testing.T) {
	r, _ := newRedis(t)
	tests := []struct {
		backend string
		rdb     *redis.Client
		want    string // type name, "" = error
	}{
		{"", nil, "*store.Memory"},
		{"memory", nil, "*store.Memory"},
		{"redis", r.rdb, "*store.Redis"},
		{"redis", nil, ""},
		{"bbolt", nil, ""},
	}
	for _, tt := range tests {
		st, err := Open(tt.backend, tt.rdb)
		got := ""
		switch st.(type) {
		case *Memory:
			got = "*store.Memory"
		case *Redis:
			got = "*store.Redis"
		}
		if got != tt.want || (tt.want == "") != (err != nil) {
			t.Errorf("Open(%q) = %s, %v; want %s", tt.backend, got, err, tt.want)
		}
	}
}
