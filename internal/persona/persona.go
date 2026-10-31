// Package persona generates in-character replies with the Claude API (FR-1, FR-3, FR-4).
// Without ANTHROPIC_API_KEY the engine falls back to the playbook example lines.
package persona

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"time"
)

type Turn struct{ Role, Text string } // Role: "user" (scammer) | "assistant" (persona)

type Client struct {
	Key, Model string
	HTTP       *http.Client
}

func FromEnv() *Client {
	m := os.Getenv("SOCKABUS_MODEL")
	if m == "" {
		m = "claude-sonnet-5-5"
	}
	return &Client{Key: os.Getenv("ANTHROPIC_API_KEY"), Model: m, HTTP: &http.Client{Timeout: 20 * time.Second}}
}

func (c *Client) Enabled() bool { return c != nil && c.Key != "" }

// Reply returns the persona's next message given a system prompt and the conversation so far.
func (c *Client) Reply(ctx context.Context, system string, history []Turn) (string, error) {
	if !c.Enabled() {
		return "", errors.New("no API key")
	}
	var msgs []map[string]string // API needs alternating roles starting with "user"
	for _, t := range history {
		if n := len(msgs); n > 0 && msgs[n-1]["role"] == t.Role {
			msgs[n-1]["content"] += "\n" + t.Text
		} else if n > 0 || t.Role == "user" {
			msgs = append(msgs, map[string]string{"role": t.Role, "content": t.Text})
		}
	}
	if len(msgs) == 0 {
		return "", errors.New("empty history")
	}
	body, _ := json.Marshal(map[string]any{"model": c.Model, "max_tokens": 200, "system": system, "messages": msgs})
	req, _ := http.NewRequestWithContext(ctx, "POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	req.Header.Set("content-type", "application/json")
	req.Header.Set("x-api-key", c.Key)
	req.Header.Set("anthropic-version", "2023-06-01")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = res.Body.Close() }()
	var out struct {
		Content []struct{ Text string } `json:"content"`
	}
	if res.StatusCode != 200 || json.NewDecoder(res.Body).Decode(&out) != nil || len(out.Content) == 0 {
		return "", errors.New("llm call failed")
	}
	return out.Content[0].Text, nil
}
