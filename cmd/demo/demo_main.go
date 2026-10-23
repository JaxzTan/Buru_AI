// Command demo runs only the pitch-demo API on the in-memory seed.
// No PostgreSQL, Redis, Temporal or Docker needed:  go run ./cmd/demo
// Scripted scammers arrive through the gateway's fake connector (set BURU_SIMULATE=0 to disable it).
package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/JaxzTan/Buru_AI/internal/demostore"
	"github.com/JaxzTan/Buru_AI/internal/gateway"
	"github.com/JaxzTan/Buru_AI/internal/gateway/fake"
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
	api := server.New(nil, nil).WithDemo(demo)
	var conns []gateway.Connector
	if os.Getenv("BURU_SIMULATE") != "0" {
		conns = append(conns, fake.New(demo))
	}
	if err := api.StartGateway(context.Background(), conns...); err != nil {
		log.Fatal(err)
	}
	srv := &http.Server{
		Addr:              addr,
		Handler:           api.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("buru demo API listening on %s", addr)
	log.Fatal(srv.ListenAndServe())
}
