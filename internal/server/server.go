// Package server wires the HTTP routes for the customer API, operator API and health checks.
package server

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
	"github.com/JaxzTan/Buru_AI/internal/engine"
	"github.com/JaxzTan/Buru_AI/internal/gateway"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type Server struct {
	db    *pgxpool.Pool
	redis *redis.Client
	demo  *demostore.Store // optional: live demo data
	eng   *engine.Engine
	gw    *gateway.Router
}

func New(db *pgxpool.Pool, rdb *redis.Client) *Server {
	return &Server{db: db, redis: rdb}
}

// WithDemo enables the console + portal APIs on the in-memory store.
func (s *Server) WithDemo(st *demostore.Store) *Server {
	s.demo = st
	s.eng = engine.New(st)
	return s
}

// StartGateway routes inbound messages from the connectors into the demo engine (TR-2).
// Call after WithDemo; the connectors run until ctx is cancelled.
func (s *Server) StartGateway(ctx context.Context, cs ...gateway.Connector) error {
	gw, err := gateway.NewRouter(s.demo, s.eng, cs...)
	if err != nil {
		return err
	}
	s.gw = gw
	s.eng.Out = gw // persona and operator replies leave through the connectors
	return gw.Start(ctx)
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /readyz", s.readyz)
	if s.demo != nil {
		s.registerDemo(mux)
	}
	mux.HandleFunc("GET /internal/gateway/health", func(w http.ResponseWriter, r *http.Request) {
		if s.gw == nil {
			writeJSON(w, http.StatusOK, []gateway.AccountHealth{})
			return
		}
		writeJSON(w, http.StatusOK, s.gw.Health(r.Context()))
	})
	return mux
}

// healthz reports that the process is alive.
func (s *Server) healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// readyz reports whether downstream dependencies are reachable (TR-16).
func (s *Server) readyz(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	checks := map[string]string{"postgres": "ok", "redis": "ok"}
	status := http.StatusOK
	if err := s.db.Ping(ctx); err != nil {
		checks["postgres"] = err.Error()
		status = http.StatusServiceUnavailable
	}
	if err := s.redis.Ping(ctx).Err(); err != nil {
		checks["redis"] = err.Error()
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, checks)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
