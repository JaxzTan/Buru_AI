package store

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/gotd/td/telegram/updates"
	"github.com/redis/go-redis/v9"
)

// Prefix keeps Telegram keys apart from the lookup cache (TR-10). Keys never expire, so Redis
// must run with persistence (AOF or RDB), or a restart loses update state and every peer's access hash.
//
//	tg:<self>:state     hash  pts, qts, date, seq
//	tg:<self>:chan      hash  channel id → pts
//	tg:<self>:chanhash  hash  channel id → access hash
//	tg:<self>:userhash  hash  user id → access hash
const Prefix = "tg:"

// Redis is the persistent Store, on the same go-redis v9 client the app already uses.
type Redis struct{ rdb *redis.Client }

func NewRedis(rdb *redis.Client) *Redis { return &Redis{rdb: rdb} }

func key(self int64, kind string) string { return Prefix + strconv.FormatInt(self, 10) + ":" + kind }

func (r *Redis) GetState(ctx context.Context, self int64) (updates.State, bool, error) {
	h, err := r.rdb.HGetAll(ctx, key(self, "state")).Result()
	if err != nil || len(h) == 0 {
		return updates.State{}, false, err
	}
	var s updates.State
	for _, f := range []struct {
		name string
		dst  *int
	}{{"pts", &s.Pts}, {"qts", &s.Qts}, {"date", &s.Date}, {"seq", &s.Seq}} {
		if *f.dst, err = strconv.Atoi(h[f.name]); err != nil {
			return updates.State{}, false, fmt.Errorf("telegram store: corrupt %s for %d: %w", f.name, self, err)
		}
	}
	return s, true, nil
}

// SetState replaces the state and forgets channel pts, matching Memory and gotd's own storage.
func (r *Redis) SetState(ctx context.Context, self int64, s updates.State) error {
	_, err := r.rdb.TxPipelined(ctx, func(p redis.Pipeliner) error {
		p.Del(ctx, key(self, "state"), key(self, "chan"))
		p.HSet(ctx, key(self, "state"), "pts", s.Pts, "qts", s.Qts, "date", s.Date, "seq", s.Seq)
		return nil
	})
	return err
}

// hsetIfState writes fields only if the state exists, so a stray SetPts can't create a half-filled state.
var hsetIfState = redis.NewScript(`
if redis.call('EXISTS', KEYS[1]) == 0 then return -1 end
return redis.call('HSET', KEYS[2], unpack(ARGV))`)

func (r *Redis) setIfState(ctx context.Context, self int64, target string, kv ...any) error {
	n, err := hsetIfState.Run(ctx, r.rdb, []string{key(self, "state"), target}, kv...).Int()
	if err == nil && n == -1 {
		return errNoState
	}
	return err
}

func (r *Redis) SetPts(ctx context.Context, self int64, v int) error {
	return r.setIfState(ctx, self, key(self, "state"), "pts", v)
}
func (r *Redis) SetQts(ctx context.Context, self int64, v int) error {
	return r.setIfState(ctx, self, key(self, "state"), "qts", v)
}
func (r *Redis) SetDate(ctx context.Context, self int64, v int) error {
	return r.setIfState(ctx, self, key(self, "state"), "date", v)
}
func (r *Redis) SetSeq(ctx context.Context, self int64, v int) error {
	return r.setIfState(ctx, self, key(self, "state"), "seq", v)
}
func (r *Redis) SetDateSeq(ctx context.Context, self int64, date, seq int) error {
	return r.setIfState(ctx, self, key(self, "state"), "date", date, "seq", seq)
}

func (r *Redis) GetChannelPts(ctx context.Context, self, channel int64) (int, bool, error) {
	v, err := r.rdb.HGet(ctx, key(self, "chan"), strconv.FormatInt(channel, 10)).Int()
	if errors.Is(err, redis.Nil) {
		return 0, false, nil
	}
	return v, err == nil, err
}

func (r *Redis) SetChannelPts(ctx context.Context, self, channel int64, pts int) error {
	return r.setIfState(ctx, self, key(self, "chan"), strconv.FormatInt(channel, 10), pts)
}

func (r *Redis) ForEachChannels(ctx context.Context, self int64, f func(context.Context, int64, int) error) error {
	if n, err := r.rdb.Exists(ctx, key(self, "state")).Result(); err != nil {
		return err
	} else if n == 0 {
		return errNoState
	}
	h, err := r.rdb.HGetAll(ctx, key(self, "chan")).Result()
	if err != nil {
		return err
	}
	for k, v := range h {
		id, err1 := strconv.ParseInt(k, 10, 64)
		pts, err2 := strconv.Atoi(v)
		if err := errors.Join(err1, err2); err != nil {
			return fmt.Errorf("telegram store: corrupt channel pts for %d: %w", self, err)
		}
		if err := f(ctx, id, pts); err != nil {
			return err
		}
	}
	return nil
}

func (r *Redis) getHash(ctx context.Context, self int64, kind string, id int64) (int64, bool, error) {
	v, err := r.rdb.HGet(ctx, key(self, kind), strconv.FormatInt(id, 10)).Int64()
	if errors.Is(err, redis.Nil) {
		return 0, false, nil
	}
	return v, err == nil, err
}

func (r *Redis) setHash(ctx context.Context, self int64, kind string, id, hash int64) error {
	return r.rdb.HSet(ctx, key(self, kind), strconv.FormatInt(id, 10), hash).Err()
}

func (r *Redis) GetChannelAccessHash(ctx context.Context, self, channel int64) (int64, bool, error) {
	return r.getHash(ctx, self, "chanhash", channel)
}
func (r *Redis) SetChannelAccessHash(ctx context.Context, self, channel, hash int64) error {
	return r.setHash(ctx, self, "chanhash", channel, hash)
}
func (r *Redis) GetUserAccessHash(ctx context.Context, self, user int64) (int64, bool, error) {
	return r.getHash(ctx, self, "userhash", user)
}
func (r *Redis) SetUserAccessHash(ctx context.Context, self, user, hash int64) error {
	return r.setHash(ctx, self, "userhash", user, hash)
}
