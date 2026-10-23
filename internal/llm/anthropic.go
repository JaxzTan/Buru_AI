package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const DefaultAnthropicModel = "claude-sonnet-5-5"

// Anthropic calls the Claude Messages API (the TRD §3 default provider).
type Anthropic struct {
	Key, Model string
	HTTP       *http.Client
}

func NewAnthropic(key, model string) *Anthropic {
	if model == "" {
		model = DefaultAnthropicModel
	}
	return &Anthropic{Key: key, Model: model, HTTP: &http.Client{Timeout: 90 * time.Second}}
}

func (a *Anthropic) Name() string { return "anthropic/" + a.Model }

func (a *Anthropic) Generate(ctx context.Context, req Request) (string, error) {
	turns := Normalize(req.Turns)
	if len(turns) == 0 || turns[len(turns)-1].Role != RoleUser {
		return "", errors.New("anthropic: conversation must end with a user turn")
	}
	msgs := make([]map[string]string, 0, len(turns))
	for _, t := range turns {
		role := "user"
		if t.Role == RoleModel {
			role = "assistant"
		}
		msgs = append(msgs, map[string]string{"role": role, "content": t.Text})
	}
	system := req.System
	if req.JSON {
		system += "\n\nRespond with JSON only, no prose and no code fences."
	}
	maxTokens := req.MaxOutputTokens
	if maxTokens <= 0 {
		maxTokens = 1024
	}
	raw, err := json.Marshal(map[string]any{"model": a.Model, "max_tokens": maxTokens, "system": system, "messages": msgs})
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("content-type", "application/json")
	httpReq.Header.Set("x-api-key", a.Key)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	res, err := a.HTTP.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("anthropic: %w", err)
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if err != nil {
		return "", err
	}
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic: HTTP %d: %s", res.StatusCode, apiErrorMessage(data))
	}
	var out struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		StopReason string `json:"stop_reason"`
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return "", fmt.Errorf("anthropic: decode: %w", err)
	}
	if out.StopReason == "refusal" {
		return "", ErrBlocked
	}
	var b strings.Builder
	for _, c := range out.Content {
		if c.Type == "text" {
			b.WriteString(c.Text)
		}
	}
	text := strings.TrimSpace(b.String())
	if text == "" {
		return "", errors.New("anthropic: empty response")
	}
	return text, nil
}
