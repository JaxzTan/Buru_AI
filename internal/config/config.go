// Package config loads runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Env               string // local | staging | prod
	HTTPAddr          string
	PostgresURL       string
	RedisAddr         string
	TemporalHostPort  string
	TemporalNamespace string
	TemporalTaskQueue string
}

func Load() (Config, error) {
	c := Config{
		Env:               getenv("BURU_ENV", "local"),
		HTTPAddr:          getenv("BURU_HTTP_ADDR", ":8080"),
		PostgresURL:       os.Getenv("BURU_POSTGRES_URL"),
		RedisAddr:         getenv("BURU_REDIS_ADDR", "localhost:6379"),
		TemporalHostPort:  getenv("BURU_TEMPORAL_HOSTPORT", "localhost:7233"),
		TemporalNamespace: getenv("BURU_TEMPORAL_NAMESPACE", "default"),
		TemporalTaskQueue: getenv("BURU_TEMPORAL_TASK_QUEUE", "buru-main"),
	}
	if c.PostgresURL == "" {
		return c, fmt.Errorf("BURU_POSTGRES_URL is required")
	}
	return c, nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
