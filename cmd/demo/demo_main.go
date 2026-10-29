// Command demo runs only the pitch-demo API on the in-memory seed.
// No PostgreSQL, Redis, Temporal or Docker needed:  go run ./cmd/demo
package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
	"github.com/JaxzTan/Buru_AI/internal/server"
)

func main() {
	demo, err := demostore.New()
	if err != nil {
		log.Fatal(err)
	}
	addr := ":8080"
	if v := os.Getenv("HTTP_ADDR"); v != "" {
		addr = v
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           server.New(nil, nil).WithDemo(demo).Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("sockabus demo API listening on %s", addr)
	log.Fatal(srv.ListenAndServe())
}
