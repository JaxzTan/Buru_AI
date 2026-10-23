package store

import (
	"context"
	"errors"
	"sync"

	"github.com/gotd/td/telegram/updates"
)

var errNoState = errors.New("telegram store: no update state for user")

// Memory is the in-process Store. Everything is lost on restart: use it for the demo and tests only.
type Memory struct {
	mu         sync.Mutex
	states     map[int64]updates.State
	channels   map[int64]map[int64]int   // self → channel → pts
	chanHashes map[int64]map[int64]int64 // self → channel → access hash
	userHashes map[int64]map[int64]int64 // self → user → access hash
}

func NewMemory() *Memory {
	return &Memory{states: map[int64]updates.State{}, channels: map[int64]map[int64]int{},
		chanHashes: map[int64]map[int64]int64{}, userHashes: map[int64]map[int64]int64{}}
}

func (m *Memory) GetState(_ context.Context, self int64) (updates.State, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.states[self]
	return s, ok, nil
}

// SetState replaces the state and forgets channel pts, as gotd's own in-memory storage does.
func (m *Memory) SetState(_ context.Context, self int64, s updates.State) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.states[self], m.channels[self] = s, map[int64]int{}
	return nil
}

func (m *Memory) update(self int64, fn func(*updates.State)) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.states[self]
	if !ok {
		return errNoState
	}
	fn(&s)
	m.states[self] = s
	return nil
}

func (m *Memory) SetPts(_ context.Context, self int64, v int) error {
	return m.update(self, func(s *updates.State) { s.Pts = v })
}
func (m *Memory) SetQts(_ context.Context, self int64, v int) error {
	return m.update(self, func(s *updates.State) { s.Qts = v })
}
func (m *Memory) SetDate(_ context.Context, self int64, v int) error {
	return m.update(self, func(s *updates.State) { s.Date = v })
}
func (m *Memory) SetSeq(_ context.Context, self int64, v int) error {
	return m.update(self, func(s *updates.State) { s.Seq = v })
}
func (m *Memory) SetDateSeq(_ context.Context, self int64, date, seq int) error {
	return m.update(self, func(s *updates.State) { s.Date, s.Seq = date, seq })
}

func (m *Memory) GetChannelPts(_ context.Context, self, channel int64) (int, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	pts, ok := m.channels[self][channel]
	return pts, ok, nil
}

func (m *Memory) SetChannelPts(_ context.Context, self, channel int64, pts int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.states[self]; !ok {
		return errNoState
	}
	m.channels[self][channel] = pts
	return nil
}

func (m *Memory) ForEachChannels(ctx context.Context, self int64, f func(context.Context, int64, int) error) error {
	m.mu.Lock()
	if _, ok := m.states[self]; !ok {
		m.mu.Unlock()
		return errNoState
	}
	snap := make(map[int64]int, len(m.channels[self]))
	for id, pts := range m.channels[self] {
		snap[id] = pts
	}
	m.mu.Unlock() // f may call back into the store
	for id, pts := range snap {
		if err := f(ctx, id, pts); err != nil {
			return err
		}
	}
	return nil
}

func get(m map[int64]map[int64]int64, self, id int64) (int64, bool, error) {
	h, ok := m[self][id]
	return h, ok, nil
}

func set(m map[int64]map[int64]int64, self, id, hash int64) error {
	if m[self] == nil {
		m[self] = map[int64]int64{}
	}
	m[self][id] = hash
	return nil
}

func (m *Memory) GetChannelAccessHash(_ context.Context, self, channel int64) (int64, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return get(m.chanHashes, self, channel)
}

func (m *Memory) SetChannelAccessHash(_ context.Context, self, channel, hash int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return set(m.chanHashes, self, channel, hash)
}

func (m *Memory) GetUserAccessHash(_ context.Context, self, user int64) (int64, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return get(m.userHashes, self, user)
}

func (m *Memory) SetUserAccessHash(_ context.Context, self, user, hash int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return set(m.userHashes, self, user, hash)
}
