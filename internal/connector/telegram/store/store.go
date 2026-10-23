// Package store keeps what the Telegram connector must not lose on restart: the update state
// (so missed messages are recovered) and the access hashes needed to message a peer at all.
// Everything is keyed by the honeypot account's own Telegram user id (selfID), so one store serves many accounts.
package store

import (
	"fmt"

	"github.com/gotd/td/telegram/updates"
	"github.com/redis/go-redis/v9"
)

// Store plugs straight into updates.Config{Storage, AccessHasher, UserAccessHasher}.
// The updates manager fills UserAccessHasher from every update it sees, so the connector
// only reads it back (GetUserAccessHash) when it needs to reply.
type Store interface {
	updates.StateStorage
	updates.ChannelAccessHasher
	updates.UserAccessHasher
}

// Open picks the backend named by BURU_TG_STORE: "memory" (default: demo, tests) or "redis".
func Open(backend string, rdb *redis.Client) (Store, error) {
	switch backend {
	case "", "memory":
		return NewMemory(), nil
	case "redis":
		if rdb == nil {
			return nil, fmt.Errorf("telegram store: redis backend needs a redis client")
		}
		return NewRedis(rdb), nil
	default:
		return nil, fmt.Errorf("telegram store: unknown backend %q (want memory or redis)", backend)
	}
}
