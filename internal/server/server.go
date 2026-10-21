// Package server wires the HTTP routes for the customer API, operator API and health checks.
package server

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"
)

type Server struct {
	db    *sql.DB
	redis *redis.Client
}

func New(db *sql.DB, rdb *redis.Client) *Server {
	return &Server{db: db, redis: rdb}
}

func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.healthz)
	mux.HandleFunc("GET /readyz", s.readyz)
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

	checks := map[string]string{"mysql": "ok", "redis": "ok"}
	status := http.StatusOK
	if err := s.db.PingContext(ctx); err != nil {
		checks["mysql"] = err.Error()
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
