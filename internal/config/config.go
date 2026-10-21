// Package config loads runtime configuration from environment variables.
package config

import (
	"fmt"
	"os"
)

type Config struct {
	Env               string // local | staging | prod
	HTTPAddr          string
	MySQLDSN          string
	RedisAddr         string
	TemporalHostPort  string
	TemporalNamespace string
	TemporalTaskQueue string
}

func Load() (Config, error) {
	c := Config{
		Env:               getenv("BURU_ENV", "local"),
		HTTPAddr:          getenv("BURU_HTTP_ADDR", ":8080"),
		MySQLDSN:          os.Getenv("BURU_MYSQL_DSN"),
		RedisAddr:         getenv("BURU_REDIS_ADDR", "localhost:6379"),
		TemporalHostPort:  getenv("BURU_TEMPORAL_HOSTPORT", "localhost:7233"),
		TemporalNamespace: getenv("BURU_TEMPORAL_NAMESPACE", "default"),
		TemporalTaskQueue: getenv("BURU_TEMPORAL_TASK_QUEUE", "buru-main"),
	}
	if c.MySQLDSN == "" {
		return c, fmt.Errorf("BURU_MYSQL_DSN is required")
	}
	return c, nil
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}
